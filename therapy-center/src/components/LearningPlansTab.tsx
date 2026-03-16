import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalPlansApi } from '../api/client';
import { GOAL_CATEGORIES, normalizeTemplate, normalizeLpData, emptyRowForColumns } from '../types';
import type { Goal, GoalFormRow, GoalTableBlock, GoalColumnDef, GoalColumnType, TableBlockData, LearningPlanVersion } from '../types';
import { repeatedKey } from '../types';
import {
  ReadOnlyVerticalBlock,
  ReadOnlyHorizontalBlock,
  EditableHorizontalBlock,
  CellInput,
} from './GoalFormRenderer';
import { toDate } from '../utils/date';
import ConfirmModal from './ConfirmModal';
import GoalFileUpload from './GoalFileUpload';

// -------- Version History Modal --------
function VersionHistoryModal({ kidId, libraryItemId, templateBlocks, onRestore, onClose }: {
  kidId: string;
  libraryItemId: string;
  templateBlocks: GoalTableBlock[];
  onRestore: () => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const versionsQueryKey = ['goal-lp-versions', kidId, libraryItemId];
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: versionsRes, isLoading } = useQuery({
    queryKey: versionsQueryKey,
    queryFn: async () => {
      const res = await goalPlansApi.getVersions(kidId, libraryItemId);
      return res.data ?? [];
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (versionId: string) => goalPlansApi.restoreVersion(kidId, libraryItemId, versionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['goal-lp', kidId, libraryItemId] });
      await queryClient.invalidateQueries({ queryKey: versionsQueryKey });
      setConfirmRestore(null);
      onRestore();
    },
  });

  const deleteVersionMutation = useMutation({
    mutationFn: (versionId: string) => goalPlansApi.deleteVersion(kidId, libraryItemId, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: versionsQueryKey });
      setConfirmDelete(null);
    },
  });

  const versions = (versionsRes as LearningPlanVersion[]) || [];

  function renderReadOnlyBlocks(data: TableBlockData[]) {
    return templateBlocks.map(block => {
      const blockData = data.find(t => t.tableId === block.id);
      const rows = blockData?.rows || (templateBlocks.length === 1 && data.length > 0 ? data[0].rows : []);
      if (block.type === 'vertical') {
        return <div key={block.id} style={{ marginBottom: 12 }}><ReadOnlyVerticalBlock block={block} row={rows[0] || {}} /></div>;
      }
      return <div key={block.id} style={{ marginBottom: 12 }}><ReadOnlyHorizontalBlock block={block} rows={rows} /></div>;
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: '#667eea', borderRadius: '12px 12px 0 0', margin: '-20px -24px 0', flexShrink: 0 }}>
          <h3 style={{ margin: 0, color: 'white', fontSize: '1em' }}>היסטוריית גרסאות</h3>
          <button type="button" onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'white', padding: '4px 12px', fontSize: '0.82em' }}>
            סגור
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', marginTop: 16 }}>
          {isLoading && <div style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>טוען...</div>}

          {!isLoading && versions.length === 0 && (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: 30 }}>אין גרסאות שמורות</div>
          )}

          {!isLoading && versions.map((v, idx) => {
            const d = toDate(v.createdAt as Parameters<typeof toDate>[0]);
            const dateStr = d
              ? d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
              : '';
            const isOpen = viewingId === v.id;

            return (
              <div key={v.id} style={{ background: 'white', borderRadius: 8, marginBottom: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', gap: 10,
                    background: isOpen ? '#f0f4ff' : 'white',
                  }}
                  onClick={() => setViewingId(isOpen ? null : v.id)}
                >
                  <span style={{ background: '#667eea', color: 'white', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7em', fontWeight: 700, flexShrink: 0 }}>{idx + 1}</span>
                  <span style={{ fontSize: '0.88em', fontWeight: 600, color: '#334155' }}>{dateStr}</span>
                  {v.versionLabel && <span style={{ fontSize: '0.82em', color: '#64748b', background: '#f1f5f9', padding: '1px 8px', borderRadius: 4 }}>{v.versionLabel}</span>}
                  <span style={{ marginRight: 'auto' }} />
                  <button type="button" onClick={e => { e.stopPropagation(); setConfirmRestore(v.id); }}
                    style={{ background: '#eef2ff', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '0.78em', fontWeight: 600, padding: '3px 10px', borderRadius: 4 }}>
                    שחזר
                  </button>
                  <button type="button" onClick={e => { e.stopPropagation(); setConfirmDelete(v.id); }}
                    style={{ background: '#fef2f2', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.78em', padding: '3px 10px', borderRadius: 4 }}>
                    מחק
                  </button>
                  <span style={{ color: '#94a3b8', fontSize: '0.75em' }}>{isOpen ? '▲' : '▼'}</span>
                </div>

                {isOpen && (
                  <div style={{ padding: '8px 14px 14px', borderTop: '1px solid #e2e8f0', background: '#fafbfd' }}>
                    {renderReadOnlyBlocks(v.tables || [])}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {confirmRestore && (
          <ConfirmModal title="שחזור גרסה" message="האם לשחזר גרסה זו? התוכנית הנוכחית תוחלף."
            onConfirm={() => restoreMutation.mutate(confirmRestore)} onCancel={() => setConfirmRestore(null)} confirmText="שחזר" />
        )}
        {confirmDelete && (
          <ConfirmModal title="מחיקת גרסה" message="האם למחוק גרסה זו? לא ניתן לשחזר."
            onConfirm={() => deleteVersionMutation.mutate(confirmDelete)} onCancel={() => setConfirmDelete(null)} confirmText="מחק" confirmStyle="danger" />
        )}
      </div>
    </div>
  );
}

// -------- Learning Plan Card (per goal) --------
function LearningPlanCard({ kidId, goal, isAdmin, isSuperAdmin }: {
  kidId: string;
  goal: Goal;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}) {
  const queryClient = useQueryClient();
  const libraryItemId = goal.libraryItemId!;
  const templateBlocks = normalizeTemplate(goal.learningPlanTemplate ?? null);

  const [expanded, setExpanded] = useState(false);
  const [lpData, setLpData] = useState<Record<string, GoalFormRow[]>>({});
  const [dirty, setDirty] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionLabel, setVersionLabel] = useState('');
  const [showVersionInput, setShowVersionInput] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showUpload, setShowUpload] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lpQueryKey = ['goal-lp', kidId, libraryItemId];

  const { data: planRes, isLoading } = useQuery({
    queryKey: lpQueryKey,
    queryFn: async () => {
      const res = await goalPlansApi.get(kidId, libraryItemId);
      if (!res.success) return null;
      return res.data ?? null;
    },
  });

  // Initialize editable data from fetched plan
  useEffect(() => {
    if (isLoading || initialized) return;
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
    setInitialized(true);
  }, [isLoading, planRes, initialized, templateBlocks]);

  // Re-init when plan data changes externally (e.g. after restore)
  function reinitFromPlan() {
    setInitialized(false);
    setDirty(false);
  }

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, GoalFormRow[]>) => {
      const tables: TableBlockData[] = templateBlocks.map(block => ({
        tableId: block.id,
        rows: data[block.id] || [],
      }));
      return goalPlansApi.save(kidId, libraryItemId, { goalTitle: goal.title, tables });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lpQueryKey });
      setDirty(false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 2000);
    },
    onError: () => {
      setSaveStatus('error');
    },
  });

  // Auto-save: debounce 1.5s after last change
  const triggerAutoSave = useCallback((data: Record<string, GoalFormRow[]>) => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setSaveStatus('idle');
    autoSaveTimerRef.current = setTimeout(() => {
      setSaveStatus('saving');
      saveMutation.mutate(data);
    }, 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kidId, libraryItemId, goal.title]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, []);

  const saveVersionMutation = useMutation({
    mutationFn: async () => {
      return goalPlansApi.saveVersion(kidId, libraryItemId, { versionLabel: versionLabel.trim() || undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goal-lp-versions', kidId, libraryItemId] });
      setVersionLabel('');
      setShowVersionInput(false);
    },
  });

  async function handleSaveVersion() {
    // Force save current data before versioning
    if (dirty) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      await saveMutation.mutateAsync(lpData);
    }
    await saveVersionMutation.mutateAsync();
  }

  function updateBlockRows(blockId: string, rows: GoalFormRow[]) {
    const newData = { ...lpData, [blockId]: rows };
    setLpData(newData);
    setDirty(true);
    triggerAutoSave(newData);
  }

  function updateBlockRow(blockId: string, row: GoalFormRow) {
    const newData = { ...lpData, [blockId]: [row] };
    setLpData(newData);
    setDirty(true);
    triggerAutoSave(newData);
  }

  // Render editable blocks (admin) — inline, no edit button needed
  function renderEditableBlocks() {
    return templateBlocks.map(block => {
      if (block.type === 'vertical') {
        // Vertical: simple 2-column table (label | input)
        const row = lpData[block.id]?.[0] || emptyRowForColumns(block.columns);
        return (
          <div key={block.id} className="lp-table" style={{ marginBottom: 12 }}>
            {block.title && <div style={{ fontWeight: 700, fontSize: '0.82em', color: '#4338ca', background: '#eef2ff', padding: '6px 10px', borderRadius: '6px 6px 0 0', border: '1px solid #c7d2fe', borderBottom: 'none' }}>{block.title}</div>}
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85em', border: '1px solid #e2e8f0' }}>
              <tbody>
                {block.columns.map(col => (
                  <tr key={col.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{
                      padding: '6px 10px', background: '#f8fafc', fontWeight: 600, color: '#475569',
                      fontSize: '0.9em', width: 140, borderLeft: '1px solid #e2e8f0', verticalAlign: 'middle',
                    }}>
                      {col.label}
                      {col.description && <div style={{ fontSize: '0.8em', color: '#94a3b8', fontWeight: 400, marginTop: 1 }}>{col.description}</div>}
                    </td>
                    <td style={{ padding: '2px 4px', verticalAlign: 'middle', borderBottom: '1px solid #e2e8f0' }}>
                      <CellInput
                        col={col}
                        value={row[col.id] || ''}
                        onChange={v => updateBlockRow(block.id, { ...row, [col.id]: v })}
                        colKey={`v-${block.id}-${col.id}`}
                        compact
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      // Horizontal: inline editable table
      const blockRows = lpData[block.id] || [];
      const onChangeRows = (newRows: GoalFormRow[]) => updateBlockRows(block.id, newRows);

      return (
        <div key={block.id} className="lp-table" style={{ marginBottom: 12 }}>
          {block.title && <div style={{ fontWeight: 700, fontSize: '0.82em', color: '#4338ca', background: '#eef2ff', padding: '6px 10px', borderRadius: 6, border: '1px solid #c7d2fe', marginBottom: 6 }}>{block.title}</div>}

          {/* Desktop: inline table */}
          <div className="dc-edit-desktop">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85em' }}>
                <thead>
                  <tr>
                    {block.columns.map(col => col.type === 'repeated' ? (
                      <th key={col.id} colSpan={col.repeatCount || 1} style={{ padding: '5px 8px', background: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', fontSize: '0.9em' }}>
                        {col.label}
                      </th>
                    ) : (
                      <th key={col.id} style={{ padding: '5px 8px', background: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', fontSize: '0.9em' }}>
                        {col.label}
                      </th>
                    ))}
                    <th style={{ width: 28, background: '#f8fafc', border: '1px solid #e2e8f0' }} />
                  </tr>
                </thead>
                <tbody>
                  {blockRows.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      {block.columns.flatMap(col => {
                        if (col.type === 'repeated') {
                          const count = col.repeatCount || 1;
                          const innerCol: GoalColumnDef = { id: '', label: '', type: (col.innerType || 'checkbox') as GoalColumnType, options: col.options };
                          return Array.from({ length: count }).map((_, i) => {
                            const key = repeatedKey(col.id, i);
                            return (
                              <td key={key} style={{ border: '1px solid #e2e8f0', verticalAlign: 'middle', textAlign: 'center' }}>
                                <CellInput col={{ ...innerCol, id: key }} value={row[key] || ''}
                                  onChange={v => onChangeRows(blockRows.map((r, ri) => ri === rowIdx ? { ...r, [key]: v } : r))}
                                  colKey={`${rowIdx}-${key}`} compact />
                              </td>
                            );
                          });
                        }
                        return [(
                          <td key={col.id} style={{ border: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                            <CellInput col={col} value={row[col.id] || ''}
                              onChange={v => onChangeRows(blockRows.map((r, i) => i === rowIdx ? { ...r, [col.id]: v } : r))}
                              colKey={`${rowIdx}-${col.id}`} compact />
                          </td>
                        )];
                      })}
                      <td style={{ border: '1px solid #e2e8f0', textAlign: 'center' }}>
                        <button type="button" onClick={() => onChangeRows(blockRows.filter((_, i) => i !== rowIdx))}
                          style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '0.8em', padding: 0, lineHeight: 1 }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#cbd5e1')}
                        >&#x2715;</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={() => onChangeRows([...blockRows, emptyRowForColumns(block.columns)])}
              style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '0.78em', fontWeight: 600, padding: '6px 0' }}>
              + הוסף שורה
            </button>
          </div>

          {/* Mobile: card per row */}
          <div className="dc-edit-mobile">
            <EditableHorizontalBlock block={{ ...block, title: undefined }} rows={blockRows} onChange={onChangeRows} />
          </div>
        </div>
      );
    });
  }

  // Render read-only blocks (therapist view)
  function renderReadOnlyBlocks() {
    const existingTables = normalizeLpData(planRes ?? null);
    return templateBlocks.map(block => {
      const blockData = existingTables.find(t => t.tableId === block.id);
      const rows = blockData?.rows || (templateBlocks.length === 1 && existingTables.length > 0 ? existingTables[0].rows : []);
      if (block.type === 'vertical') {
        return <div key={block.id} style={{ marginBottom: 12 }}><ReadOnlyVerticalBlock block={block} row={rows[0] || {}} /></div>;
      }
      return <div key={block.id} style={{ marginBottom: 12 }}><ReadOnlyHorizontalBlock block={block} rows={rows} /></div>;
    });
  }

  const existingTables = normalizeLpData(planRes ?? null);
  const hasPlanData = existingTables.some(t => t.rows.length > 0);

  // Toolbar: auto-save status + save version + history
  const toolbar = isAdmin && initialized && (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
      {/* Auto-save status indicator */}
      <span style={{ fontSize: '0.73em', color: saveStatus === 'error' ? '#ef4444' : saveStatus === 'saved' ? '#16a34a' : saveStatus === 'saving' ? '#667eea' : '#94a3b8', fontWeight: 500, minWidth: 60 }}>
        {saveStatus === 'saving' ? 'שומר...' : saveStatus === 'saved' ? 'נשמר ✓' : saveStatus === 'error' ? 'שגיאה בשמירה' : dirty ? 'שינויים...' : 'שמירה אוטומטית'}
      </span>

      <span style={{ borderLeft: '1px solid #e2e8f0', height: 16, margin: '0 4px' }} />

      {!showVersionInput ? (
        <button type="button" onClick={() => setShowVersionInput(true)}
          style={{ background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4f46e5', cursor: 'pointer', fontSize: '0.78em', fontWeight: 600, padding: '4px 12px', borderRadius: 6 }}>
          שמור גרסה
        </button>
      ) : (
        <>
          <input type="text" value={versionLabel} onChange={e => setVersionLabel(e.target.value)}
            placeholder="תיאור (אופציונלי)" autoFocus
            style={{ border: '1px solid #c7d2fe', borderRadius: 5, padding: '3px 8px', fontSize: '0.78em', width: 140, fontFamily: 'inherit', background: 'white' }}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveVersion(); if (e.key === 'Escape') { setShowVersionInput(false); setVersionLabel(''); } }}
          />
          <button type="button" onClick={handleSaveVersion}
            disabled={saveVersionMutation.isPending}
            style={{ background: '#4f46e5', border: 'none', color: 'white', cursor: 'pointer', fontSize: '0.78em', fontWeight: 600, padding: '4px 10px', borderRadius: 5 }}>
            {saveVersionMutation.isPending ? '...' : 'שמור'}
          </button>
          <button type="button" onClick={() => { setShowVersionInput(false); setVersionLabel(''); }}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.78em', padding: '3px 6px' }}>
            &#x2715;
          </button>
        </>
      )}

      <button type="button" onClick={() => setShowVersionModal(true)}
        style={{ background: 'none', border: '1px solid #e2e8f0', color: '#64748b', cursor: 'pointer', fontSize: '0.78em', padding: '4px 12px', borderRadius: 6 }}>
        היסטוריה
      </button>

      <button type="button" onClick={() => setShowUpload(true)}
        style={{ background: 'none', border: '1px solid #e2e8f0', color: '#64748b', cursor: 'pointer', fontSize: '0.78em', padding: '4px 12px', borderRadius: 6 }}>
        📄 העלה קובץ
      </button>

      {saveVersionMutation.isError && <span style={{ color: '#ef4444', fontSize: '0.75em' }}>שגיאה בשמירת גרסה</span>}

      {planRes?.updatedAt && (
        <span style={{ fontSize: '0.7em', color: '#94a3b8', marginRight: 'auto' }}>
          עודכן {(() => {
            const d = toDate(planRes.updatedAt as Parameters<typeof toDate>[0]);
            return d ? d.toLocaleDateString('he-IL') : '';
          })()}
        </span>
      )}
    </div>
  );

  const content = (
    <>
      {isLoading && <div style={{ color: '#94a3b8', fontSize: '0.83em', padding: 10 }}>טוען...</div>}

      {!isLoading && isAdmin && (
        <>
          {renderEditableBlocks()}
          {toolbar}
        </>
      )}

      {!isLoading && !isAdmin && (
        <>
          {hasPlanData ? renderReadOnlyBlocks() : (
            <div style={{ color: '#94a3b8', fontSize: '0.85em' }}>טרם הוגדרה תוכנית למידה</div>
          )}
        </>
      )}

      {showVersionModal && (
        <VersionHistoryModal
          kidId={kidId}
          libraryItemId={libraryItemId}
          templateBlocks={templateBlocks}
          onRestore={() => { setShowVersionModal(false); reinitFromPlan(); }}
          onClose={() => setShowVersionModal(false)}
        />
      )}

      {showUpload && (
        <GoalFileUpload
          kidId={kidId}
          goal={goal}
          formType="lp"
          isSuperAdmin={isSuperAdmin}
          onClose={() => setShowUpload(false)}
          onSaved={() => {
            setShowUpload(false);
            reinitFromPlan();
            queryClient.invalidateQueries({ queryKey: lpQueryKey });
          }}
        />
      )}
    </>
  );

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 8, overflow: 'hidden', background: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'center', background: '#f0f4ff', borderBottom: expanded ? '2px solid #c7d2fe' : '1px solid #e2e8f0' }}>
        <button type="button" onClick={() => setExpanded(e => !e)} style={{
          display: 'flex', flex: 1, alignItems: 'center', gap: 10,
          padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right',
        }}>
          <span style={{ fontSize: '0.9em', flex: 1, fontWeight: 600, color: '#4338ca' }}>{goal.title}</span>
          {hasPlanData && <span style={{ fontSize: '0.72em', color: '#16a34a', fontWeight: 700, background: '#dcfce7', padding: '1px 6px', borderRadius: 4 }}>&#x2713;</span>}
          <span style={{ color: '#94a3b8', fontSize: '0.8em' }}>{expanded ? '▲' : '▼'}</span>
        </button>
        {expanded && (
          <button type="button" onClick={() => setFullscreen(true)} className="dc-view-desktop"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '3px 10px', fontSize: '0.75em', flexShrink: 0 }}
            title="מסך מלא">&#x26F6;</button>
        )}
      </div>

      {fullscreen && (
        <div className="modal-overlay" onClick={() => setFullscreen(false)} style={{ zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#f8fafc', borderRadius: 12, width: '95vw', maxHeight: '92vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', background: '#667eea', borderRadius: '12px 12px 0 0', flexShrink: 0 }}>
              <span style={{ fontWeight: 600, fontSize: '0.95em', color: 'white' }}>{goal.title}</span>
              <button type="button" onClick={() => setFullscreen(false)}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'white', padding: '4px 12px', fontSize: '0.82em' }}>סגור</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px' }}>{content}</div>
          </div>
        </div>
      )}

      {expanded && <div style={{ padding: '8px 14px 14px 14px', background: '#fcfcfe' }}>{content}</div>}
    </div>
  );
}

// -------- Main tab --------
interface Props {
  kidId: string;
  goals: Goal[];
  isReadOnly: boolean;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
}

// -------- Upload-only card for goals without LP template --------
function UploadOnlyCard({ kidId, goal, isSuperAdmin }: {
  kidId: string;
  goal: Goal;
  isSuperAdmin: boolean;
}) {
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 8, overflow: 'hidden', background: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'center', background: '#fafbfd', padding: '11px 14px', gap: 10 }}>
        <span style={{ fontSize: '0.9em', flex: 1, fontWeight: 500, color: '#64748b' }}>{goal.title}</span>
        <button type="button" onClick={() => setShowUpload(true)}
          style={{ background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4f46e5', cursor: 'pointer', fontSize: '0.78em', fontWeight: 600, padding: '4px 14px', borderRadius: 6 }}>
          📄 העלה קובץ
        </button>
      </div>
      {showUpload && (
        <GoalFileUpload
          kidId={kidId}
          goal={goal}
          formType="lp"
          isSuperAdmin={isSuperAdmin}
          forceUpdateStructure
          onClose={() => setShowUpload(false)}
          onSaved={() => {
            setShowUpload(false);
            queryClient.invalidateQueries({ queryKey: ['goal-lp', kidId, goal.libraryItemId] });
            queryClient.invalidateQueries({ queryKey: ['goals'] });
            queryClient.invalidateQueries({ queryKey: ['goals-library-all'] });
          }}
        />
      )}
    </div>
  );
}

export default function LearningPlansTab({ kidId, goals, isAdmin, isSuperAdmin = false }: Props) {
  // All active goals with a libraryItemId
  const allActiveGoals = goals.filter(g => g.isActive && g.libraryItemId);

  // Split: goals with LP template vs without
  const goalsWithTemplate = allActiveGoals.filter(g => {
    const blocks = normalizeTemplate(g.learningPlanTemplate ?? null);
    return blocks.some(b => b.columns.length > 0);
  });
  const goalsWithoutTemplate = isAdmin ? allActiveGoals.filter(g => {
    const blocks = normalizeTemplate(g.learningPlanTemplate ?? null);
    return !blocks.some(b => b.columns.length > 0);
  }) : [];

  if (goalsWithTemplate.length === 0 && goalsWithoutTemplate.length === 0) {
    return (
      <div className="content-card">
        <div className="empty-state">
          <p>אין מטרות פעילות</p>
        </div>
      </div>
    );
  }

  const byCategory = GOAL_CATEGORIES.map(cat => ({
    cat,
    withTemplate: goalsWithTemplate.filter(g => g.categoryId === cat.id),
    withoutTemplate: goalsWithoutTemplate.filter(g => g.categoryId === cat.id),
  })).filter(({ withTemplate, withoutTemplate }) => withTemplate.length > 0 || withoutTemplate.length > 0);

  return (
    <div className="content-card">
      <h3 style={{ marginBottom: 16, color: '#334155', borderBottom: '2px solid #c7d2fe', paddingBottom: 10 }}>תוכניות למידה</h3>
      {byCategory.map(({ cat, withTemplate, withoutTemplate }) => (
        <div key={cat.id} style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: '0.8em', fontWeight: 700, color: cat.color,
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
            borderBottom: `2px solid ${cat.color}20`, paddingBottom: 4,
          }}>
            {cat.nameHe} ({withTemplate.length + withoutTemplate.length})
          </div>
          {withTemplate.map(goal => (
            <LearningPlanCard key={goal.id} kidId={kidId} goal={goal} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} />
          ))}
          {withoutTemplate.map(goal => (
            <UploadOnlyCard key={goal.id} kidId={kidId} goal={goal} isSuperAdmin={isSuperAdmin} />
          ))}
        </div>
      ))}
    </div>
  );
}
