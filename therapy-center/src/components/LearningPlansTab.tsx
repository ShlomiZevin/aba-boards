import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalPlansApi } from '../api/client';
import { GOAL_CATEGORIES, normalizeTemplate, normalizeLpData, emptyRowForColumns } from '../types';
import type { Goal, GoalFormRow, GoalTableBlock, TableBlockData, LearningPlanVersion } from '../types';
import {
  ReadOnlyVerticalBlock,
  ReadOnlyHorizontalBlock,
  EditableVerticalBlock,
  EditableHorizontalBlock,
} from './GoalFormRenderer';
import { toDate } from '../utils/date';
import ConfirmModal from './ConfirmModal';

// -------- Learning Plan Card (per goal) --------
function LearningPlanCard({ kidId, goal, isAdmin }: {
  kidId: string;
  goal: Goal;
  isAdmin: boolean;
}) {
  const queryClient = useQueryClient();
  const libraryItemId = goal.libraryItemId!;
  const templateBlocks = normalizeTemplate(goal.learningPlanTemplate ?? null);

  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [lpData, setLpData] = useState<Record<string, GoalFormRow[]>>({});
  const [dirty, setDirty] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versionLabel, setVersionLabel] = useState('');
  const [showVersionInput, setShowVersionInput] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<LearningPlanVersion | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const lpQueryKey = ['goal-lp', kidId, libraryItemId];
  const versionsQueryKey = ['goal-lp-versions', kidId, libraryItemId];

  const { data: planRes, isLoading } = useQuery({
    queryKey: lpQueryKey,
    queryFn: async () => {
      const res = await goalPlansApi.get(kidId, libraryItemId);
      if (!res.success) return null;
      return res.data ?? null;
    },
  });

  const { data: versionsRes, isLoading: versionsLoading } = useQuery({
    queryKey: versionsQueryKey,
    queryFn: async () => {
      const res = await goalPlansApi.getVersions(kidId, libraryItemId);
      return res.data ?? [];
    },
    enabled: showVersions && isAdmin,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const tables: TableBlockData[] = templateBlocks.map(block => ({
        tableId: block.id,
        rows: lpData[block.id] || [],
      }));
      return goalPlansApi.save(kidId, libraryItemId, { goalTitle: goal.title, tables });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lpQueryKey });
      setDirty(false);
    },
  });

  const saveVersionMutation = useMutation({
    mutationFn: async () => {
      return goalPlansApi.saveVersion(kidId, libraryItemId, { versionLabel: versionLabel.trim() || undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: versionsQueryKey });
      setVersionLabel('');
      setShowVersionInput(false);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (versionId: string) => goalPlansApi.restoreVersion(kidId, libraryItemId, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lpQueryKey });
      queryClient.invalidateQueries({ queryKey: versionsQueryKey });
      setConfirmRestore(null);
      setEditing(false);
      setDirty(false);
    },
  });

  const deleteVersionMutation = useMutation({
    mutationFn: (versionId: string) => goalPlansApi.deleteVersion(kidId, libraryItemId, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: versionsQueryKey });
      setConfirmDelete(null);
    },
  });

  function startEditing() {
    const existingTables = normalizeLpData(planRes ?? null);
    const data: Record<string, GoalFormRow[]> = {};
    for (const block of templateBlocks) {
      const existing = existingTables.find(t => t.tableId === block.id);
      if (existing && existing.rows.length > 0) {
        data[block.id] = existing.rows.map(r => ({ ...r }));
      } else if (templateBlocks.length === 1 && existingTables.length > 0 && existingTables[0].rows.length > 0) {
        data[block.id] = existingTables[0].rows.map(r => ({ ...r }));
      } else {
        data[block.id] = block.type === 'vertical' ? [emptyRowForColumns(block.columns)] : [];
      }
    }
    setLpData(data);
    setEditing(true);
    setDirty(false);
  }

  function cancelEditing() {
    if (dirty && !window.confirm('יש שינויים שלא נשמרו. לצאת בכל זאת?')) return;
    setEditing(false);
    setDirty(false);
  }

  async function handleSave() {
    await saveMutation.mutateAsync();
  }

  async function handleSaveVersion() {
    // First save current changes if dirty
    if (dirty) {
      await saveMutation.mutateAsync();
    }
    await saveVersionMutation.mutateAsync();
  }

  function updateBlockRows(blockId: string, rows: GoalFormRow[]) {
    setLpData(prev => ({ ...prev, [blockId]: rows }));
    setDirty(true);
  }

  function updateBlockRow(blockId: string, row: GoalFormRow) {
    setLpData(prev => ({ ...prev, [blockId]: [row] }));
    setDirty(true);
  }

  // Render form blocks (read-only or editable)
  function renderBlocks(blocks: GoalTableBlock[], data: TableBlockData[], editMode: boolean) {
    return blocks.map(block => {
      const blockData = data.find(t => t.tableId === block.id);
      let rows: GoalFormRow[];
      if (blockData) {
        rows = blockData.rows;
      } else if (blocks.length === 1 && data.length > 0) {
        rows = data[0].rows;
      } else {
        rows = [];
      }

      if (editMode) {
        if (block.type === 'vertical') {
          return (
            <div key={block.id} style={{ marginBottom: 16 }}>
              <EditableVerticalBlock
                block={block}
                row={lpData[block.id]?.[0] || emptyRowForColumns(block.columns)}
                onChange={(row) => updateBlockRow(block.id, row)}
              />
            </div>
          );
        }
        return (
          <div key={block.id} style={{ marginBottom: 16 }}>
            <EditableHorizontalBlock
              block={block}
              rows={lpData[block.id] || []}
              onChange={(rows) => updateBlockRows(block.id, rows)}
            />
          </div>
        );
      }

      // Read-only
      if (block.type === 'vertical') {
        return (
          <div key={block.id} style={{ marginBottom: 16 }}>
            <ReadOnlyVerticalBlock block={block} row={rows[0] || {}} />
          </div>
        );
      }
      return (
        <div key={block.id} style={{ marginBottom: 16 }}>
          <ReadOnlyHorizontalBlock block={block} rows={rows} />
        </div>
      );
    });
  }

  const existingTables = normalizeLpData(planRes ?? null);
  const hasPlanData = existingTables.some(t => t.rows.length > 0);
  const versions = (versionsRes as LearningPlanVersion[]) || [];

  // Content to render inside expanded area
  const content = (
    <>
      {isLoading && <div style={{ color: '#94a3b8', fontSize: '0.83em' }}>טוען...</div>}

      {!isLoading && !editing && (
        <>
          {!hasPlanData ? (
            <div style={{ color: '#94a3b8', fontSize: '0.85em', marginBottom: 12 }}>
              טרם הוגדרה תוכנית למידה עבור מטרה זו.
            </div>
          ) : (
            <div style={{ marginBottom: 12 }}>
              {renderBlocks(templateBlocks, existingTables, false)}
              {planRes?.updatedAt && (
                <div style={{ fontSize: '0.75em', color: '#94a3b8', marginTop: 8 }}>
                  עודכן: {(() => {
                    const d = toDate(planRes.updatedAt as Parameters<typeof toDate>[0]);
                    return d ? d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '';
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          {isAdmin && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn-primary btn-small" onClick={startEditing}>
                {hasPlanData ? 'ערוך' : 'מלא תוכנית'}
              </button>
              <button
                type="button"
                className="btn-secondary btn-small"
                onClick={() => setShowVersions(v => !v)}
              >
                {showVersions ? 'הסתר היסטוריה' : 'היסטוריית גרסאות'}
              </button>
            </div>
          )}
        </>
      )}

      {!isLoading && editing && (
        <>
          {renderBlocks(templateBlocks, existingTables, true)}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
            <button
              type="button"
              className="btn-primary btn-small"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'שומר...' : 'שמור'}
            </button>

            {!showVersionInput ? (
              <button
                type="button"
                className="btn-secondary btn-small"
                onClick={() => setShowVersionInput(true)}
                disabled={!hasPlanData && !dirty}
                title={!hasPlanData && !dirty ? 'שמור תוכנית לפני שמירת גרסה' : ''}
              >
                שמור גרסה
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="text"
                  value={versionLabel}
                  onChange={e => setVersionLabel(e.target.value)}
                  placeholder="תיאור (אופציונלי)"
                  style={{
                    border: '1px solid #cbd5e1', borderRadius: 6, padding: '4px 10px',
                    fontSize: '0.82em', width: 180,
                  }}
                />
                <button
                  type="button"
                  className="btn-primary btn-small"
                  onClick={handleSaveVersion}
                  disabled={saveVersionMutation.isPending || saveMutation.isPending}
                >
                  {saveVersionMutation.isPending ? 'שומר...' : 'אישור'}
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-small"
                  onClick={() => { setShowVersionInput(false); setVersionLabel(''); }}
                >
                  ביטול
                </button>
              </div>
            )}

            <button type="button" className="btn-secondary btn-small" onClick={cancelEditing}>
              ביטול
            </button>
          </div>

          {saveMutation.isError && (
            <div style={{ color: '#ef4444', fontSize: '0.8em', marginTop: 6 }}>
              {(saveMutation.error as Error)?.message || 'שגיאה בשמירה'}
            </div>
          )}
          {saveVersionMutation.isError && (
            <div style={{ color: '#ef4444', fontSize: '0.8em', marginTop: 6 }}>
              {(saveVersionMutation.error as Error)?.message || 'שגיאה בשמירת גרסה'}
            </div>
          )}
        </>
      )}

      {/* Version history (admin only) */}
      {showVersions && isAdmin && (
        <div style={{ marginTop: 16, border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', padding: 14 }}>
          <div style={{ fontWeight: 700, fontSize: '0.88em', color: '#475569', marginBottom: 10 }}>
            היסטוריית גרסאות
          </div>

          {versionsLoading && <div style={{ color: '#94a3b8', fontSize: '0.83em' }}>טוען...</div>}

          {!versionsLoading && versions.length === 0 && (
            <div style={{ color: '#94a3b8', fontSize: '0.83em' }}>אין גרסאות שמורות</div>
          )}

          {!versionsLoading && versions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {versions.map(v => {
                const d = toDate(v.createdAt as Parameters<typeof toDate>[0]);
                const dateStr = d
                  ? d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                  : '';
                const isViewing = viewingVersion?.id === v.id;

                return (
                  <div key={v.id} style={{
                    border: '1px solid #e2e8f0', borderRadius: 8, background: 'white', overflow: 'hidden',
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                      cursor: 'pointer',
                    }} onClick={() => setViewingVersion(isViewing ? null : v)}>
                      <span style={{ flex: 1, fontSize: '0.85em', color: '#334155' }}>
                        <span style={{ fontWeight: 600 }}>{dateStr}</span>
                        {v.versionLabel && (
                          <span style={{ color: '#64748b', marginRight: 8 }}>— {v.versionLabel}</span>
                        )}
                      </span>
                      <span style={{ color: '#94a3b8', fontSize: '0.78em' }}>{isViewing ? '▲' : '▼'}</span>
                    </div>

                    {isViewing && (
                      <div style={{ padding: '0 12px 12px 12px', borderTop: '1px solid #f1f5f9' }}>
                        <div style={{ marginTop: 10 }}>
                          {renderBlocks(templateBlocks, v.tables || [], false)}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                          <button
                            type="button"
                            className="btn-primary btn-small"
                            onClick={() => setConfirmRestore(v.id)}
                            disabled={restoreMutation.isPending}
                          >
                            שחזר גרסה זו
                          </button>
                          <button
                            type="button"
                            style={{
                              background: 'none', border: '1px solid #fca5a5', borderRadius: 6,
                              color: '#ef4444', cursor: 'pointer', fontSize: '0.8em', padding: '3px 10px',
                            }}
                            onClick={() => setConfirmDelete(v.id)}
                            disabled={deleteVersionMutation.isPending}
                          >
                            מחק
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confirm restore modal */}
      {confirmRestore && (
        <ConfirmModal
          title="שחזור גרסה"
          message="האם לשחזר גרסה זו? התוכנית הנוכחית תוחלף."
          onConfirm={() => restoreMutation.mutate(confirmRestore)}
          onCancel={() => setConfirmRestore(null)}
          confirmText="שחזר"
        />
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <ConfirmModal
          title="מחיקת גרסה"
          message="האם למחוק גרסה זו? לא ניתן לשחזר."
          onConfirm={() => deleteVersionMutation.mutate(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
          confirmText="מחק"
          confirmStyle="danger"
        />
      )}
    </>
  );

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 8, overflow: 'hidden', background: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button type="button" onClick={() => setExpanded(e => !e)} style={{
          display: 'flex', flex: 1, alignItems: 'center', gap: 10,
          padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right',
        }}>
          <span style={{ fontSize: '0.9em', flex: 1, fontWeight: 500, color: '#334155' }}>{goal.title}</span>
          {hasPlanData && <span style={{ fontSize: '0.7em', color: '#16a34a', fontWeight: 600 }}>מוגדר</span>}
          <span style={{ color: '#94a3b8', fontSize: '0.85em' }}>{expanded ? '▲' : '▼'}</span>
        </button>
        {expanded && (
          <button type="button" onClick={() => setFullscreen(true)} className="dc-view-desktop"
            style={{
              background: 'none', border: '1px solid #e2e8f0', borderRadius: 6,
              cursor: 'pointer', color: '#64748b', padding: '3px 8px', fontSize: '0.75em',
              marginLeft: 8, flexShrink: 0,
            }}
            title="הצג במסך מלא"
          >
            &#x26F6;
          </button>
        )}
      </div>

      {/* Fullscreen modal */}
      {fullscreen && (
        <div className="modal-overlay" onClick={() => setFullscreen(false)} style={{ zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'white', borderRadius: 12, width: '95vw', maxHeight: '92vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: '0.95em', color: '#334155' }}>{goal.title} — תוכנית למידה</span>
              <button type="button" onClick={() => setFullscreen(false)}
                style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', color: '#64748b', padding: '4px 12px', fontSize: '0.82em' }}>
                סגור
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '12px 18px' }}>
              {content}
            </div>
          </div>
        </div>
      )}

      {expanded && (
        <div style={{ padding: '0 14px 14px 14px' }}>
          {content}
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
}

export default function LearningPlansTab({ kidId, goals, isAdmin }: Props) {
  const activeGoals = goals.filter(g => {
    if (!g.isActive || !g.libraryItemId) return false;
    const blocks = normalizeTemplate(g.learningPlanTemplate ?? null);
    return blocks.some(b => b.columns.length > 0);
  });

  if (activeGoals.length === 0) {
    return (
      <div className="content-card">
        <div className="empty-state">
          <p>אין מטרות עם תבנית תוכנית למידה מוגדרת</p>
          {isAdmin && (
            <p style={{ fontSize: '0.85em', color: '#94a3b8' }}>
              הגדר תבניות תוכניות למידה דרך ניהול מטרות בספרייה
            </p>
          )}
        </div>
      </div>
    );
  }

  const byCategory = GOAL_CATEGORIES.map(cat => ({
    cat,
    goals: activeGoals.filter(g => g.categoryId === cat.id),
  })).filter(({ goals }) => goals.length > 0);

  return (
    <div className="content-card">
      <h3 style={{ marginBottom: 16, color: '#334155' }}>תוכניות למידה</h3>

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
            <LearningPlanCard key={goal.id} kidId={kidId} goal={goal} isAdmin={isAdmin} />
          ))}
        </div>
      ))}
    </div>
  );
}
