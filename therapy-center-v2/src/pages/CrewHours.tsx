import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { crewHoursApi } from '../api/client';
import type { CrewHoursEntry } from '../api/client';

import Icon from '../v2/Icon';
import { kidColor } from '../v2/kidColor';
import '../v2/pages/tm.css';

/** Big tabular figure: "3:00" (hours:minutes) */
function fmtClock(m: number) {
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

function fmtHours(m: number) {
  const h = Math.floor(m / 60);
  const mins = m % 60;
  if (h === 0) return `${mins} דק׳`;
  if (mins === 0) return `${h} שע׳`;
  return `${h}:${String(mins).padStart(2, '0')} שע׳`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('he-IL', { weekday: 'short' });
  return `${day} ${d.getDate()}/${d.getMonth() + 1}`;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtTimeRange(iso: string, durationMin: number) {
  const start = new Date(iso);
  const end = new Date(start.getTime() + durationMin * 60000);
  const s = fmtTime(start.toISOString());
  const e = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
  return `${s} – ${e}`;
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function localDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function getMonthRange(offset: number) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const from = localDateStr(d);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const to = localDateStr(last);
  const label = d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
  return { from, to, label };
}

export default function CrewHours() {
  const [monthOffset, setMonthOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { from, to, label: monthLabel } = useMemo(() => getMonthRange(monthOffset), [monthOffset]);

  const { data: response, isLoading } = useQuery({
    queryKey: ['crew-hours', from, to],
    queryFn: () => crewHoursApi.get({ from, to }),
  });

  const entries: CrewHoursEntry[] = response?.data || [];
  const grandTotal = entries.reduce((s, e) => s + e.totalMinutes, 0);
  const grandSessions = entries.reduce((s, e) => s + e.sessionCount, 0);

  const periodChips = [
    { off: 0, label: 'החודש' },
    { off: -1, label: 'חודש שעבר' },
    { off: -2, label: 'לפני חודשיים' },
  ];
  const maxKidMinutes = (entry: CrewHoursEntry) => Math.max(1, ...entry.kids.map(k => k.totalMinutes));

  return (
    <div className="tm-hours">
      <header className="tm-head">
        <div>
          <h1 className="nb-h1">שעות <mark className="hl-sky">צוות</mark></h1>
          <p className="nb-muted tm-sub">{monthLabel}</p>
        </div>
      </header>

      <div className="tm-period">
        <div className="tm-chips" role="group" aria-label="תקופה">
          {periodChips.map(c => (
            <button key={c.off} type="button" className={`tm-pick${monthOffset === c.off ? ' is-on' : ''}`} aria-pressed={monthOffset === c.off} onClick={() => setMonthOffset(c.off)}>
              {c.label}
            </button>
          ))}
        </div>
        {/* RTL: the right arrow goes back in time, the left arrow forward */}
        <div className="tm-month">
          <button type="button" className="tm-ic" onClick={() => setMonthOffset(o => o - 1)} aria-label="חודש קודם"><Icon name="back" /></button>
          <span className="tm-month-label">{monthLabel}</span>
          <button type="button" className="tm-ic" onClick={() => setMonthOffset(o => o + 1)} disabled={monthOffset >= 0} aria-label="חודש הבא"><Icon name="chevron" /></button>
        </div>
      </div>

      {isLoading && <p className="hand nb-muted">טוען…</p>}

      {!isLoading && entries.length === 0 && (
        <div className="nb-card tm-empty">
          <p className="hand">אין נתוני שעות לחודש זה</p>
        </div>
      )}

      {!isLoading && entries.length > 0 && (
        <>
          <div className="tm-totals">
            <span className="tm-total tone-yellow" style={{ ['--rot' as string]: '-2deg' }}><b className="tabular">{fmtClock(grandTotal)}</b> שעות סה״כ</span>
            <span className="tm-total tone-mint" style={{ ['--rot' as string]: '1.5deg' }}><b className="tabular">{grandSessions}</b> {grandSessions === 1 ? 'טיפול' : 'טיפולים'}</span>
            <span className="tm-total tone-pink" style={{ ['--rot' as string]: '-1deg' }}><b className="tabular">{entries.length}</b> אנשי צוות</span>
          </div>

          <ul className="tm-crew">
            {entries.map((entry) => {
              const isExpanded = expandedId === entry.practitionerId;
              const top = maxKidMinutes(entry);
              return (
                <li key={entry.practitionerId} className="nb-card tm-person">
                  <button type="button" className="tm-person-top" aria-expanded={isExpanded}
                    onClick={() => setExpandedId(isExpanded ? null : entry.practitionerId)}>
                    <span className={`nb-av tone-${kidColor(entry.practitionerId)}`} aria-hidden="true">{entry.practitionerName.charAt(0)}</span>
                    <span className="tm-person-name">
                      <b>{entry.practitionerName}</b>
                      {entry.practitionerType && <span className="nb-chip">{entry.practitionerType}</span>}
                    </span>
                    <span className="tm-big">
                      <b>{fmtClock(entry.totalMinutes)}</b>
                      <small>{entry.sessionCount} {entry.sessionCount === 1 ? 'טיפול' : 'טיפולים'}</small>
                    </span>
                    <Icon name="chevron" className="tm-chev" size={20} />
                  </button>

                  {/* Per-kid breakdown */}
                  <ul className="tm-kids">
                    {entry.kids.map(kid => (
                      <li key={kid.kidId} className="tm-kid">
                        <span>
                          {kid.kidName}
                          <span className={`tm-bar tone-${kidColor(kid.kidId)}`} aria-hidden="true"><i style={{ width: `${Math.round(kid.totalMinutes / top * 100)}%` }} /></span>
                        </span>
                        <span className="tm-kid-n">{kid.sessionCount} {kid.sessionCount === 1 ? 'טיפול' : 'טיפולים'}</span>
                        <span className="tm-kid-h">{fmtHours(kid.totalMinutes)}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Drill-down: every session */}
                  {isExpanded && (
                    <div className="tm-sessions">
                      <h3>פירוט טיפולים</h3>
                      <ul className="tm-sess">
                        {entry.sessions.map((s, i) => (
                          <li key={i}>
                            <span className="s-d">{fmtDate(s.date)}</span>
                            <span className="s-k">{s.kidName}</span>
                            <span className="s-t">{fmtTimeRange(s.date, s.duration)}</span>
                            <span className="s-dur">{fmtHours(s.duration)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
