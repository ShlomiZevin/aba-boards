import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { crewHoursApi } from '../api/client';
import type { CrewHoursEntry } from '../api/client';

const CREW_COLORS = ['#667eea', '#0891b2', '#7c3aed', '#059669', '#d97706', '#db2777', '#2563eb', '#dc2626'];
function crewColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i) | 0;
  return CREW_COLORS[Math.abs(h) % CREW_COLORS.length];
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

  return (
    <div className="content-card">
      <div className="content-card-header">
        <h2>שעות צוות</h2>
      </div>

      {/* Month navigation — RTL: right arrow (&#9654;) = back in time, left arrow (&#9664;) = forward */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 24 }}>
        <button
          onClick={() => setMonthOffset(o => o - 1)}
          className="btn-secondary"
          style={{ padding: '6px 14px', fontSize: 14, minWidth: 0 }}
        >&#9654;</button>
        <span style={{ fontSize: 16, fontWeight: 600, minWidth: 140, textAlign: 'center' }}>
          {monthLabel}
        </span>
        <button
          onClick={() => setMonthOffset(o => o + 1)}
          disabled={monthOffset >= 0}
          className="btn-secondary"
          style={{ padding: '6px 14px', fontSize: 14, minWidth: 0, opacity: monthOffset >= 0 ? 0.35 : 1 }}
        >&#9664;</button>
        {monthOffset !== 0 && (
          <button onClick={() => setMonthOffset(0)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: 13, minWidth: 0 }}>
            החודש
          </button>
        )}
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', fontSize: 14 }}>טוען...</div>
      )}

      {!isLoading && entries.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', fontSize: 14 }}>
          אין נתוני שעות לחודש זה
        </div>
      )}

      {!isLoading && entries.length > 0 && (
        <>
          {/* Summary row */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 20, fontSize: 14, color: '#64748b' }}>
            <span><strong style={{ color: '#2d3748', fontSize: 16 }}>{fmtHours(grandTotal)}</strong> סה״כ</span>
            <span><strong style={{ color: '#2d3748', fontSize: 16 }}>{grandSessions}</strong> {grandSessions === 1 ? 'טיפול' : 'טיפולים'}</span>
            <span><strong style={{ color: '#2d3748', fontSize: 16 }}>{entries.length}</strong> אנשי צוות</span>
          </div>

          {/* Practitioner rows */}
          {entries.map((entry) => {
            const isExpanded = expandedId === entry.practitionerId;
            return (
              <div key={entry.practitionerId} style={{ borderBottom: '1px solid #f0f4f8' }}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.practitionerId)}
                  style={{
                    display: 'flex', alignItems: 'center', width: '100%', padding: '14px 4px',
                    background: 'none', border: 'none', cursor: 'pointer', gap: 12, textAlign: 'right',
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: crewColor(entry.practitionerId), color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, flexShrink: 0,
                  }}>
                    {entry.practitionerName.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 500, fontSize: 14 }}>{entry.practitionerName}</span>
                    {entry.practitionerType && (
                      <span style={{ fontSize: 12, color: '#9ca3af', marginRight: 8 }}>{entry.practitionerType}</span>
                    )}
                  </div>
                  <span style={{ fontSize: 13, color: '#64748b', minWidth: 60, textAlign: 'center' }}>{entry.sessionCount} {entry.sessionCount === 1 ? 'טיפול' : 'טיפולים'}</span>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#2d3748', minWidth: 70, textAlign: 'left' }}>{fmtHours(entry.totalMinutes)}</span>
                  <span style={{
                    fontSize: 11, color: '#9ca3af', transition: 'transform 0.2s',
                    transform: isExpanded ? 'rotate(90deg)' : 'none',
                  }}>◄</span>
                </button>

                {/* Drill-down */}
                {isExpanded && (
                  <div style={{ padding: '0 4px 16px 4px', marginRight: 44 }}>
                    {/* Per-kid summary */}
                    {entry.kids.length > 1 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 4 }}>לפי ילד/ה</div>
                        {entry.kids.map(kid => (
                          <div key={kid.kidId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', padding: '2px 0' }}>
                            <span>{kid.kidName}</span>
                            <span>{fmtHours(kid.totalMinutes)} · {kid.sessionCount} {kid.sessionCount === 1 ? 'טיפול' : 'טיפולים'}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Session details table */}
                    <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 4 }}>פירוט טיפולים</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #f0f4f8' }}>
                          <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 600, color: '#9ca3af', fontSize: 11 }}>תאריך</th>
                          <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 600, color: '#9ca3af', fontSize: 11 }}>ילד/ה</th>
                          <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 600, color: '#9ca3af', fontSize: 11 }}>שעות</th>
                          <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 600, color: '#9ca3af', fontSize: 11 }}>משך</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.sessions.map((s, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f8f9fa' }}>
                            <td style={{ padding: '5px 4px', color: '#4a5568' }}>{fmtDate(s.date)}</td>
                            <td style={{ padding: '5px 4px', color: '#64748b' }}>{s.kidName}</td>
                            <td style={{ padding: '5px 4px', textAlign: 'center', color: '#4a5568', fontSize: 12, direction: 'ltr' }}>{fmtTimeRange(s.date, s.duration)}</td>
                            <td style={{ padding: '5px 4px', textAlign: 'left', fontWeight: 500, color: '#2d3748' }}>{fmtHours(s.duration)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
