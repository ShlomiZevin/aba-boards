import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { addWeeks, format, isSameDay, startOfDay, startOfWeek } from 'date-fns';
import { formsApi, goalsApi, kidsApi, practitionersApi, sessionsApi } from '../../api/client';
import { useTherapistLinks } from '../../hooks/useTherapistLinks';
import { GOAL_CATEGORIES } from '../../types';
import type { Goal, Practitioner, Session, SessionForm } from '../../types';
import { toDate } from '../../utils/date';
import Icon from '../Icon';
import { CATEGORY_TONE, kidColor } from '../kidColor';
import './goals-week.css';

// השבוע במטרות — for the therapists (and Michal): for each of the kid's active goals, how many times
// it was worked on this week (Sunday → Saturday), by whom and on which day, and what is still left.
// Every therapist sees what the others did. Nothing new is recorded: "worked on" = the goal is ticked
// in a session form of that week (goalsWorkedOn). It only shows, it never suggests.

const DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

interface Visit { date: Date; who: string | null }

function Ring({ done, total, size, stroke, tone, label }: { done: number; total: number; size: number; stroke: number; tone: string; label: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = total ? done / total : 0;
  return (
    <svg className={`wk-ring-svg tone-${tone}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="wk-ring-bg" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="wk-ring-fg" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - frac)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

export default function GoalsWeek() {
  const { kidId } = useParams<{ kidId: string }>();
  const links = useTherapistLinks();
  const [weekShift, setWeekShift] = useState(0);
  const [view, setView] = useState<'left' | 'done'>('left');
  const [cat, setCat] = useState<string | null>(null);

  const today = startOfDay(new Date());
  const sunday = startOfWeek(addWeeks(today, weekShift), { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(sunday); d.setDate(sunday.getDate() + i); return d; });
  const weekEnd = new Date(days[6]); weekEnd.setHours(23, 59, 59, 999);
  const weekOf = format(sunday, 'yyyy-MM-dd');
  const isThisWeek = weekShift === 0;

  const { data: kidRes } = useQuery({ queryKey: ['kid', kidId], queryFn: () => kidsApi.getById(kidId!), enabled: !!kidId });
  const { data: goalsRes, isLoading: goalsLoading } = useQuery({ queryKey: ['goals', kidId], queryFn: () => goalsApi.getForKid(kidId!), enabled: !!kidId });
  const { data: formsRes, isLoading: formsLoading } = useQuery({ queryKey: ['forms', kidId, 'week', weekOf], queryFn: () => formsApi.getForKid(kidId!, { weekOf }), enabled: !!kidId });
  const { data: sessionsRes } = useQuery({ queryKey: ['sessions', kidId], queryFn: () => sessionsApi.getForKid(kidId!), enabled: !!kidId });
  const { data: practRes } = useQuery({ queryKey: ['practitioners', kidId], queryFn: () => practitionersApi.getForKid(kidId!), enabled: !!kidId });

  const kid = kidRes?.data;
  const practitioners: Practitioner[] = practRes?.data || [];
  const firstName = (id?: string | null) => {
    const p = practitioners.find(x => x.id === id);
    return p ? p.name.split(' ')[0] : null;
  };

  const week = useMemo(() => {
    const goals: Goal[] = (goalsRes?.data || []).filter(g => g.isActive);
    const sessions: Session[] = (sessionsRes?.data || [])
      .filter(s => (!s.type || s.type === 'therapy') && s.status !== 'missed')
      .filter(s => { const d = toDate(s.scheduledDate); return d >= sunday && d <= weekEnd; });
    const sessionIds = new Set((sessionsRes?.data || []).map(s => s.id));
    // forms of this week, without orphans (their session was deleted)
    const forms: SessionForm[] = (formsRes?.data || [])
      .filter(f => !f.sessionId || !sessionsRes || sessionIds.has(f.sessionId))
      .filter(f => { const d = toDate(f.sessionDate); return d >= sunday && d <= weekEnd; })
      .sort((a, b) => toDate(a.sessionDate).getTime() - toDate(b.sessionDate).getTime());

    const visits = new Map<string, Visit[]>();
    for (const f of forms) {
      for (const g of f.goalsWorkedOn || []) {
        if (!visits.has(g.goalId)) visits.set(g.goalId, []);
        visits.get(g.goalId)!.push({ date: toDate(f.sessionDate), who: f.practitionerId });
      }
    }

    const filledSessionIds = new Set(forms.map(f => f.sessionId).filter(Boolean));
    const strip = days.map(d => {
      const dayForms = forms.filter(f => isSameDay(toDate(f.sessionDate), d));
      const daySessions = sessions.filter(s => isSameDay(toDate(s.scheduledDate), d));
      const unfilled = daySessions.filter(s => !s.formId && !filledSessionIds.has(s.id));
      const past = d <= today;
      const who = [...new Set([...dayForms.map(f => f.practitionerId), ...unfilled.map(s => s.therapistId)])];
      return {
        date: d,
        isToday: isSameDay(d, today),
        filled: dayForms.length > 0,
        missing: past && unfilled.length > 0,       // a session that happened but has no form yet
        planned: !past && daySessions.length > 0,
        who,
      };
    });

    const cats = GOAL_CATEGORIES.map(c => {
      const list = goals.filter(g => g.categoryId === c.id);
      return { ...c, tone: CATEGORY_TONE[c.id] || 'lilac', goals: list, done: list.filter(g => visits.has(g.id)).length };
    }).filter(c => c.goals.length > 0);

    const done = goals.filter(g => visits.has(g.id)).length;
    const times = goals.reduce((s, g) => s + (visits.get(g.id)?.length || 0), 0);
    return { goals, visits, strip, cats, done, times, sessionsCount: forms.length, missingCount: strip.filter(d => d.missing).length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalsRes, formsRes, sessionsRes, weekOf]);

  const loading = goalsLoading || formsLoading;
  const total = week.goals.length;
  const left = total - week.done;
  const shownCats = week.cats.filter(c => !cat || c.id === cat);
  const restDays = days.filter(d => d > today).map(d => DAYS[d.getDay()]);

  const visitTag = (v: Visit, i: number) => (
    <span key={i} className={`wk-visit tone-${kidColor(v.who)}`}>{firstName(v.who) || 'מטפלת'} · {DAYS[v.date.getDay()]}</span>
  );

  return (
    <div className="wk">
      <div className="wk-head">
        <Link to={links.kidDetail(kidId!)} className="wk-back" aria-label="חזרה לדף הילד"><Icon name="back" size={20} /></Link>
        <div className="wk-title">
          <h1>{isThisWeek ? 'השבוע' : 'שבוע'} של {kid?.name?.split(' ')[0] || '…'}</h1>
          <span className="tabular">{format(days[0], 'd.M')}–{format(days[6], 'd.M')}{isThisWeek ? ` · היום יום ${DAYS[today.getDay()]}` : ''}</span>
        </div>
        <div className="wk-nav">
          <button type="button" onClick={() => setWeekShift(w => w - 1)} aria-label="שבוע קודם"><Icon name="back" size={18} /></button>
          {!isThisWeek && <button type="button" className="wk-now" onClick={() => setWeekShift(0)}>השבוע</button>}
          <button type="button" onClick={() => setWeekShift(w => w + 1)} disabled={isThisWeek} aria-label="שבוע הבא"><Icon name="chevron" size={18} /></button>
        </div>
      </div>

      <div className="wk-strip" aria-label="סשנים בשבוע">
        {week.strip.map(d => (
          <div key={d.date.toISOString()} className={`wk-day${d.filled ? ' is-done' : ''}${d.missing ? ' is-missing' : ''}${d.planned ? ' is-planned' : ''}${d.isToday ? ' is-today' : ''}`}>
            <b>{DAYS[d.date.getDay()]}</b>
            <span>{d.who.length ? d.who.map(w => firstName(w) || 'מטפלת').join(', ') : d.isToday ? 'היום' : '—'}</span>
            {d.missing && <em title="היה טיפול ועוד לא מולא טופס">?</em>}
          </div>
        ))}
      </div>
      {week.missingCount > 0 && <p className="wk-warn">יש {week.missingCount === 1 ? 'טיפול אחד' : `${week.missingCount} טיפולים`} השבוע בלי טופס, אז התמונה עוד לא מלאה.</p>}

      {loading ? <p className="hand nb-muted">טוען…</p> : total === 0 ? (
        <div className="nb-card wk-empty"><p className="hand">לילד אין מטרות פעילות.</p></div>
      ) : (<>
        <div className="nb-card wk-sum">
          <div className="wk-big">
            <Ring done={week.done} total={total} size={78} stroke={12} tone="lilac" label={`${week.done} מתוך ${total}`} />
            <div>
              <b className="tabular">{week.done} / {total}</b>
              <span>מטרות שעבדנו עליהן {isThisWeek ? 'השבוע' : 'בשבוע הזה'}</span>
              <span className="tabular">{week.sessionsCount} {week.sessionsCount === 1 ? 'טופס' : 'טפסים'} · {week.times} פעמים בסך הכול</span>
            </div>
          </div>
          <div className="wk-rings" role="group" aria-label="סינון לפי תחום">
            {week.cats.map(c => (
              <button key={c.id} type="button" className="wk-ring" aria-pressed={cat === c.id} onClick={() => setCat(cat === c.id ? null : c.id)}>
                <Ring done={c.done} total={c.goals.length} size={52} stroke={9} tone={c.tone} label={`${c.nameHe}: ${c.done} מתוך ${c.goals.length}`} />
                <small>{c.nameHe}</small>
                <span className={`tabular${c.done === c.goals.length ? ' is-full' : ''}`}>{c.done}/{c.goals.length}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="wk-toggle" role="group" aria-label="תצוגה">
          <button type="button" aria-pressed={view === 'left'} onClick={() => setView('left')}>{isThisWeek ? 'נשאר השבוע' : 'לא נעבד'} · <span className="tabular">{left}</span></button>
          <button type="button" aria-pressed={view === 'done'} onClick={() => setView('done')}>עבדנו · <span className="tabular">{week.done}</span></button>
        </div>

        <div className="nb-card wk-list-card">
          <h2>{view === 'left' ? (isThisWeek ? 'עוד לא עבדנו השבוע' : 'לא עבדו בשבוע הזה') : (isThisWeek ? 'עבדנו השבוע' : 'עבדו בשבוע הזה')}</h2>
          <p className="wk-sub">
            {view === 'done' ? 'כמה פעמים, מי ובאיזה יום'
              : isThisWeek ? (restDays.length ? `נשארו ימים ${restDays.join(', ')}` : 'השבוע כמעט נגמר') : 'מטרות פעילות שלא סומנו בשום טופס'}
            {cat && <> · <button type="button" className="wk-clear" onClick={() => setCat(null)}>כל התחומים</button></>}
          </p>
          {shownCats.map(c => {
            const list = c.goals
              .filter(g => (view === 'left') !== week.visits.has(g.id))
              .sort((a, b) => (week.visits.get(b.id)?.length || 0) - (week.visits.get(a.id)?.length || 0));
            if (!list.length) {
              return view === 'left' ? (
                <div key={c.id} className={`wk-grp tone-${c.tone}`}>
                  <h3><span className="nb-dot" /> {c.nameHe}</h3>
                  <p className="wk-all">כל המטרות בתחום נעבדו {isThisWeek ? 'השבוע' : ''}</p>
                </div>
              ) : null;
            }
            return (
              <div key={c.id} className={`wk-grp tone-${c.tone}`}>
                <h3><span className="nb-dot" /> {c.nameHe}</h3>
                <ul>
                  {list.map(g => {
                    const v = week.visits.get(g.id) || [];
                    return view === 'left' ? (
                      <li key={g.id}><span className="wk-open" aria-hidden="true" /><span className="wk-t">{g.title}</span></li>
                    ) : (
                      <li key={g.id}>
                        <span className={`wk-count tabular${v.length === 1 ? ' is-one' : ''}`} aria-label={`${v.length} פעמים`}>×{v.length}</span>
                        <span className="wk-t">{g.title}<span className="wk-visits">{v.map(visitTag)}</span></span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </>)}
    </div>
  );
}
