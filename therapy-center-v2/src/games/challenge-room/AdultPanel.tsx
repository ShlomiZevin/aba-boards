/**
 * The adult's panel (admins / therapists): levels and settings per challenge,
 * the round history with each challenge's own measures.
 * Rounds are compared only under the same conditions (level + settings).
 */
import { useMemo, useState } from 'react';
import type { GameConfigValues, GameRoundRecord } from '../../types';
import { CHALLENGES, challengeById, effectiveSettings, levelStreak, ROUNDS_TO_LEVEL_UP, PASS_RULE } from './challenges';
import type { ChallengeDef, Field } from './challenges';
import type { CrConfig } from './config';
import type { Settings, Val } from './engine';

interface Props {
  cr: CrConfig;
  rounds: GameRoundRecord[];
  kidName: string;
  soundOn: boolean;
  voiceOn: boolean;
  onSave: (next: CrConfig, extra?: GameConfigValues) => void;
  onClose: () => void;
  /** clears the child's stars and bests (the saved round history stays) */
  onResetProgress?: () => void;
  /** deletes every saved round, the stars and the levels - a fresh start */
  onResetData?: () => Promise<boolean>;
  /** the challenges this game has (the room: all four; games 2 and 3: one each) */
  defs?: ChallengeDef[];
}

/** the measure a progress graph follows per challenge (0-100 where it is a %) */
const GRAPH: Record<string, { key: string; label: string; pct: boolean }> = {
  light: { key: 'accuracy', label: 'תגובות נכונות %', pct: true },
  gonogo: { key: 'nogoPct', label: 'עצר על אדום %', pct: true },
  sequence: { key: 'span', label: 'אורך הרצף', pct: false },
  base: { key: 'cleanPct', label: 'רצפים נכונים %', pct: true },
  wait: { key: 'waitPct', label: 'המתנות מוצלחות %', pct: true },
  switch: { key: 'accuracy', label: 'דיוק %', pct: true },
};

/** a small line graph of the last rounds (oldest -> newest, right to left like the page) */
function Trend({ rounds, def }: { rounds: GameRoundRecord[]; def: ChallengeDef }) {
  const g = GRAPH[def.id];
  const pts = rounds.filter((r) => r.challenge === def.id && r.valid !== false && !r.stoppedEarly)
    .slice(0, 20).reverse()
    .map((r) => ({ v: Number(r.summary?.[g.key]), lv: Number(r.level) || 1 }))
    .filter((x) => Number.isFinite(x.v));
  if (pts.length < 2) return null;
  const W = 300, H = 90, P = 10;
  const max = g.pct ? 100 : Math.max(4, ...pts.map((x) => x.v));
  const x = (k: number) => W - P - (k * (W - 2 * P)) / (pts.length - 1);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  return (
    <div className="cr-trend">
      <div className="cr-trend-head"><b>{def.name}</b><span>{g.label} · {pts.length} סבבים אחרונים</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${def.name}: ${pts.map((p) => p.v).join(', ')}`}>
        {g.pct && <line x1={P} x2={W - P} y1={y(80)} y2={y(80)} className="cr-trend-bar" />}
        <polyline points={pts.map((p, k) => `${x(k)},${y(p.v)}`).join(' ')} className="cr-trend-line" />
        {pts.map((p, k) => <circle key={k} cx={x(k)} cy={y(p.v)} r={3.4} className={`cr-trend-dot lv-${Math.min(5, p.lv)}`}><title>{`רמה ${p.lv}: ${p.v}`}</title></circle>)}
      </svg>
      {g.pct && <div className="cr-trend-note">הקו המקווקו = 80%, הרף לעליית רמה</div>}
    </div>
  );
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};
const show = (v: unknown, unit?: string) => (v === null || v === undefined || v === '' ? '—' : `${v}${unit === '%' ? '%' : unit ? ` ${unit}` : ''}`);

export default function AdultPanel({ cr, rounds, kidName, soundOn, voiceOn, onSave, onClose, onResetProgress, onResetData, defs = CHALLENGES }: Props) {
  const [resetAsk, setResetAsk] = useState<'' | 'ask' | 'done'>('');
  const [wipeAsk, setWipeAsk] = useState<'' | 'ask' | 'busy' | 'done' | 'fail'>('');
  const [tab, setTab] = useState<'settings' | 'history'>('settings');
  const [open, setOpen] = useState<string>(defs[0].id);
  const [filter, setFilter] = useState<string>('all');

  const level = (id: string) => Math.max(1, Math.min(challengeById(id)!.levels.length, cr.levels[id] || 1));

  const setField = (def: ChallengeDef, f: Field, raw: string | boolean) => {
    let v: Val = raw as Val;
    if (f.type === 'number') {
      const n = Number(raw);
      if (!Number.isFinite(n)) return;
      v = Math.max(f.min ?? -Infinity, Math.min(f.max ?? Infinity, n));
    }
    if (f.key === 'colors') v = Number(raw);
    onSave({ ...cr, overrides: { ...cr.overrides, [def.id]: { ...(cr.overrides[def.id] || {}), [f.key]: v } } });
  };

  const shown = useMemo(() => rounds.filter((r) => filter === 'all' || r.challenge === filter), [rounds, filter]);

  return (
    <div className="cr-panel">
      <div className="cr-panel-head">
        <button type="button" className="cr-icon-btn" onClick={onClose} aria-label="חזרה">→</button>
        <h1>אזור המבוגר · {kidName}</h1>
        <div className="cr-tabs">
          <button type="button" className={tab === 'settings' ? 'is-on' : ''} onClick={() => setTab('settings')}>הגדרות</button>
          <button type="button" className={tab === 'history' ? 'is-on' : ''} onClick={() => setTab('history')}>היסטוריה ({rounds.length})</button>
        </div>
      </div>

      {tab === 'settings' && (
        <div className="cr-panel-body">
          <section className="cr-sec">
            <h2>כללי</h2>
            <label className="cr-row is-check"><input type="checkbox" checked={soundOn} onChange={(e) => onSave(cr, { sound: e.target.checked })} /> צלילים</label>
            <label className="cr-row is-check"><input type="checkbox" checked={voiceOn} onChange={(e) => onSave(cr, { voice: e.target.checked })} /> הוראות בקול</label>
            <label className="cr-row is-check"><input type="checkbox" checked={cr.voicePraise} onChange={(e) => onSave({ ...cr, voicePraise: e.target.checked })} /> מילות עידוד בקול (מדי פעם, עם כוכב)</label>
            <label className="cr-row is-check"><input type="checkbox" checked={cr.errorSound} onChange={(e) => onSave({ ...cr, errorSound: e.target.checked })} /> צליל רך אחרי טעות (כבוי = שקט לגמרי)</label>
            <label className="cr-row">כוכב על כל
              <input type="number" min={1} max={10} value={cr.starsEvery} onChange={(e) => onSave({ ...cr, starsEvery: Math.max(1, Math.min(10, Number(e.target.value) || 3)) })} />
              הצלחות (גם עצירה נכונה היא הצלחה)
            </label>
            <div className="cr-row">
              {resetAsk === '' && onResetProgress && <button type="button" className="cr-btn cr-btn-soft cr-reset" onClick={() => setResetAsk('ask')}>איפוס ההישגים (כוכבים ושיאים)</button>}
              {resetAsk === 'ask' && (<>
                <span>לאפס את כל הכוכבים והשיאים של {kidName}? ההיסטוריה של הסבבים נשמרת.</span>
                <button type="button" className="cr-btn cr-btn-soft cr-reset is-danger" onClick={() => { onResetProgress?.(); setResetAsk('done'); }}>כן, לאפס</button>
                <button type="button" className="cr-btn cr-btn-soft cr-reset" onClick={() => setResetAsk('')}>ביטול</button>
              </>)}
              {resetAsk === 'done' && <span>✓ ההישגים אופסו</span>}
            </div>
            {onResetData && (
              <div className="cr-row">
                {wipeAsk === '' && <button type="button" className="cr-btn cr-btn-soft cr-reset" onClick={() => setWipeAsk('ask')}>איפוס כל הנתונים (היסטוריה, כוכבים ורמות)</button>}
                {wipeAsk === 'ask' && (<>
                  <span>למחוק את כל {rounds.length} הסבבים השמורים של {kidName}, את הכוכבים ואת הרמות? אי אפשר לבטל.</span>
                  <button type="button" className="cr-btn cr-btn-soft cr-reset is-danger" onClick={async () => { setWipeAsk('busy'); setWipeAsk((await onResetData()) ? 'done' : 'fail'); }}>כן, למחוק הכול</button>
                  <button type="button" className="cr-btn cr-btn-soft cr-reset" onClick={() => setWipeAsk('')}>ביטול</button>
                </>)}
                {wipeAsk === 'busy' && <span>מוחק…</span>}
                {wipeAsk === 'done' && <span>✓ כל הנתונים נמחקו - מתחילים מרמה 1</span>}
                {wipeAsk === 'fail' && <span>המחיקה לא הצליחה. נסו שוב.</span>}
              </div>
            )}
          </section>
          <section className="cr-sec">
            <h2>רמות</h2>
            <p className="cr-note">לכל אתגר יש כמה רמות (רמה 1 הכי קלה). עולים רמה אחרי {ROUNDS_TO_LEVEL_UP} סבבים מוצלחים ברצף באותה רמה. סבב שנעצר באמצע או יצא מהמסך לא נספר.</p>
            <label className="cr-row is-check"><input type="checkbox" checked={cr.autoLevel} onChange={(e) => onSave({ ...cr, autoLevel: e.target.checked })} /> הרמה עולה לבד (כבוי = המבוגר מאשר בסוף הסבב)</label>
            <ul className="cr-lvlist">
              {defs.map((def) => {
                const lv = level(def.id);
                const st = levelStreak(def, lv, rounds);
                return (
                  <li key={def.id}>
                    <b>{def.name}</b>
                    <span>רמה {lv} מתוך {def.levels.length}: {def.levels[lv - 1].name}</span>
                    <span className="cr-lvlist-rule">סבב מוצלח = {PASS_RULE[def.id]}</span>
                    <span className="cr-lvlist-prog">{lv >= def.levels.length ? 'ברמה הגבוהה ביותר' : `לרמה ${lv + 1}: ${Math.min(st, ROUNDS_TO_LEVEL_UP)} מתוך ${ROUNDS_TO_LEVEL_UP} סבבים מוצלחים`}</span>
                  </li>
                );
              })}
            </ul>
          </section>
          {CHALLENGES.map((def) => {
            const lv = level(def.id);
            const s: Settings = effectiveSettings(def, lv, cr.overrides[def.id]);
            const preset = def.levels[lv - 1].settings;
            const changed = Object.keys(cr.overrides[def.id] || {}).filter((k) => String(cr.overrides[def.id][k]) !== String(preset[k]));
            return (
              <section key={def.id} className={`cr-sec${open === def.id ? ' is-open' : ''}`}>
                <button type="button" className="cr-sec-head" onClick={() => setOpen(open === def.id ? '' : def.id)}>
                  <b>{def.name}</b><span>רמה {lv}: {def.levels[lv - 1].name}{changed.length ? ` · ${changed.length} שינויים` : ''}</span>
                </button>
                {open === def.id && (
                  <div className="cr-sec-body">
                    <ol className="cr-lvnames">
                      {def.levels.map((l, k) => <li key={k} className={k + 1 === lv ? 'is-on' : ''}>רמה {k + 1}: {l.name}</li>)}
                    </ol>
                    <label className="cr-row">רמה
                      <select value={lv} onChange={(e) => onSave({ ...cr, levels: { ...cr.levels, [def.id]: Number(e.target.value) }, overrides: { ...cr.overrides, [def.id]: {} } })}>
                        {def.levels.map((l, k) => <option key={k} value={k + 1}>{k + 1}. {l.name}</option>)}
                      </select>
                    </label>
                    <p className="cr-note">החלפת רמה מחזירה את ההגדרות לברירת המחדל של הרמה.</p>
                    {def.fields.map((f) => (
                      <label key={f.key} className={`cr-row${f.type === 'checkbox' ? ' is-check' : ''}${changed.includes(f.key) ? ' is-changed' : ''}`}>
                        {f.type === 'checkbox' ? (
                          <><input type="checkbox" checked={s[f.key] === true} onChange={(e) => setField(def, f, e.target.checked)} /> {f.label}</>
                        ) : f.type === 'select' ? (
                          <>{f.label}
                            <select value={String(s[f.key] ?? '')} onChange={(e) => setField(def, f, e.target.value)}>
                              {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select></>
                        ) : (
                          <>{f.label}
                            <input type="number" min={f.min} max={f.max} step={f.step} value={Number(s[f.key] ?? 0)} onChange={(e) => setField(def, f, e.target.value)} /></>
                        )}
                      </label>
                    ))}
                    {changed.length > 0 && (
                      <button type="button" className="cr-btn cr-btn-soft" onClick={() => onSave({ ...cr, overrides: { ...cr.overrides, [def.id]: {} } })}>חזרה להגדרות הרמה</button>
                    )}
                  </div>
                )}
              </section>
            );
          })}
          <p className="cr-note">זה לא מבחן מתוקנן. זמני תגובה תלויים במחשב ובדפדפן — משווים רק בין מפגשים באותם תנאים ובאותו מכשיר.</p>
        </div>
      )}

      {tab === 'history' && (
        <div className="cr-panel-body">
          <div className="cr-hist-tools">
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">כל האתגרים</option>
              {defs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          {!shown.length && <p className="cr-note">עוד אין סבבים שמורים.</p>}
          {shown.length > 1 && (
            <div className="cr-trends">
              {defs.filter((d) => filter === 'all' || d.id === filter).map((d) => <Trend key={d.id} rounds={shown} def={d} />)}
            </div>
          )}
          <ul className="cr-hist">
            {shown.map((r, k) => {
              const def = challengeById(String(r.challenge));
              const older = shown.slice(k + 1).find((x) => x.challenge === r.challenge);
              const differs = older && older.settingsKey !== r.settingsKey;
              return (
                <li key={r.id} className={`cr-hist-item${r.valid === false ? ' is-invalid' : ''}`}>
                  <div className="cr-hist-head">
                    <b>{def?.name || String(r.challenge)}</b>
                    <span>רמה {String(r.level)}</span>
                    <span className="cr-hist-date">{fmtDate(r.createdAt)}</span>
                    {r.valid === false && <span className="cr-flag is-bad">לא תקין</span>}
                    {Boolean(r.stoppedEarly) && <span className="cr-flag">נעצר מוקדם</span>}
                    {Number(r.hints) > 0 && <span className="cr-flag">עם עזרה: {String(r.hints)}</span>}
                    {def && r.valid !== false && !r.stoppedEarly && <span className={`cr-flag ${def.passed((r.summary || {}) as Record<string, Val>) ? 'is-pass' : ''}`}>{def.passed((r.summary || {}) as Record<string, Val>) ? 'עבר את הרף' : 'מתחת לרף'}</span>}
                    {differs && <span className="cr-flag is-info">תנאים שונים מהסבב הקודם</span>}
                  </div>
                  {def && (
                    <dl className="cr-metrics is-small">
                      {def.metrics.map((m) => <div key={m.key}><dt>{m.label}</dt><dd>{show(r.summary?.[m.key], m.unit)}</dd></div>)}
                    </dl>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
