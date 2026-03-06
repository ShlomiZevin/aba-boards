import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalDataApi, goalsApi } from '../api/client';
import { GOAL_CATEGORIES, normalizeTemplate, normalizeDcEntry, repeatedKey } from '../types';
import type { Goal, KidGoalDataEntry, GoalFormRow, GoalColumnDef, Practitioner } from '../types';
import { toDate } from '../utils/date';

// ---- Cell view (inline) ----
function CellView({ col, value }: { col: { type: string }; value: string }) {
  if (col.type === 'checkbox') {
    const checked = value === 'true' || value === '1';
    return <span style={{ color: checked ? '#16a34a' : '#ef4444', fontWeight: 600 }}>{checked ? '✓' : '✗'}</span>;
  }
  if (!value) return <span style={{ color: '#cbd5e1' }}>—</span>;
  if (col.type === 'date') {
    try {
      const d = new Date(value);
      return <span>{isNaN(d.getTime()) ? value : d.toLocaleDateString('he-IL')}</span>;
    } catch { return <span>{value}</span>; }
  }
  return <span style={{ whiteSpace: 'pre-wrap' }}>{value}</span>;
}

const thStyle: React.CSSProperties = {
  padding: '6px 10px', background: '#f8fafc', border: '1px solid #e2e8f0',
  textAlign: 'right', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap',
};
const tdStyle: React.CSSProperties = {
  padding: '6px 10px', border: '1px solid #e2e8f0', color: '#334155',
};
const tdMergedStyle: React.CSSProperties = {
  ...tdStyle, verticalAlign: 'middle', fontWeight: 500, color: '#475569', whiteSpace: 'nowrap',
};

// -------- Data Collection Section (view only) --------
function DataCollectionSection({ kidId, goal, practitioners }: {
  kidId: string;
  goal: Goal;
  practitioners: Practitioner[];
}) {
  const libraryItemId = goal.libraryItemId!;
  const queryKey = ['goal-data', kidId, libraryItemId];

  const templateBlocks = normalizeTemplate(goal.dataCollectionTemplate ?? null);

  const { data: entriesRes, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await goalDataApi.getEntries(kidId, libraryItemId);
      return res.data ?? [];
    },
  });

  if (isLoading) return <div style={{ color: '#94a3b8', fontSize: '0.83em' }}>טוען...</div>;

  const entries = (entriesRes as KidGoalDataEntry[]) || [];

  if (templateBlocks.length === 0) {
    return (
      <div style={{ color: '#94a3b8', fontSize: '0.85em' }}>
        תבנית איסוף הנתונים טרם הוגדרה.
      </div>
    );
  }

  if (entries.length === 0) {
    return <div style={{ color: '#94a3b8', fontSize: '0.85em' }}>טרם נרשמו נתונים</div>;
  }

  // Merge all block columns into a single unified column list
  const allColumns: GoalColumnDef[] = [];
  for (const block of templateBlocks) {
    for (const col of block.columns) {
      allColumns.push(col);
    }
  }

  if (allColumns.length === 0) {
    return <div style={{ color: '#94a3b8', fontSize: '0.85em' }}>טרם נרשמו נתונים</div>;
  }

  // Build flat rows: for each entry, merge rows across all blocks
  type FlatRow = {
    entryIdx: number;
    values: Record<string, string>;
    dateStr: string;
    therapistName: string;
    rowSpan: number;
    isFirst: boolean;
  };
  const flatRows: FlatRow[] = [];

  entries.forEach((e, entryIdx) => {
    const entryTables = normalizeDcEntry(e);
    const d = toDate(e.sessionDate as Parameters<typeof toDate>[0]);
    const dateStr = d ? d.toLocaleDateString('he-IL') : '—';
    const therapist = practitioners.find(p => p.id === e.practitionerId);
    const therapistName = therapist?.name || '—';

    // Find max rows across all blocks for this entry
    let maxRows = 1;
    for (const block of templateBlocks) {
      const exact = entryTables.find(t => t.tableId === block.id);
      let rows: GoalFormRow[];
      if (exact) {
        rows = exact.rows;
      } else if (templateBlocks.length === 1 && entryTables.length > 0) {
        rows = entryTables[0].rows;
      } else {
        rows = [];
      }
      if (rows.length > maxRows) maxRows = rows.length;
    }

    for (let rowIdx = 0; rowIdx < maxRows; rowIdx++) {
      const values: Record<string, string> = {};
      for (const block of templateBlocks) {
        const exact = entryTables.find(t => t.tableId === block.id);
        let rows: GoalFormRow[];
        if (exact) {
          rows = exact.rows;
        } else if (templateBlocks.length === 1 && entryTables.length > 0) {
          rows = entryTables[0].rows;
        } else {
          rows = [];
        }
        const row = rows[rowIdx] || {};
        for (const col of block.columns) {
          if (col.type === 'repeated' && col.repeatCount) {
            for (let i = 0; i < col.repeatCount; i++) {
              const key = repeatedKey(col.id, i);
              values[key] = row[key] || '';
            }
          } else {
            values[col.id] = row[col.id] || '';
          }
        }
      }
      flatRows.push({
        entryIdx,
        values,
        dateStr,
        therapistName,
        rowSpan: rowIdx === 0 ? maxRows : 0,
        isFirst: rowIdx === 0,
      });
    }
  });

  const desktopTable = (
    <table className="dc-view-table">
      <thead>
        <tr>
          <th style={thStyle}>תאריך</th>
          <th style={thStyle}>מטפל/ת</th>
          {allColumns.map(col => col.type === 'repeated' ? (
            <th key={col.id} colSpan={col.repeatCount || 1} style={{ ...thStyle, textAlign: 'center' }}>
              {col.label}
              {col.description && <div style={{ fontSize: '0.78em', color: '#94a3b8', fontWeight: 400 }}>{col.description}</div>}
            </th>
          ) : (
            <th key={col.id} style={thStyle}>
              {col.label}
              {col.description && <div style={{ fontSize: '0.78em', color: '#94a3b8', fontWeight: 400 }}>{col.description}</div>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {flatRows.map((fr, idx) => (
          <tr key={idx} style={{ background: fr.entryIdx % 2 === 0 ? 'white' : '#fafafa' }}>
            {fr.isFirst && (
              <td style={tdMergedStyle} rowSpan={fr.rowSpan}>{fr.dateStr}</td>
            )}
            {fr.isFirst && (
              <td style={tdMergedStyle} rowSpan={fr.rowSpan}>{fr.therapistName}</td>
            )}
            {allColumns.flatMap(col => {
              if (col.type === 'repeated') {
                const count = col.repeatCount || 1;
                const innerCol = { type: (col.innerType || 'checkbox') as string };
                return Array.from({ length: count }).map((_, i) => {
                  const key = repeatedKey(col.id, i);
                  return (
                    <td key={key} style={{ ...tdStyle, textAlign: 'center', padding: '4px 3px' }}>
                      <CellView col={innerCol} value={fr.values[key] || ''} />
                    </td>
                  );
                });
              }
              return [(
                <td key={col.id} style={tdStyle}>
                  <CellView col={col} value={fr.values[col.id] || ''} />
                </td>
              )];
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <>
      {/* Desktop: table view */}
      <div className="dc-view-table-wrap dc-view-desktop">
        {desktopTable}
      </div>

      {/* Mobile: card view per entry */}
      <div className="dc-view-mobile">
        {entries.map((e, entryIdx) => {
          const d = toDate(e.sessionDate as Parameters<typeof toDate>[0]);
          const dateStr = d ? d.toLocaleDateString('he-IL') : '—';
          const therapist = practitioners.find(p => p.id === e.practitionerId);
          const therapistName = therapist?.name || '—';
          const entryTables = normalizeDcEntry(e);

          return (
            <div key={entryIdx} className="dc-view-entry-card">
              <div className="dc-view-entry-header">
                <span>{dateStr}</span>
                <span style={{ color: '#64748b' }}>{therapistName}</span>
              </div>
              {templateBlocks.map(block => {
                const exact = entryTables.find(t => t.tableId === block.id);
                let rows: GoalFormRow[];
                if (exact) {
                  rows = exact.rows;
                } else if (templateBlocks.length === 1 && entryTables.length > 0) {
                  rows = entryTables[0].rows;
                } else {
                  rows = [];
                }
                return rows.map((row, rowIdx) => (
                  <div key={`${block.id}-${rowIdx}`} className="dc-view-entry-fields">
                    {block.columns.map(col => {
                      if (col.type === 'repeated') {
                        const count = col.repeatCount || 1;
                        const innerCol = { type: (col.innerType || 'checkbox') as string };
                        return (
                          <div key={col.id} className="dc-view-entry-field">
                            <span className="dc-view-entry-label">
                              {col.label}
                              {col.description && <span style={{ display: 'block', fontSize: '0.82em', color: '#94a3b8', fontWeight: 400 }}>{col.description}</span>}
                            </span>
                            <span className="dc-view-entry-value" style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                              {Array.from({ length: count }).map((_, i) => {
                                const key = repeatedKey(col.id, i);
                                return (
                                  <span key={key} style={{ border: '1px solid #e2e8f0', borderRadius: 4, padding: '0 4px', minWidth: 20, textAlign: 'center', display: 'inline-block' }}>
                                    <CellView col={innerCol} value={row[key] || ''} />
                                  </span>
                                );
                              })}
                            </span>
                          </div>
                        );
                      }
                      return (
                        <div key={col.id} className="dc-view-entry-field">
                          <span className="dc-view-entry-label">
                            {col.label}
                            {col.description && <span style={{ display: 'block', fontSize: '0.82em', color: '#94a3b8', fontWeight: 400 }}>{col.description}</span>}
                          </span>
                          <span className="dc-view-entry-value">
                            <CellView col={col} value={row[col.id] || ''} />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ));
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}

// -------- Goal Card (DC only, view only) --------
function GoalDcCard({ kidId, goal, practitioners }: {
  kidId: string;
  goal: Goal;
  practitioners: Practitioner[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 8, overflow: 'hidden', background: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button type="button" onClick={() => setExpanded(e => !e)} style={{
          display: 'flex', flex: 1, alignItems: 'center', gap: 10,
          padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right',
        }}>
          <span style={{ fontSize: '0.9em', flex: 1, fontWeight: 500, color: '#334155' }}>{goal.title}</span>
          <span style={{ color: '#94a3b8', fontSize: '0.85em' }}>{expanded ? '▲' : '▼'}</span>
        </button>
        <button type="button" onClick={() => setFullscreen(true)} className="dc-view-desktop"
          style={{
            background: 'none', border: '1px solid #e2e8f0', borderRadius: 6,
            cursor: 'pointer', color: '#64748b', padding: '3px 8px', fontSize: '0.75em',
            marginLeft: 8, flexShrink: 0,
          }}
          title="הצג במסך מלא"
        >⛶</button>
      </div>

      {/* Fullscreen modal */}
      {fullscreen && (
        <div className="modal-overlay" onClick={() => setFullscreen(false)} style={{ zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'white', borderRadius: 12, width: '95vw', maxHeight: '92vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: '0.95em', color: '#334155' }}>{goal.title}</span>
              <button type="button" onClick={() => setFullscreen(false)}
                style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', color: '#64748b', padding: '4px 12px', fontSize: '0.82em' }}>
                סגור
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '12px 18px' }}>
              <DataCollectionSection kidId={kidId} goal={goal} practitioners={practitioners} />
            </div>
          </div>
        </div>
      )}

      {expanded && (
        <div style={{ padding: '0 14px 14px 14px' }}>
          <DataCollectionSection kidId={kidId} goal={goal} practitioners={practitioners} />
        </div>
      )}
    </div>
  );
}

// -------- Main tab --------
interface Props {
  kidId: string;
  goals: Goal[];
  practitioners: Practitioner[];
  isReadOnly: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  practitionerId?: string;
}

export default function GoalPlansTab({ kidId, goals, practitioners, isAdmin }: Props) {
  const queryClient = useQueryClient();
  const activeGoals = goals.filter(g => g.isActive && g.libraryItemId);
  const noTemplateGoals = goals.filter(g => g.isActive && !g.libraryItemId);

  const [migrateResult, setMigrateResult] = useState<{
    matched: { goalId: string; title: string }[];
    unmatched: { goalId: string; title: string }[];
  } | null>(null);

  const migrateMutation = useMutation({
    mutationFn: () => goalsApi.migrateLibraryLinks(kidId),
    onSuccess: (res) => {
      if (res.success && res.data) {
        setMigrateResult(res.data);
        queryClient.invalidateQueries({ queryKey: ['goals', kidId] });
      }
    },
  });

  if (activeGoals.length === 0 && noTemplateGoals.length === 0) {
    return (
      <div className="content-card">
        <div className="empty-state"><p>אין מטרות פעילות עבור ילד/ה זה</p></div>
      </div>
    );
  }

  const byCategory = GOAL_CATEGORIES.map(cat => ({
    cat,
    goals: activeGoals.filter(g => g.categoryId === cat.id),
  })).filter(({ goals }) => goals.length > 0);

  return (
    <div className="content-card">
      <h3 style={{ marginBottom: 16, color: '#334155' }}>איסוף נתונים</h3>

      {byCategory.map(({ cat, goals: catGoals }) => (
        <div key={cat.id} style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: '0.8em', fontWeight: 700, color: cat.color,
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
            borderBottom: `2px solid ${cat.color}20`, paddingBottom: 4,
          }}>
            {cat.nameHe} ({catGoals.length})
          </div>
          {catGoals.map(goal => (
            <GoalDcCard key={goal.id} kidId={kidId} goal={goal} practitioners={practitioners} />
          ))}
        </div>
      ))}

      {/* Orphaned goals — admin can trigger auto-link */}
      {noTemplateGoals.length > 0 && !migrateResult && (
        <div style={{ marginTop: 16, padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.85em', color: '#475569', marginBottom: isAdmin ? 10 : 0 }}>
            <strong>{noTemplateGoals.length}</strong> מטרות ישנות אינן מקושרות לספריית המטרות ולכן לא יוצגו כאן.
          </div>
          {isAdmin && (
            <>
              <div style={{ fontSize: '0.78em', color: '#94a3b8', marginBottom: 10 }}>
                לחץ לניסיון קישור אוטומטי לפי שם — <strong>רק libraryItemId יתווסף</strong>, שום דבר אחר לא ישתנה.
              </div>
              <button
                type="button"
                className="btn-primary btn-small"
                onClick={() => migrateMutation.mutate()}
                disabled={migrateMutation.isPending}
              >
                {migrateMutation.isPending ? 'מקשר...' : '🔗 קשר אוטומטית לספרייה'}
              </button>
              {migrateMutation.isError && (
                <div style={{ color: '#ef4444', fontSize: '0.8em', marginTop: 6 }}>
                  {(migrateMutation.error as Error)?.message || 'שגיאה'}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Migration results */}
      {migrateResult && (
        <div style={{ marginTop: 16, padding: '12px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
          <div style={{ fontWeight: 600, fontSize: '0.88em', color: '#166534', marginBottom: 8 }}>
            תוצאות הקישור האוטומטי
          </div>
          {migrateResult.matched.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: '0.8em', color: '#166534', fontWeight: 600, marginBottom: 4 }}>
                ✅ קושרו ({migrateResult.matched.length}):
              </div>
              <ul style={{ margin: 0, paddingRight: 16, fontSize: '0.8em', color: '#334155' }}>
                {migrateResult.matched.map(g => <li key={g.goalId}>{g.title}</li>)}
              </ul>
            </div>
          )}
          {migrateResult.unmatched.length > 0 && (
            <div>
              <div style={{ fontSize: '0.8em', color: '#92400e', fontWeight: 600, marginBottom: 4 }}>
                ⚠️ לא נמצא התאמה ({migrateResult.unmatched.length}) — שם שונה בספרייה:
              </div>
              <ul style={{ margin: 0, paddingRight: 16, fontSize: '0.8em', color: '#78350f' }}>
                {migrateResult.unmatched.map(g => <li key={g.goalId}>{g.title}</li>)}
              </ul>
            </div>
          )}
          <div style={{ fontSize: '0.76em', color: '#94a3b8', marginTop: 10 }}>
            רענן את הדף כדי לראות את המטרות המקושרות בטאב.
          </div>
          <button type="button" className="btn-secondary btn-small" style={{ marginTop: 8 }} onClick={() => setMigrateResult(null)}>
            סגור
          </button>
        </div>
      )}
    </div>
  );
}
