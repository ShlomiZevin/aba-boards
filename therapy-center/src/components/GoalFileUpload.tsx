import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { goalFormUploadApi, goalDataApi, goalPlansApi, goalTemplatesApi, type GoalFormUploadResult } from '../api/client';
import { ReadOnlyGoalTable, ReadOnlyVerticalBlock } from './GoalFormRenderer';
import { normalizeTemplate } from '../types';
import type { Goal, GoalFormRow, GoalColumnDef, GoalTableBlock } from '../types';

interface Props {
  kidId: string;
  goal: Goal;
  formType: 'lp' | 'dc';
  isSuperAdmin: boolean;
  practitionerId?: string;
  /** When true, always send updateStructure=true (e.g. no template exists yet) */
  forceUpdateStructure?: boolean;
  /** Override the libraryItemId (e.g. for category LP: "cat__motor-gross") */
  libraryItemIdOverride?: string;
  /** Override how the template structure is saved (e.g. for category LP templates) */
  onSaveTemplate?: (template: { tables: GoalTableBlock[] }) => Promise<void>;
  onClose: () => void;
  onSaved: () => void;
}

type Step = 'pick' | 'processing' | 'preview' | 'saving';

export default function GoalFileUpload({ kidId, goal, formType, isSuperAdmin, practitionerId, forceUpdateStructure, libraryItemIdOverride, onSaveTemplate, onClose, onSaved }: Props) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const libraryItemId = libraryItemIdOverride || goal.libraryItemId!;

  const [step, setStep] = useState<Step>('pick');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [updateStructure, setUpdateStructure] = useState(forceUpdateStructure ?? false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GoalFormUploadResult | null>(null);

  // ---- Upload & extract ----
  async function handleProcess() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError('נא לבחור קובץ'); return; }

    setError(null);
    setStep('processing');

    const shouldUpdateStructure = forceUpdateStructure || (updateStructure && isSuperAdmin);
    const res = await goalFormUploadApi.upload(kidId, libraryItemId, file, formType, shouldUpdateStructure);

    if (!res.success || !res.data) {
      setError(res.error || 'שגיאה בעיבוד הקובץ');
      setStep('pick');
      return;
    }

    const data = res.data;
    // Check for content: multi-block tables, single-block rows, or DC entries
    const hasContent = formType === 'lp'
      ? (data.tables && data.tables.some(t => t.rows && t.rows.length > 0)) || (data.rows && data.rows.length > 0)
      : (data.entries && data.entries.length > 0);
    if (!hasContent) {
      setError('לא נמצאו נתונים בקובץ. ייתכן שהמבנה שונה מהתבנית הקיימת.');
      setStep('pick');
      return;
    }

    setResult(data);
    setStep('preview');
  }

  // ---- Save LP ----
  const saveLpMutation = useMutation({
    mutationFn: async () => {
      if (!result) return;

      const shouldUpdate = forceUpdateStructure || (isSuperAdmin && updateStructure);

      // Helper to save template structure (goal or category)
      const saveTemplateStructure = async (tables: GoalTableBlock[]) => {
        if (onSaveTemplate) {
          await onSaveTemplate({ tables });
          queryClient.invalidateQueries({ queryKey: ['category-lp-templates'] });
        } else {
          await goalTemplatesApi.updateTemplates(libraryItemId, {
            learningPlanTemplate: { tables },
          });
        }
        queryClient.invalidateQueries({ queryKey: ['goals-library-all'] });
        queryClient.invalidateQueries({ queryKey: ['goals'] });
      };

      // Multi-block tables (new format)
      if (result.tables && result.tables.length > 0) {
        // If updateStructure and Claude returned new columns in any table
        if (shouldUpdate) {
          const tablesWithNewCols = result.tables.filter(t => t.columns && t.columns.length > 0);
          if (tablesWithNewCols.length > 0) {
            const tmpl = formType === 'lp' ? goal.learningPlanTemplate : goal.dataCollectionTemplate;
            const existingBlocks = normalizeTemplate(tmpl ?? null);

            let updatedTables: GoalTableBlock[];
            if (existingBlocks.length === 0) {
              // No template exists — use Claude's suggested structure entirely
              updatedTables = tablesWithNewCols.map(t => ({
                id: t.tableId, title: '', type: 'horizontal' as const, columns: t.columns!,
              }));
            } else {
              // Merge: update columns for blocks that Claude changed, keep existing for others
              updatedTables = existingBlocks.map(block => {
                const uploaded = result.tables!.find(t => t.tableId === block.id);
                if (uploaded?.columns && uploaded.columns.length > 0) {
                  return { id: block.id, title: block.title || '', type: block.type, columns: uploaded.columns };
                }
                return { id: block.id, title: block.title || '', type: block.type, columns: block.columns };
              });
            }
            await saveTemplateStructure(updatedTables);
          }
        }

        await goalPlansApi.save(kidId, libraryItemId, {
          goalTitle: result.goalTitle,
          tables: result.tables.map(t => ({ tableId: t.tableId, rows: t.rows || [] })),
        });
      } else {
        // Legacy single-block fallback
        const blockId = result.targetBlockId || 'uploaded';
        if (shouldUpdate && result.columns && result.columns.length > 0) {
          await saveTemplateStructure([{ id: blockId, title: '', type: 'horizontal', columns: result.columns }]);
        }
        await goalPlansApi.save(kidId, libraryItemId, {
          goalTitle: result.goalTitle,
          tables: [{ tableId: blockId, rows: result.rows || [] }],
        });
      }

      queryClient.invalidateQueries({ queryKey: ['goal-lp', kidId, libraryItemId] });
    },
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message || 'שגיאה בשמירה'),
  });

  // ---- Save DC ----
  const saveDcMutation = useMutation({
    mutationFn: async () => {
      if (!result) return;
      const blockId = result.targetBlockId || 'uploaded';
      if (isSuperAdmin && updateStructure && result.columns && result.columns.length > 0) {
        await goalTemplatesApi.updateTemplates(libraryItemId, {
          dataCollectionTemplate: { tables: [{ id: blockId, title: '', type: 'horizontal', columns: result.columns }] },
        });
        queryClient.invalidateQueries({ queryKey: ['goals-library-all'] });
        queryClient.invalidateQueries({ queryKey: ['goals'] });
      }
      const entries = (result.entries || []).map(e => {
        const { sessionDate, ...row } = e;
        return {
          goalTitle: result.goalTitle,
          sessionDate: sessionDate || new Date().toISOString().slice(0, 10),
          practitionerId: practitionerId || undefined,
          tables: [{ tableId: blockId, rows: [row as GoalFormRow] }],
        };
      });
      await goalDataApi.bulkAddEntries(kidId, libraryItemId, entries);
      queryClient.invalidateQueries({ queryKey: ['goal-data', kidId, libraryItemId] });
    },
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message || 'שגיאה בשמירה'),
  });

  const isSaving = saveLpMutation.isPending || saveDcMutation.isPending;

  function handleSave() {
    setError(null);
    if (formType === 'lp') saveLpMutation.mutate();
    else saveDcMutation.mutate();
  }

  // ---- Preview helpers ----
  const templateBlocks = normalizeTemplate(
    (formType === 'lp' ? goal.learningPlanTemplate : goal.dataCollectionTemplate) ?? null
  );

  // For multi-block LP, build preview per block
  function hasMultiBlockResult(): boolean {
    return formType === 'lp' && !!result?.tables && result.tables.length > 0;
  }

  function renderMultiBlockPreview() {
    if (!result?.tables) return null;
    return result.tables.map(table => {
      const block = templateBlocks.find(b => b.id === table.tableId);
      const cols = (table.columns && table.columns.length > 0) ? table.columns : (block?.columns || []);
      const rows = table.rows || [];
      const isVertical = block?.type === 'vertical';
      const title = block?.title || table.tableId;

      return (
        <div key={table.tableId} style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: '0.82em', color: '#4338ca', background: '#eef2ff', padding: '6px 10px', borderRadius: '6px 6px 0 0', border: '1px solid #c7d2fe', borderBottom: 'none' }}>
            {title} ({isVertical ? 'שדות' : `${rows.length} שורות`})
          </div>
          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '0 0 8px 8px' }}>
            {isVertical && rows[0] ? (
              <ReadOnlyVerticalBlock block={{ ...block!, columns: cols as GoalColumnDef[] } as GoalTableBlock} row={rows[0]} />
            ) : (
              <ReadOnlyGoalTable columns={cols as GoalColumnDef[]} rows={rows} />
            )}
          </div>
          {table.columns && table.columns.length > 0 && isSuperAdmin && updateStructure && (
            <div style={{ fontSize: '0.75em', color: '#92400e', marginTop: 4 }}>
              ⚠️ מבנה עמודות חדש יעודכן בתבנית
            </div>
          )}
        </div>
      );
    });
  }

  // Legacy single-block preview
  function previewColumns(): GoalColumnDef[] {
    if (result?.columns && result.columns.length > 0) return result.columns;
    if (result?.targetBlockId) {
      const targetBlock = templateBlocks.find(b => b.id === result.targetBlockId);
      if (targetBlock) return targetBlock.columns;
    }
    return templateBlocks.flatMap(b => b.columns);
  }

  function previewRows(): GoalFormRow[] {
    if (formType === 'lp') return result?.rows || [];
    return (result?.entries || []).map(e => {
      const { sessionDate, ...row } = e;
      return row as GoalFormRow;
    });
  }

  function previewDates(): string[] | undefined {
    if (formType !== 'dc') return undefined;
    return (result?.entries || []).map(e => {
      if (!e.sessionDate) return '—';
      try {
        return new Date(e.sessionDate).toLocaleDateString('he-IL');
      } catch {
        return e.sessionDate;
      }
    });
  }

  const formLabel = formType === 'lp' ? 'תוכנית למידה' : 'איסוף נתונים';

  // Count total rows across all blocks for summary
  const totalRows = hasMultiBlockResult()
    ? (result?.tables || []).reduce((sum, t) => sum + (t.rows?.length || 0), 0)
    : previewRows().length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 720, width: '95vw', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div>
            <h3 style={{ margin: 0 }}>העלאת קובץ — {formLabel}</h3>
            <div style={{ fontSize: '0.82em', color: '#64748b', marginTop: 2 }}>{goal.title}</div>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.3em', cursor: 'pointer', color: '#94a3b8', padding: '0 4px' }}>
            ✕
          </button>
        </div>

        {/* Step: pick */}
        {(step === 'pick' || step === 'processing') && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: '0.85em', color: '#475569', lineHeight: 1.6 }}>
              העלה קובץ Word (doc/docx) הכולל {formType === 'lp' ? 'תוכנית למידה' : 'נתוני טיפול'} — Claude ינתח את המסמך וישלוף את הנתונים אוטומטית.
            </div>

            {/* File picker */}
            <div
              style={{
                border: '2px dashed #c7d2fe', borderRadius: 10, padding: '20px 24px',
                textAlign: 'center', background: '#f8f9ff', cursor: 'pointer',
              }}
              onClick={() => fileRef.current?.click()}
            >
              <div style={{ fontSize: '2em', marginBottom: 6 }}>📄</div>
              <div style={{ fontSize: '0.88em', color: '#4f46e5', fontWeight: 600 }}>לחץ לבחירת קובץ</div>
              <div style={{ fontSize: '0.75em', color: '#94a3b8', marginTop: 4 }}>docx עד 20MB</div>
              <input
                ref={fileRef}
                type="file"
                accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                style={{ display: 'none' }}
                onChange={() => {
                  const name = fileRef.current?.files?.[0]?.name ?? null;
                  setSelectedFileName(name);
                  if (name) setError(null);
                }}
              />
              {selectedFileName && (
                <div style={{ marginTop: 8, fontSize: '0.82em', color: '#334155', fontWeight: 500 }}>
                  📎 {selectedFileName}
                </div>
              )}
            </div>

            {/* Super-admin: updateStructure toggle (hidden when forced) */}
            {isSuperAdmin && !forceUpdateStructure && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85em', color: '#334155', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={updateStructure}
                  onChange={e => setUpdateStructure(e.target.checked)}
                  style={{ accentColor: '#667eea', width: 16, height: 16 }}
                />
                <span>
                  <strong>עדכן מבנה הטבלה</strong> — אם הקובץ מכיל עמודות שונות, עדכן את תבנית המטרה בהתאם
                  <span style={{ color: '#94a3b8', fontSize: '0.9em', marginRight: 4 }}>(מנהל על בלבד)</span>
                </span>
              </label>
            )}

            {error && (
              <div style={{ color: '#ef4444', fontSize: '0.83em', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" onClick={onClose} style={{ background: 'rgba(167,139,250,.08)', color: '#a78bfa', border: 'none', padding: '8px 18px', borderRadius: 8, fontWeight: 600, fontSize: '0.9em', cursor: 'pointer' }}>ביטול</button>
              <button
                type="button"
                onClick={handleProcess}
                disabled={step === 'processing'}
                style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 8, fontWeight: 600, fontSize: '0.9em', cursor: 'pointer', minWidth: 120, opacity: step === 'processing' ? 0.6 : 1 }}
              >
                {step === 'processing' ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="spinner" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                    מעבד...
                  </span>
                ) : 'עבד קובץ'}
              </button>
            </div>
          </div>
        )}

        {/* Step: preview */}
        {step === 'preview' && result && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: '0.85em', fontWeight: 600, color: '#334155' }}>
              {formType === 'lp'
                ? `נמצאו נתונים (${totalRows} שורות) — בדוק ואשר:`
                : `נמצאו ${totalRows} רשומות — בדוק ואשר:`}
            </div>

            {/* Multi-block preview */}
            {hasMultiBlockResult() ? (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {renderMultiBlockPreview()}
              </div>
            ) : (
              /* Single-block preview */
              (() => {
                const cols = previewColumns();
                const rows = previewRows();
                const dates = previewDates();
                return cols.length > 0 && rows.length > 0 ? (
                  <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                    <ReadOnlyGoalTable
                      columns={cols}
                      rows={rows}
                      firstColumn={dates ? { label: 'תאריך', values: dates } : undefined}
                    />
                  </div>
                ) : (
                  <div style={{ color: '#94a3b8', fontSize: '0.85em' }}>לא ניתן להציג תצוגה מקדימה — אין עמודות תואמות.</div>
                );
              })()
            )}

            {/* Structure update notice */}
            {isSuperAdmin && updateStructure && (
              (result.columns && result.columns.length > 0) ||
              (result.tables && result.tables.some(t => t.columns && t.columns.length > 0))
            ) && (
              <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', fontSize: '0.83em', color: '#92400e' }}>
                ⚠️ Claude זיהה מבנה שונה מהתבנית הקיימת ויעדכן את העמודות בעת השמירה.
              </div>
            )}

            {formType === 'lp' && (
              <div style={{ fontSize: '0.78em', color: '#94a3b8', background: '#f8fafc', padding: '8px 12px', borderRadius: 6 }}>
                שמירה תחליף את תוכנית הלמידה הקיימת לילד זה עבור מטרה זו.
              </div>
            )}
            {formType === 'dc' && (
              <div style={{ fontSize: '0.78em', color: '#94a3b8', background: '#f8fafc', padding: '8px 12px', borderRadius: 6 }}>
                שמירה תוסיף את הרשומות לנתונים הקיימים.
              </div>
            )}

            {error && (
              <div style={{ color: '#ef4444', fontSize: '0.83em', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setStep('pick'); setResult(null); }} style={{ background: 'rgba(167,139,250,.08)', color: '#a78bfa', border: 'none', padding: '8px 18px', borderRadius: 8, fontWeight: 600, fontSize: '0.9em', cursor: 'pointer' }}>חזור</button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 8, fontWeight: 600, fontSize: '0.9em', cursor: 'pointer', opacity: isSaving ? 0.6 : 1 }}
              >
                {isSaving ? 'שומר...' : 'אשר ושמור'}
              </button>
            </div>
          </div>
        )}

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}
