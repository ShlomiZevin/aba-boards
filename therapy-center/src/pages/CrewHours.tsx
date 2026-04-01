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

function getMonthRange(offset: number) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const from = d.toISOString().slice(0, 10);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const to = last.toISOString().slice(0, 10);
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

      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 24 }}>
        <button
          onClick={() => setMonthOffset(o => o + 1)}
          className="btn-secondary"
          style={{ padding: '6px 14px', fontSize: 14, minWidth: 0 }}
        >&#9654;</button>
        <span style={{ fontSize: 16, fontWeight: 600, minWidth: 140, textAlign: 'center' }}>
          {monthLabel}
        </span>
        <button
          onClick={() => setMonthOffset(o => o - 1)}
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

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f0f4f8' }}>
                <th style={{ textAlign: 'right', padding: '10px 6px', fontWeight: 600, color: '#64748b', fontSize: 12 }}>שם</th>
                <th style={{ textAlign: 'right', padding: '10px 6px', fontWeight: 600, color: '#64748b', fontSize: 12 }}>תפקיד</th>
                <th style={{ textAlign: 'center', padding: '10px 6px', fontWeight: 600, color: '#64748b', fontSize: 12 }}>טיפולים</th>
                <th style={{ textAlign: 'left', padding: '10px 6px', fontWeight: 600, color: '#64748b', fontSize: 12 }}>שעות</th>
                <th style={{ width: 30 }} />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isExpanded = expandedId === entry.practitionerId;
                return (
                  <tr
                    key={entry.practitionerId}
                    onClick={() => setExpandedId(isExpanded ? null : entry.practitionerId)}
                    style={{ borderBottom: '1px solid #f0f4f8', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '12px 6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: crewColor(entry.practitionerId), color: 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 700, flexShrink: 0,
                        }}>
                          {entry.practitionerName.charAt(0)}
                        </div>
                        <span style={{ fontWeight: 500 }}>{entry.practitionerName}</span>
                      </div>
                      {/* Expanded kid breakdown inline */}
                      {isExpanded && entry.kids.length > 0 && (
                        <div style={{ marginTop: 8, marginRight: 42 }}>
                          {entry.kids.map(kid => (
                            <div key={kid.kidId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', padding: '3px 0' }}>
                              <span>{kid.kidName}</span>
                              <span>{fmtHours(kid.totalMinutes)} · {kid.sessionCount} {kid.sessionCount === 1 ? 'טיפול' : 'טיפולים'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 6px', color: '#64748b', fontSize: 13, verticalAlign: 'top', paddingTop: 16 }}>{entry.practitionerType || '—'}</td>
                    <td style={{ padding: '12px 6px', textAlign: 'center', fontWeight: 500, verticalAlign: 'top', paddingTop: 16 }}>{entry.sessionCount}</td>
                    <td style={{ padding: '12px 6px', textAlign: 'left', fontWeight: 600, color: '#2d3748', verticalAlign: 'top', paddingTop: 16 }}>{fmtHours(entry.totalMinutes)}</td>
                    <td style={{ verticalAlign: 'top', paddingTop: 16, color: '#9ca3af', fontSize: 11, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>
                      ◄
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
