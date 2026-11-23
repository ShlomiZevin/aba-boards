/**
 * The adult's panel (admins / therapists): levels and settings per challenge,
 * the round history with each challenge's own measures, and CSV export.
 * Rounds are compared only under the same conditions (level + settings).
 */
import { useMemo, useState } from 'react';
import type { GameConfigValues, GameRoundRecord } from '../../types';
import { CHALLENGES, challengeById, effectiveSettings } from './challenges';
import type { ChallengeDef, Field } from './challenges';
import type { CrConfig } from './config';
import { downloadCsv } from './config';
import type { Settings, Val } from './engine';

interface Props {
  cr: CrConfig;
  rounds: GameRoundRecord[];
  kidName: string;
  soundOn: boolean;
  voiceOn: boolean;
  onSave: (next: CrConfig, extra?: GameConfigValues) => void;
  onClose: () => void;
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};
const show = (v: unknown, unit?: string) => (v === null || v === undefined || v === '' ? '—' : `${v}${unit === '%' ? '%' : unit ? ` ${unit}` : ''}`);

export default function AdultPanel({ cr, rounds, kidName, soundOn, voiceOn, onSave, onClose }: Props) {
  const [tab, setTab] = useState<'settings' | 'history'>('settings');
  const [open, setOpen] = useState<string>(CHALLENGES[0].id);
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

  const exportRounds = () => {
    downloadCsv(`חדר-האתגרים-${kidName || 'ילד'}-סבבים.csv`, shown.map((r) => {
      const row: Record<string, Val> = {
        תאריך: fmtDate(r.createdAt), משחק: String(r.challengeName || r.challenge), רמה: Number(r.level) || null,
        תקין: r.valid !== false ? 'כן' : 'לא', 'נעצר מוקדם': r.stoppedEarly ? 'כן' : 'לא', תיווך: Number(r.hints) || 0,
        'משך (שנ׳)': Math.round((Number(r.durationMs) || 0) / 1000), 'מי שיחק': String(r.by || ''),
      };
      Object.entries(r.summary || {}).forEach(([k, v]) => { row[`מדד:${k}`] = v; });
      Object.entries(r.settings || {}).forEach(([k, v]) => { row[`הגדרה:${k}`] = v; });
      return row;
    }));
  };
  const exportTrials = () => {
    const rows: Record<string, Val>[] = [];
    shown.forEach((r) => (r.trials || []).forEach((t) => rows.push({ תאריך: fmtDate(r.createdAt), סבב: r.id, משחק: String(r.challenge), רמה: Number(r.level) || null, ...t })));
    downloadCsv(`חדר-האתגרים-${kidName || 'ילד'}-ניסיונות.csv`, rows);
  };

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
              {CHALLENGES.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button type="button" className="cr-btn cr-btn-soft" disabled={!shown.length} onClick={exportRounds}>ייצוא סבבים (CSV)</button>
            <button type="button" className="cr-btn cr-btn-soft" disabled={!shown.length} onClick={exportTrials}>ייצוא ניסיונות (CSV)</button>
          </div>
          {!shown.length && <p className="cr-note">עוד אין סבבים שמורים.</p>}
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
                    {Number(r.hints) > 0 && <span className="cr-flag">תיווך {String(r.hints)}</span>}
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
