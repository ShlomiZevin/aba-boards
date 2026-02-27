import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { goalFormUploadApi, goalDataApi, goalPlansApi, goalTemplatesApi, type GoalFormUploadResult } from '../api/client';
import { ReadOnlyGoalTable } from './GoalFormRenderer';
import { normalizeTemplate } from '../types';
import type { Goal, GoalFormRow, GoalColumnDef } from '../types';
// GoalFormUploadResult.targetBlockId is used to know which template block the extracted data belongs to

interface Props {
  kidId: string;
  goal: Goal;
  formType: 'lp' | 'dc';
  isSuperAdmin: boolean;
  practitionerId?: string;
  onClose: () => void;
  onSaved: () => void;
}

type Step = 'pick' | 'processing' | 'preview' | 'saving';

export default function GoalFileUpload({ kidId, goal, formType, isSuperAdmin, practitionerId, onClose, onSaved }: Props) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const libraryItemId = goal.libraryItemId!;

  const [step, setStep] = useState<Step>('pick');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [updateStructure, setUpdateStructure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GoalFormUploadResult | null>(null);

  // ---- Upload & extract ----
  async function handleProcess() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError('נא לבחור קובץ'); return; }

    setError(null);
    setStep('processing');

    const res = await goalFormUploadApi.upload(kidId, libraryItemId, file, formType, updateStructure && isSuperAdmin);

    if (!res.success || !res.data) {
      setError(res.error || 'שגיאה בעיבוד הקובץ');
      setStep('pick');
      return;
    }

    const data = res.data;
    const hasContent = formType === 'lp' ? (data.rows && data.rows.length > 0) : (data.entries && data.entries.length > 0);
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
      const blockId = result.targetBlockId || 'uploaded';
      // If super-admin chose updateStructure and Claude returned new columns, update template first
      if (isSuperAdmin && updateStructure && result.columns && result.columns.length > 0) {
        await goalTemplatesApi.updateTemplates(libraryItemId, {
          learningPlanTemplate: { tables: [{ id: blockId, title: '', type: 'horizontal', columns: result.columns }] },
        });
        queryClient.invalidateQueries({ queryKey: ['goals-library-all'] });
        queryClient.invalidateQueries({ queryKey: ['goals'] });
      }
      await goalPlansApi.save(kidId, libraryItemId, {
        goalTitle: result.goalTitle,
        tables: [{ tableId: blockId, rows: result.rows || [] }],
      });
      queryClient.invalidateQueries({ queryKey: ['goal-plan', kidId, libraryItemId] });
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

  // ---- Derive preview columns from result or goal ----
  function previewColumns(): GoalColumnDef[] {
    if (result?.columns && result.columns.length > 0) return result.columns;
    const tmpl = formType === 'lp' ? goal.learningPlanTemplate : goal.dataCollectionTemplate;
    const blocks = normalizeTemplate(tmpl ?? null);
    // Show columns from the target block specifically, or all columns if block not found
    if (result?.targetBlockId) {
      const targetBlock = blocks.find(b => b.id === result.targetBlockId);
      if (targetBlock) return targetBlock.columns;
    }
    return blocks.flatMap(b => b.columns);
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
  const cols = previewColumns();
  const rows = previewRows();
  const dates = previewDates();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 680, width: '95vw', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}
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
              <div style={{ fontSize: '0.75em', color: '#94a3b8', marginTop: 4 }}>doc, docx עד 20MB</div>
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

            {/* Super-admin: updateStructure toggle */}
            {isSuperAdmin && (
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
              <button type="button" className="btn-secondary" onClick={onClose}>ביטול</button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleProcess}
                disabled={step === 'processing'}
                style={{ minWidth: 120 }}
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
            {/* Structure update notice */}
            {result.columns && result.columns.length > 0 && isSuperAdmin && updateStructure && (
              <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', fontSize: '0.83em', color: '#92400e' }}>
                ⚠️ Claude זיהה מבנה שונה מהתבנית הקיימת ויעדכן את העמודות בעת השמירה.
              </div>
            )}

            <div style={{ fontSize: '0.85em', fontWeight: 600, color: '#334155' }}>
              {formType === 'lp'
                ? `נמצאו ${rows.length} שורות בתוכנית הלמידה — בדוק ואשר:`
                : `נמצאו ${rows.length} רשומות — בדוק ואשר:`}
            </div>

            {cols.length > 0 && rows.length > 0 ? (
              <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <ReadOnlyGoalTable
                  columns={cols}
                  rows={rows}
                  firstColumn={dates ? { label: 'תאריך', values: dates } : undefined}
                />
              </div>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: '0.85em' }}>לא ניתן להציג תצוגה מקדימה — אין עמודות תואמות.</div>
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
              <button type="button" className="btn-secondary" onClick={() => { setStep('pick'); setResult(null); }}>חזור</button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSave}
                disabled={isSaving}
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
