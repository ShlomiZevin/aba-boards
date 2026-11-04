import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalPlansApi, categoryLpTemplatesApi } from '../api/client';
import { GOAL_CATEGORIES, normalizeTemplate, normalizeLpData, emptyRowForColumns, categoryLpId } from '../types';
import type { Goal, GoalFormRow, GoalTableBlock, GoalColumnDef, GoalColumnType, TableBlockData, LearningPlanVersion, CategoryLpTemplate } from '../types';
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
import Icon from '../v2/Icon';
import { CATEGORY_TONE, CATEGORY_LABEL } from '../v2/kidColor';
import '../v2/pages/kp.css';

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
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1.5px dashed var(--line)', flexShrink: 0 }}>
          <h3 style={{ margin: 0 }}>היסטוריית גרסאות</h3>
          <button type="button" onClick={onClose}
            className="nb-btn-ghost sm">
            סגור
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', marginTop: 16 }}>
          {isLoading && <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 20 }}>טוען...</div>}

          {!isLoading && versions.length === 0 && (
            <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 30 }}>אין גרסאות שמורות</div>
          )}

          {!isLoading && versions.map((v, idx) => {
            const d = toDate(v.createdAt as Parameters<typeof toDate>[0]);
            const dateStr = d
              ? d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
              : '';
            const isOpen = viewingId === v.id;

            return (
              <div key={v.id} style={{ background: 'white', borderRadius: 8, marginBottom: 8, border: '1px solid var(--line)', overflow: 'hidden' }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', gap: 10,
                    background: isOpen ? 'var(--pen-soft)' : 'white',
                  }}
                  onClick={() => setViewingId(isOpen ? null : v.id)}
                >
                  <span style={{ background: 'var(--pen)', color: 'white', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7em', fontWeight: 700, flexShrink: 0 }}>{idx + 1}</span>
                  <span style={{ fontSize: '0.88em', fontWeight: 600, color: 'var(--ink)' }}>{dateStr}</span>
                  {v.versionLabel && <span style={{ fontSize: '0.82em', color: 'var(--ink-2)', background: 'var(--paper-2)', padding: '1px 8px', borderRadius: 4 }}>{v.versionLabel}</span>}
                  <span style={{ marginRight: 'auto' }} />
                  <button type="button" onClick={e => { e.stopPropagation(); setConfirmRestore(v.id); }}
                    style={{ background: 'var(--pen-soft)', border: 'none', color: 'var(--pen)', cursor: 'pointer', fontSize: '0.78em', fontWeight: 600, padding: '3px 10px', borderRadius: 4 }}>
                    שחזר
                  </button>
                  <button type="button" onClick={e => { e.stopPropagation(); setConfirmDelete(v.id); }}
                    style={{ background: 'var(--red-soft)', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '0.78em', padding: '3px 10px', borderRadius: 4 }}>
                    מחק
                  </button>
                  <span className={`kp-fold-chev${isOpen ? ' is-open' : ''}`}><Icon name="chevron" size={16} /></span>
                </div>

                {isOpen && (
                  <div style={{ padding: '8px 14px 14px', borderTop: '1px solid var(--line)', background: 'var(--paper)' }}>
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

// -------- Learning Plan Card (per goal or category) --------
function LearningPlanCard({ kidId, goal, isAdmin, isSuperAdmin, libraryItemIdOverride, templateBlocksOverride, titleOverride, isCategoryCard }: {
  kidId: string;
  goal: Goal;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  libraryItemIdOverride?: string;
  templateBlocksOverride?: GoalTableBlock[];
  titleOverride?: string;
  isCategoryCard?: boolean;
}) {
  const queryClient = useQueryClient();
  const libraryItemId = libraryItemIdOverride || goal.libraryItemId!;
  const templateBlocks = templateBlocksOverride || normalizeTemplate(goal.learningPlanTemplate ?? null);
  const displayTitle = titleOverride || goal.title;

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
      return goalPlansApi.save(kidId, libraryItemId, { goalTitle: displayTitle, tables });
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
  }, [kidId, libraryItemId, displayTitle]);

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
            {block.title && <div style={{ fontWeight: 700, fontSize: '0.82em', color: 'var(--pen)', background: 'var(--pen-soft)', padding: '6px 10px', borderRadius: '6px 6px 0 0', border: '1px solid #D6CBF4', borderBottom: 'none' }}>{block.title}</div>}
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85em', border: '1px solid var(--line)' }}>
              <tbody>
                {block.columns.map(col => (
                  <tr key={col.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{
                      padding: '6px 10px', background: 'var(--paper)', fontWeight: 600, color: 'var(--ink-2)',
                      fontSize: '0.9em', width: 140, borderLeft: '1px solid var(--line)', verticalAlign: 'middle',
                    }}>
                      {col.label}
                      {col.description && <div style={{ fontSize: '0.8em', color: 'var(--muted)', fontWeight: 400, marginTop: 1 }}>{col.description}</div>}
                    </td>
                    <td style={{ padding: '2px 4px', verticalAlign: 'middle', borderBottom: '1px solid var(--line)' }}>
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
          {block.title && <div style={{ fontWeight: 700, fontSize: '0.82em', color: 'var(--pen)', background: 'var(--pen-soft)', padding: '6px 10px', borderRadius: 6, border: '1px solid #D6CBF4', marginBottom: 6 }}>{block.title}</div>}

          {/* Desktop: inline table */}
          <div className="dc-edit-desktop">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85em' }}>
                <thead>
                  <tr>
                    {block.columns.map(col => col.type === 'repeated' ? (
                      <th key={col.id} colSpan={col.repeatCount || 1} style={{ padding: '5px 8px', background: 'var(--paper)', border: '1px solid var(--line)', textAlign: 'center', fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap', fontSize: '0.9em' }}>
                        {col.label}
                      </th>
                    ) : (
                      <th key={col.id} style={{ padding: '5px 8px', background: 'var(--paper)', border: '1px solid var(--line)', textAlign: 'right', fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap', fontSize: '0.9em' }}>
                        {col.label}
                      </th>
                    ))}
                    <th style={{ width: 28, background: 'var(--paper)', border: '1px solid var(--line)' }} />
                  </tr>
                </thead>
                <tbody>
                  {blockRows.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      {block.columns.flatMap(col => {
                        if (col.type === 'repeated') {
                          const count = col.repeatCount || 1;
                          const innerCol: GoalColumnDef = { id: '', label: '', type: (col.innerType || 'checkbox') as GoalColumnType, options: col.options, multiSelect: col.multiSelect };
                          return Array.from({ length: count }).map((_, i) => {
                            const key = repeatedKey(col.id, i);
                            return (
                              <td key={key} style={{ border: '1px solid var(--line)', verticalAlign: 'middle', textAlign: 'center' }}>
                                <CellInput col={{ ...innerCol, id: key }} value={row[key] || ''}
                                  onChange={v => onChangeRows(blockRows.map((r, ri) => ri === rowIdx ? { ...r, [key]: v } : r))}
                                  colKey={`${rowIdx}-${key}`} compact />
                              </td>
                            );
                          });
                        }
                        return [(
                          <td key={col.id} style={{ border: '1px solid var(--line)', verticalAlign: 'middle' }}>
                            <CellInput col={col} value={row[col.id] || ''}
                              onChange={v => onChangeRows(blockRows.map((r, i) => i === rowIdx ? { ...r, [col.id]: v } : r))}
                              colKey={`${rowIdx}-${col.id}`} compact />
                          </td>
                        )];
                      })}
                      <td style={{ border: '1px solid var(--line)', textAlign: 'center' }}>
                        <button type="button" onClick={() => onChangeRows(blockRows.filter((_, i) => i !== rowIdx))}
                          style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '0.8em', padding: 0, lineHeight: 1 }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#cbd5e1')}
                        >&#x2715;</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={() => onChangeRows([...blockRows, emptyRowForColumns(block.columns)])}
              style={{ background: 'none', border: 'none', color: 'var(--pen)', cursor: 'pointer', fontSize: '0.78em', fontWeight: 600, padding: '6px 0' }}>
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
    <div className="kp-lp-toolbar">
      {/* Auto-save status indicator */}
      <span style={{ fontSize: 13, color: saveStatus === 'error' ? 'var(--red)' : saveStatus === 'saved' ? 'var(--green)' : saveStatus === 'saving' ? 'var(--pen)' : 'var(--muted)', fontWeight: 500, minWidth: 60 }}>
        {saveStatus === 'saving' ? 'שומר...' : saveStatus === 'saved' ? 'נשמר' : saveStatus === 'error' ? 'שגיאה בשמירה' : dirty ? 'שינויים...' : 'שמירה אוטומטית'}
      </span>

      <span style={{ borderLeft: '1px solid var(--line)', height: 16, margin: '0 4px' }} />

      {!showVersionInput ? (
        <button type="button" onClick={() => setShowVersionInput(true)} className="nb-btn-ghost sm">
          שמור גרסה
        </button>
      ) : (
        <>
          <input type="text" value={versionLabel} onChange={e => setVersionLabel(e.target.value)}
            placeholder="תיאור (אופציונלי)" autoFocus
            className="kp-lp-input"
            onKeyDown={e => { if (e.key === 'Enter') handleSaveVersion(); if (e.key === 'Escape') { setShowVersionInput(false); setVersionLabel(''); } }}
          />
          <button type="button" onClick={handleSaveVersion}
            disabled={saveVersionMutation.isPending}
            className="btn-primary btn-small">
            {saveVersionMutation.isPending ? '...' : 'שמור'}
          </button>
          <button type="button" onClick={() => { setShowVersionInput(false); setVersionLabel(''); }} className="kp-icon-btn" aria-label="ביטול">
            <Icon name="close" size={16} />
          </button>
        </>
      )}

      <button type="button" onClick={() => setShowVersionModal(true)} className="nb-btn-ghost sm">
        <Icon name="clock" size={16} /> היסטוריה
      </button>

      <button type="button" onClick={() => setShowUpload(true)} className="nb-btn-ghost sm">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V4 M7.5 8.5L12 4l4.5 4.5 M5 15v4.5h14V15" /></svg> העלה קובץ
      </button>

      {saveVersionMutation.isError && <span style={{ color: 'var(--red)', fontSize: '0.75em' }}>שגיאה בשמירת גרסה</span>}

      {planRes?.updatedAt && (
        <span style={{ fontSize: 12.5, color: 'var(--muted)', marginRight: 'auto' }}>
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
      {isLoading && <div style={{ color: 'var(--muted)', fontSize: '0.83em', padding: 10 }}>טוען...</div>}

      {!isLoading && isAdmin && (
        <>
          {renderEditableBlocks()}
          {toolbar}
        </>
      )}

      {!isLoading && !isAdmin && (
        <>
          {hasPlanData ? renderReadOnlyBlocks() : (
            <div style={{ color: 'var(--muted)', fontSize: '0.85em' }}>טרם הוגדרה תוכנית למידה</div>
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
          forceUpdateStructure={isCategoryCard}
          libraryItemIdOverride={isCategoryCard ? libraryItemId : undefined}
          onSaveTemplate={isCategoryCard ? async (tmpl) => {
            await categoryLpTemplatesApi.save(
              libraryItemId.replace('cat__', ''),
              { tables: tmpl.tables as import('../types').GoalTableBlock[] },
            );
          } : undefined}
          onClose={() => setShowUpload(false)}
          onSaved={() => {
            setShowUpload(false);
            reinitFromPlan();
            queryClient.invalidateQueries({ queryKey: lpQueryKey });
            if (isCategoryCard) queryClient.invalidateQueries({ queryKey: ['category-lp-templates'] });
          }}
        />
      )}
    </>
  );

  return (
    <div className={`kp-dc-goal kp-lp-card${expanded ? ' is-open' : ''}${isCategoryCard ? ' is-cat' : ''}`}>
      <div className="kp-dc-goal-head">
        <button type="button" onClick={() => setExpanded(e => !e)} className="kp-dc-goal-btn" aria-expanded={expanded}>
          {isCategoryCard ? <Icon name="book" size={18} className="kp-lp-cat-ic" /> : <span className="nb-dot" />}
          <span className="kp-dc-goal-title">{displayTitle}</span>
          {hasPlanData && <span className="nb-chip tone-mint kp-lp-has" aria-label="יש תוכנית"><Icon name="check" size={13} strokeWidth={2.8} /></span>}
          <span className={`kp-fold-chev${expanded ? ' is-open' : ''}`}><Icon name="chevron" size={18} /></span>
        </button>
        {expanded && (
          <button type="button" onClick={() => setFullscreen(true)} className="kp-icon-btn dc-view-desktop" title="מסך מלא" aria-label="מסך מלא"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V4h5 M15 4h5v5 M20 15v5h-5 M9 20H4v-5" /></svg></button>
        )}
      </div>

      {fullscreen && (
        <div className="modal-overlay" onClick={() => setFullscreen(false)} style={{ zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--paper)', borderRadius: 20, width: '95vw', maxHeight: '92vh', border: '1.5px solid var(--line)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: '1.5px dashed var(--line)', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--f-display)', fontSize: 20, color: 'var(--ink)' }}>{displayTitle}</span>
              <button type="button" onClick={() => setFullscreen(false)} className="nb-btn-ghost sm">סגור</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px' }}>{content}</div>
          </div>
        </div>
      )}

      {expanded && <div className="kp-dc-goal-body">{content}</div>}
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
    <div className="kp-dc-goal kp-lp-card is-empty">
      <div className="kp-dc-goal-head">
        <span className="nb-dot" />
        <span className="kp-dc-goal-title">{goal.title}</span>
        <button type="button" onClick={() => setShowUpload(true)} className="nb-btn-ghost sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V4 M7.5 8.5L12 4l4.5 4.5 M5 15v4.5h14V15" /></svg> העלה קובץ
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

// -------- Upload-only card for categories without LP template --------
function CategoryUploadOnlyCard({ kidId, categoryId, categoryName, isSuperAdmin }: {
  kidId: string;
  categoryId: string;
  categoryName: string;
  isSuperAdmin: boolean;
}) {
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const libId = categoryLpId(categoryId as import('../types').GoalCategoryId);

  // Dummy goal object for GoalFileUpload
  const dummyGoal: Goal = {
    id: `cat__${categoryId}`, kidId, categoryId: categoryId as Goal['categoryId'],
    title: categoryName, isActive: true, createdAt: new Date(),
  };

  return (
    <div className="kp-dc-goal kp-lp-card is-cat is-empty">
      <div className="kp-dc-goal-head">
        <Icon name="book" size={18} className="kp-lp-cat-ic" />
        <span className="kp-dc-goal-title">תוכנית קטגוריה</span>
        <button type="button" onClick={() => setShowUpload(true)} className="nb-btn-ghost sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V4 M7.5 8.5L12 4l4.5 4.5 M5 15v4.5h14V15" /></svg> העלה קובץ
        </button>
      </div>
      {showUpload && (
        <GoalFileUpload
          kidId={kidId}
          goal={dummyGoal}
          formType="lp"
          isSuperAdmin={isSuperAdmin}
          forceUpdateStructure
          libraryItemIdOverride={libId}
          onSaveTemplate={async (tmpl) => {
            await categoryLpTemplatesApi.save(categoryId, { tables: tmpl.tables as import('../types').GoalTableBlock[] });
          }}
          onClose={() => setShowUpload(false)}
          onSaved={() => {
            setShowUpload(false);
            queryClient.invalidateQueries({ queryKey: ['goal-lp', kidId, libId] });
            queryClient.invalidateQueries({ queryKey: ['category-lp-templates'] });
          }}
        />
      )}
    </div>
  );
}

export default function LearningPlansTab({ kidId, goals, isAdmin, isSuperAdmin = false }: Props) {
  const [search, setSearch] = useState('');
  const [onlyWithTemplate, setOnlyWithTemplate] = useState(false);

  // Fetch category LP templates
  const { data: catLpRes } = useQuery({
    queryKey: ['category-lp-templates'],
    queryFn: () => categoryLpTemplatesApi.getAll(),
  });
  const catLpTemplates: CategoryLpTemplate[] = catLpRes?.data || [];
  const catLpMap = new Map<string, CategoryLpTemplate>();
  catLpTemplates.forEach(t => catLpMap.set(t.id, t));

  // All active goals with a libraryItemId
  const allActiveGoals = goals.filter(g => g.isActive && g.libraryItemId);

  // Apply text search
  const searchLower = search.trim().toLowerCase();
  const searchedGoals = searchLower
    ? allActiveGoals.filter(g => g.title.toLowerCase().includes(searchLower))
    : allActiveGoals;

  // Split: goals with LP template vs without
  const goalsWithTemplate = searchedGoals.filter(g => {
    const blocks = normalizeTemplate(g.learningPlanTemplate ?? null);
    return blocks.some(b => b.columns.length > 0);
  });
  const goalsWithoutTemplate = (isAdmin && !onlyWithTemplate) ? searchedGoals.filter(g => {
    const blocks = normalizeTemplate(g.learningPlanTemplate ?? null);
    return !blocks.some(b => b.columns.length > 0);
  }) : [];

  const byCategory = GOAL_CATEGORIES.map(cat => {
    const catTemplate = catLpMap.get(cat.id);
    const hasCatTemplate = catTemplate && catTemplate.tables?.length > 0 && catTemplate.tables.some(b => (b as GoalTableBlock).columns?.length > 0);
    // If search active, only show category template if category name matches
    const catNameMatches = !searchLower || cat.nameHe.toLowerCase().includes(searchLower);
    const showCatTemplate = hasCatTemplate && catNameMatches;
    // Show upload-only card for categories without template (admin only, not filtered by onlyWithTemplate)
    const showCatUploadOnly = isAdmin && !hasCatTemplate && !onlyWithTemplate && catNameMatches;
    return {
      cat,
      catTemplate: showCatTemplate ? catTemplate : null,
      showCatUploadOnly,
      withTemplate: goalsWithTemplate.filter(g => g.categoryId === cat.id),
      withoutTemplate: goalsWithoutTemplate.filter(g => g.categoryId === cat.id),
    };
  }).filter(({ catTemplate, showCatUploadOnly, withTemplate, withoutTemplate }) =>
    catTemplate || showCatUploadOnly || withTemplate.length > 0 || withoutTemplate.length > 0
  );

  // Dummy goal for category cards
  const dummyGoalForCategory = (catId: string): Goal => ({
    id: `cat__${catId}`, kidId, categoryId: catId as Goal['categoryId'],
    title: '', isActive: true, createdAt: new Date(),
  });

  const isEmpty = byCategory.length === 0;

  return (
    <section className="nb-card kp-panel">
      <div className="kp-sec-head">
        <h2 className="nb-h2"><Icon name="book" /> תוכניות למידה</h2>
      </div>

      {/* Search & filter toolbar */}
      <div className="kp-lp-filter">
        <label className="kp-search">
          <Icon name="search" size={18} />
          <input
            type="search"
            placeholder="חיפוש מטרה..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </label>
        <label className="kp-lp-only">
          <input
            type="checkbox"
            checked={onlyWithTemplate}
            onChange={e => setOnlyWithTemplate(e.target.checked)}
            style={{ accentColor: 'var(--pen)' }}
          />
          רק עם תבנית
        </label>
      </div>

      {isEmpty ? (
        <div className="kp-empty">
          <Icon name="book" size={30} />
          <p className="hand">{search ? 'לא נמצאו תוצאות' : 'אין מטרות פעילות'}</p>
        </div>
      ) : (
        byCategory.map(({ cat, catTemplate, showCatUploadOnly, withTemplate, withoutTemplate }) => (
          <div key={cat.id} className={`kp-cat-group tone-${CATEGORY_TONE[cat.id] || 'lilac'}`}>
            <div className="kp-cat-head">
              <span className="nb-chip">{CATEGORY_LABEL[cat.id] || cat.nameHe}</span>
              <span className="kp-count tabular">{(catTemplate || showCatUploadOnly ? 1 : 0) + withTemplate.length + withoutTemplate.length}</span>
            </div>
            {catTemplate && (
              <LearningPlanCard
                key={`cat__${cat.id}`}
                kidId={kidId}
                goal={dummyGoalForCategory(cat.id)}
                isAdmin={isAdmin}
                isSuperAdmin={isSuperAdmin}
                libraryItemIdOverride={categoryLpId(cat.id)}
                templateBlocksOverride={catTemplate.tables as GoalTableBlock[]}
                titleOverride="תוכנית קטגוריה"
                isCategoryCard
              />
            )}
            {showCatUploadOnly && (
              <CategoryUploadOnlyCard
                kidId={kidId}
                categoryId={cat.id}
                categoryName={cat.nameHe}
                isSuperAdmin={isSuperAdmin}
              />
            )}
            {withTemplate.map(goal => (
              <LearningPlanCard key={goal.id} kidId={kidId} goal={goal} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} />
            ))}
            {withoutTemplate.map(goal => (
              <UploadOnlyCard key={goal.id} kidId={kidId} goal={goal} isSuperAdmin={isSuperAdmin} />
            ))}
          </div>
        ))
      )}
    </section>
  );
}
