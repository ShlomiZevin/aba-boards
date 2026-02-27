import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalPlansApi, goalDataApi, goalsApi } from '../api/client';
import { GOAL_CATEGORIES, normalizeTemplate, normalizeLpData, normalizeDcEntry } from '../types';
import type { Goal, KidGoalLearningPlan, KidGoalDataEntry, GoalFormRow, TableBlockData, GoalTableBlock } from '../types';
import { EditableVerticalBlock, ReadOnlyVerticalBlock, EditableHorizontalBlock, ReadOnlyHorizontalBlock } from './GoalFormRenderer';
import GoalFileUpload from './GoalFileUpload';
import { toDate } from '../utils/date';

// Resolve block data with backward-compat fallback for old single-block data
function getBlockRows(
  normalizedTables: TableBlockData[],
  blockId: string,
  allBlocks: GoalTableBlock[],
  blockType: 'vertical' | 'horizontal'
): GoalFormRow[] {
  const exact = normalizedTables.find(t => t.tableId === blockId);
  if (exact) return exact.rows;

  // Old data has tableId='default' — fall back to it for the primary data holder
  const defaultData = normalizedTables.find(t => t.tableId === 'default');
  if (defaultData) {
    if (blockType === 'horizontal') {
      // Only use for the first horizontal block to avoid duplicating data
      const isFirstHorizontal = allBlocks.filter(b => b.type === 'horizontal')[0]?.id === blockId;
      if (isFirstHorizontal) return defaultData.rows;
    }
    // Single-block template: always use default data
    if (allBlocks.length === 1) return defaultData.rows;
  }

  return [];
}

// -------- Edit LP Modal --------
function EditLpModal({ kidId, goal, plan, onClose, onSaved }: {
  kidId: string;
  goal: Goal;
  plan: KidGoalLearningPlan | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const libraryItemId = goal.libraryItemId!;
  const templateBlocks = normalizeTemplate(goal.learningPlanTemplate ?? null);

  const [editState, setEditState] = useState<Record<string, GoalFormRow[]>>(() => {
    const normalized = normalizeLpData(plan);
    const state: Record<string, GoalFormRow[]> = {};
    for (const block of templateBlocks) {
      const rows = getBlockRows(normalized, block.id, templateBlocks, block.type);
      state[block.id] = rows.length > 0 ? rows : (block.type === 'vertical' ? [{}] : []);
    }
    return state;
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const tables: TableBlockData[] = templateBlocks.map(block => ({
        tableId: block.id,
        rows: editState[block.id] || [],
      }));
      return goalPlansApi.save(kidId, libraryItemId, { goalTitle: goal.title, tables });
    },
    onSuccess: onSaved,
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 760, width: '96vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0 }}>עריכת תוכנית למידה</h3>
            <div style={{ fontSize: '0.82em', color: '#64748b', marginTop: 2 }}>{goal.title}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3em', cursor: 'pointer', color: '#94a3b8', padding: '0 4px' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {templateBlocks.map(block => {
            const rows = editState[block.id] || [];
            return (
              <div key={block.id}>
                {block.type === 'vertical' ? (
                  <EditableVerticalBlock
                    block={block}
                    row={rows[0] || {}}
                    onChange={row => setEditState(prev => ({ ...prev, [block.id]: [row] }))}
                  />
                ) : (
                  <EditableHorizontalBlock
                    block={block}
                    rows={rows}
                    onChange={rows => setEditState(prev => ({ ...prev, [block.id]: rows }))}
                  />
                )}
              </div>
            );
          })}
        </div>

        {saveMutation.isError && (
          <div style={{ color: '#ef4444', fontSize: '0.82em', marginTop: 10, flexShrink: 0 }}>
            {(saveMutation.error as Error)?.message || 'שגיאה בשמירה'}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>ביטול</button>
          <button type="button" className="btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'שומר...' : 'שמור תוכנית'}
          </button>
        </div>
      </div>
    </div>
  );
}

// -------- Learning Plan Section --------
function LearningPlanSection({ kidId, goal, isReadOnly, isAdmin, isSuperAdmin, practitionerId }: {
  kidId: string;
  goal: Goal;
  isReadOnly: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  practitionerId?: string;
}) {
  const queryClient = useQueryClient();
  const libraryItemId = goal.libraryItemId!;
  const queryKey = ['goal-plan', kidId, libraryItemId];

  const templateBlocks = normalizeTemplate(goal.learningPlanTemplate ?? null);

  const { data: planRes, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await goalPlansApi.get(kidId, libraryItemId);
      return res.data ?? null;
    },
    retry: false,
  });

  const [showEdit, setShowEdit] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  if (isLoading) return <div style={{ color: '#94a3b8', fontSize: '0.83em' }}>טוען...</div>;

  const plan = planRes as KidGoalLearningPlan | null;
  const normalizedPlan = normalizeLpData(plan);
  const isPlanFilled = normalizedPlan.some(t => t.rows.length > 0);

  // No template defined
  if (templateBlocks.length === 0) {
    return (
      <div>
        <div style={{ color: '#94a3b8', fontSize: '0.85em', marginBottom: 8 }}>
          תבנית תוכנית הלמידה טרם הוגדרה.
        </div>
        {isAdmin && (
          <button type="button" className="btn-secondary btn-small" onClick={() => setShowUpload(true)}>
            📄 העלה קובץ
          </button>
        )}
        {showUpload && (
          <GoalFileUpload
            kidId={kidId} goal={goal} formType="lp"
            isSuperAdmin={isSuperAdmin} practitionerId={practitionerId}
            onClose={() => setShowUpload(false)}
            onSaved={() => { setShowUpload(false); queryClient.invalidateQueries({ queryKey }); }}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      {/* View — plan not filled */}
      {!isPlanFilled && (
        <div style={{ color: '#94a3b8', fontSize: '0.85em', marginBottom: 10 }}>תוכנית הלמידה טרם מולאה</div>
      )}

      {/* View — plan filled */}
      {isPlanFilled && (
        <>
          <div style={{ fontSize: '0.75em', color: '#94a3b8', marginBottom: 10 }}>
            עודכן: {toDate(plan!.updatedAt as Parameters<typeof toDate>[0])?.toLocaleDateString('he-IL') || '—'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {templateBlocks.map(block => {
              const rows = getBlockRows(normalizedPlan, block.id, templateBlocks, block.type);
              return (
                <div key={block.id}>
                  {block.type === 'vertical' ? (
                    <ReadOnlyVerticalBlock block={block} row={rows[0] || {}} />
                  ) : (
                    <ReadOnlyHorizontalBlock block={block} rows={rows} />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Action buttons */}
      {!isReadOnly && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary btn-small" onClick={() => setShowEdit(true)}>
            {isPlanFilled ? 'עריכה' : 'מלא תוכנית למידה'}
          </button>
          {isAdmin && (
            <button type="button" className="btn-secondary btn-small" onClick={() => setShowUpload(true)}>
              📄 העלה קובץ
            </button>
          )}
        </div>
      )}

      {showEdit && (
        <EditLpModal
          kidId={kidId} goal={goal} plan={plan}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); queryClient.invalidateQueries({ queryKey }); }}
        />
      )}
      {showUpload && (
        <GoalFileUpload
          kidId={kidId} goal={goal} formType="lp"
          isSuperAdmin={isSuperAdmin} practitionerId={practitionerId}
          onClose={() => setShowUpload(false)}
          onSaved={() => { setShowUpload(false); queryClient.invalidateQueries({ queryKey }); }}
        />
      )}
    </div>
  );
}

// -------- Data Collection Section --------
function DataCollectionSection({ kidId, goal, isReadOnly, isAdmin, isSuperAdmin, practitionerId }: {
  kidId: string;
  goal: Goal;
  isReadOnly: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  practitionerId?: string;
}) {
  const queryClient = useQueryClient();
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

  const [showForm, setShowForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newEntryState, setNewEntryState] = useState<Record<string, GoalFormRow>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function openForm() {
    const initState: Record<string, GoalFormRow> = {};
    for (const block of templateBlocks) initState[block.id] = {};
    setNewEntryState(initState);
    setShowForm(true);
  }

  const addMutation = useMutation({
    mutationFn: () => {
      const tables: TableBlockData[] = templateBlocks.map(block => ({
        tableId: block.id,
        rows: [newEntryState[block.id] || {}],
      }));
      return goalDataApi.addEntry(kidId, libraryItemId, {
        goalTitle: goal.title,
        sessionDate: newDate,
        practitionerId: practitionerId || undefined,
        tables,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setShowForm(false);
      setNewEntryState({});
      setNewDate(new Date().toISOString().slice(0, 10));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (entryId: string) => goalDataApi.deleteEntry(kidId, libraryItemId, entryId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); setConfirmDelete(null); },
  });

  if (isLoading) return <div style={{ color: '#94a3b8', fontSize: '0.83em' }}>טוען...</div>;

  const entries = (entriesRes as KidGoalDataEntry[]) || [];

  // No template defined
  if (templateBlocks.length === 0) {
    return (
      <div>
        <div style={{ color: '#94a3b8', fontSize: '0.85em', marginBottom: 8 }}>
          תבנית איסוף הנתונים טרם הוגדרה.
        </div>
        {isAdmin && (
          <button type="button" className="btn-secondary btn-small" onClick={() => setShowUpload(true)}>
            📄 העלה קובץ
          </button>
        )}
        {showUpload && (
          <GoalFileUpload
            kidId={kidId} goal={goal} formType="dc"
            isSuperAdmin={isSuperAdmin} practitionerId={practitionerId}
            onClose={() => setShowUpload(false)}
            onSaved={() => { setShowUpload(false); queryClient.invalidateQueries({ queryKey }); }}
          />
        )}
      </div>
    );
  }

  const dateValues: string[] = entries.map(e => {
    const d = toDate(e.sessionDate as Parameters<typeof toDate>[0]);
    return d ? d.toLocaleDateString('he-IL') : '—';
  });

  return (
    <div>
      {entries.length > 0 && (
        <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {templateBlocks.map(block => {
            const blockRows: GoalFormRow[] = entries.map(e => {
              const entryTables = normalizeDcEntry(e);
              const exact = entryTables.find(t => t.tableId === block.id);
              if (exact) return exact.rows[0] || {};
              // Old data fallback
              if (templateBlocks.length === 1 && entryTables.length > 0) return entryTables[0].rows[0] || {};
              return {};
            });

            return (
              <ReadOnlyHorizontalBlock
                key={block.id}
                block={block}
                rows={blockRows}
                firstColumn={{ label: 'תאריך', values: dateValues }}
                rowActions={isAdmin ? (rowIdx) => {
                  const entry = entries[rowIdx];
                  return confirmDelete === entry.id ? (
                    <span style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-danger btn-small" onClick={() => deleteMutation.mutate(entry.id)}>כן</button>
                      <button className="btn-secondary btn-small" onClick={() => setConfirmDelete(null)}>לא</button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setConfirmDelete(entry.id)}
                      style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: '0.85em', padding: '2px 4px' }}>
                      מחק
                    </button>
                  );
                } : undefined}
              />
            );
          })}
        </div>
      )}

      {entries.length === 0 && (
        <div style={{ color: '#94a3b8', fontSize: '0.85em', marginBottom: 8 }}>טרם נרשמו נתונים</div>
      )}

      {!isReadOnly && !showForm && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary btn-small" onClick={openForm}>
            + הוסף רשומה
          </button>
          {isAdmin && (
            <button type="button" className="btn-secondary btn-small" onClick={() => setShowUpload(true)}>
              📄 העלה קובץ
            </button>
          )}
        </div>
      )}

      {showUpload && (
        <GoalFileUpload
          kidId={kidId} goal={goal} formType="dc"
          isSuperAdmin={isSuperAdmin} practitionerId={practitionerId}
          onClose={() => setShowUpload(false)}
          onSaved={() => { setShowUpload(false); queryClient.invalidateQueries({ queryKey }); }}
        />
      )}

      {showForm && (
        <div style={{ border: '1px solid #667eea', borderRadius: 8, padding: '12px 14px', background: '#fafafa', marginTop: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 10, fontSize: '0.88em' }}>רשומה חדשה</div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85em', color: '#334155', marginBottom: 4 }}>תאריך</label>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ width: 160 }} />
          </div>
          {templateBlocks.map(block => (
            <div key={block.id} style={{ marginBottom: 12 }}>
              <EditableVerticalBlock
                block={block}
                row={newEntryState[block.id] || {}}
                onChange={row => setNewEntryState(prev => ({ ...prev, [block.id]: row }))}
              />
            </div>
          ))}
          {addMutation.isError && (
            <div style={{ color: '#ef4444', fontSize: '0.82em', marginTop: 6 }}>
              {(addMutation.error as Error)?.message || 'שגיאה בשמירה'}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" className="btn-secondary btn-small" onClick={() => { setShowForm(false); setNewEntryState({}); }}>ביטול</button>
            <button type="button" className="btn-primary btn-small" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              {addMutation.isPending ? 'שומר...' : 'שמור'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// -------- Goal Plan Card --------
function GoalPlanCard({ kidId, goal, isReadOnly, isAdmin, isSuperAdmin, practitionerId }: {
  kidId: string;
  goal: Goal;
  isReadOnly: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  practitionerId?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [section, setSection] = useState<'lp' | 'dc'>('lp');

  const lpBlocks = normalizeTemplate(goal.learningPlanTemplate ?? null);
  const dcBlocks = normalizeTemplate(goal.dataCollectionTemplate ?? null);
  const hasLp = lpBlocks.some(b => b.columns.length > 0);
  const hasDc = dcBlocks.some(b => b.columns.length > 0);

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 8, overflow: 'hidden', background: 'white' }}>
      <button type="button" onClick={() => setExpanded(e => !e)} style={{
        display: 'flex', width: '100%', alignItems: 'center', gap: 10,
        padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right',
      }}>
        <span style={{ fontSize: '0.9em', flex: 1, fontWeight: 500, color: '#334155' }}>{goal.title}</span>
        <span style={{ display: 'flex', gap: 4 }}>
          <span style={{
            fontSize: '0.68em', borderRadius: 10, padding: '1px 7px', fontWeight: 600,
            background: hasLp ? '#ede9fe' : '#f1f5f9',
            color: hasLp ? '#7c3aed' : '#94a3b8',
          }}>ת״ל</span>
          <span style={{
            fontSize: '0.68em', borderRadius: 10, padding: '1px 7px', fontWeight: 600,
            background: hasDc ? '#dcfce7' : '#f1f5f9',
            color: hasDc ? '#166534' : '#94a3b8',
          }}>א״נ</span>
        </span>
        <span style={{ color: '#94a3b8', fontSize: '0.85em' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '0 14px 14px 14px' }}>
          <div className="tabs" style={{ marginBottom: 12 }}>
            <button className={`tab-btn${section === 'lp' ? ' active' : ''}`} onClick={() => setSection('lp')}>
              תוכנית למידה
            </button>
            <button className={`tab-btn${section === 'dc' ? ' active' : ''}`} onClick={() => setSection('dc')}>
              איסוף נתונים
            </button>
          </div>

          {section === 'lp' && (
            <LearningPlanSection kidId={kidId} goal={goal} isReadOnly={isReadOnly} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} practitionerId={practitionerId} />
          )}
          {section === 'dc' && (
            <DataCollectionSection kidId={kidId} goal={goal} isReadOnly={isReadOnly} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} practitionerId={practitionerId} />
          )}
        </div>
      )}
    </div>
  );
}

// -------- Main tab --------
interface Props {
  kidId: string;
  goals: Goal[];
  isReadOnly: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  practitionerId?: string;
}

export default function GoalPlansTab({ kidId, goals, isReadOnly, isAdmin, isSuperAdmin, practitionerId }: Props) {
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
      <h3 style={{ marginBottom: 16, color: '#334155' }}>תוכניות ואיסוף נתונים</h3>

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
            <GoalPlanCard key={goal.id} kidId={kidId} goal={goal} isReadOnly={isReadOnly} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} practitionerId={practitionerId} />
          ))}
        </div>
      ))}

      {/* Orphaned goals — admin can trigger auto-link */}
      {noTemplateGoals.length > 0 && !migrateResult && (
        <div style={{ marginTop: 16, padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.85em', color: '#475569', marginBottom: isAdmin ? 10 : 0 }}>
            <strong>{noTemplateGoals.length}</strong> מטרות ישנות אינן מקושרות לספריית המטרות ולכן לא יוצגות כאן.
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
