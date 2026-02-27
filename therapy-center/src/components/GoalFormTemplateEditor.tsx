import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { goalTemplatesApi } from '../api/client';
import {
  PRESET_LP_PROGRAM,
  PRESET_DC_ACTIVITY,
  PRESET_DC_DTT,
  normalizeTemplate,
} from '../types';
import type { GoalFormTemplate, GoalTableBlock, GoalTableType, GoalColumnDef, GoalColumnType, GoalLibraryItem } from '../types';

function makeId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// -------- Column type — compact pill toggle --------
const TYPE_LABELS: Record<GoalColumnType, string> = {
  text: 'טקסט',
  date: 'תאריך',
  options: 'אפשרויות',
};

function TypePills({ value, onChange }: { value: GoalColumnType; onChange: (t: GoalColumnType) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {(Object.keys(TYPE_LABELS) as GoalColumnType[]).map(t => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          style={{
            padding: '3px 9px',
            border: `1.5px solid ${value === t ? '#667eea' : '#d1d5db'}`,
            borderRadius: 20,
            cursor: 'pointer',
            fontSize: '0.76em',
            background: value === t ? '#eef2ff' : 'white',
            color: value === t ? '#4f46e5' : '#64748b',
            fontWeight: value === t ? 600 : 400,
            whiteSpace: 'nowrap',
          }}
        >
          {TYPE_LABELS[t]}
        </button>
      ))}
    </div>
  );
}

// -------- Options chip editor --------
function OptionsEditor({ options, onChange }: { options: string[]; onChange: (opts: string[]) => void }) {
  const [draft, setDraft] = useState('');

  function commit() {
    const val = draft.trim();
    if (val && !options.includes(val)) onChange([...options, val]);
    setDraft('');
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
    if (e.key === 'Backspace' && !draft && options.length > 0) onChange(options.slice(0, -1));
  }

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center',
      border: '1.5px solid #e2e8f0', borderRadius: 7, padding: '5px 9px',
      background: '#fafafa', minHeight: 34, cursor: 'text',
      marginTop: 6,
    }}>
      {options.map((opt, i) => (
        <span key={i} style={{
          display: 'inline-flex', alignItems: 'center', gap: 2,
          background: '#eef2ff', color: '#4f46e5', borderRadius: 12,
          padding: '2px 9px', fontSize: '0.8em', fontWeight: 500,
        }}>
          {opt}
          <button type="button" onClick={() => onChange(options.filter((_, j) => j !== i))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#818cf8', fontSize: '1em', padding: 0, lineHeight: 1, marginRight: 2 }}>×</button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={handleKey}
        onBlur={commit}
        placeholder={options.length === 0 ? 'הקלד ולחץ Enter...' : ''}
        style={{
          border: 'none', outline: 'none', fontSize: '0.8em', flex: 1, minWidth: 80,
          background: 'transparent', padding: '1px 0',
        }}
      />
    </div>
  );
}

// -------- Single column row — compact single-line layout --------
function ColumnRow({ col, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast }: {
  col: GoalColumnDef;
  onChange: (c: GoalColumnDef) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div style={{ marginBottom: 5 }}>
      {/* Main row: order | name | type | remove */}
      <div style={{
        display: 'flex', gap: 7, alignItems: 'center',
        padding: '7px 10px',
        background: 'white',
        border: '1.5px solid #e2e8f0',
        borderRadius: col.type === 'options' ? '8px 8px 0 0' : 8,
        borderBottom: col.type === 'options' ? '1px solid #f1f5f9' : undefined,
      }}>
        {/* Order arrows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
          <button type="button" onClick={onMoveUp} disabled={isFirst}
            style={{ background: 'none', border: 'none', cursor: isFirst ? 'default' : 'pointer', color: isFirst ? '#e2e8f0' : '#94a3b8', fontSize: '0.65em', padding: 0, lineHeight: 1 }}>▲</button>
          <button type="button" onClick={onMoveDown} disabled={isLast}
            style={{ background: 'none', border: 'none', cursor: isLast ? 'default' : 'pointer', color: isLast ? '#e2e8f0' : '#94a3b8', fontSize: '0.65em', padding: 0, lineHeight: 1 }}>▼</button>
        </div>

        {/* Name input */}
        <input
          type="text"
          value={col.label}
          onChange={e => onChange({ ...col, label: e.target.value })}
          placeholder="שם עמודה..."
          autoComplete="off"
          style={{
            flex: 1,
            minWidth: 80,
            padding: '5px 9px',
            border: '1.5px solid #e2e8f0',
            borderRadius: 6,
            fontSize: '0.87em',
            fontWeight: 500,
            outline: 'none',
            background: 'white',
            color: '#1e293b',
            fontFamily: 'inherit',
          }}
        />

        {/* Type pills */}
        <TypePills
          value={col.type}
          onChange={t => onChange({ ...col, type: t, options: t === 'options' ? (col.options || []) : undefined })}
        />

        {/* Remove */}
        <button type="button" onClick={onRemove}
          style={{
            background: 'none', border: '1.5px solid #fecaca', borderRadius: 5,
            color: '#ef4444', cursor: 'pointer', fontSize: '0.85em', padding: '3px 7px', flexShrink: 0,
          }}>✕</button>
      </div>

      {/* Options editor — shown below when type=options */}
      {col.type === 'options' && (
        <div style={{
          padding: '6px 10px',
          background: 'white',
          border: '1.5px solid #e2e8f0',
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
        }}>
          <div style={{ fontSize: '0.73em', color: '#94a3b8', marginBottom: 4 }}>אפשרויות:</div>
          <OptionsEditor
            options={col.options || []}
            onChange={opts => onChange({ ...col, options: opts })}
          />
        </div>
      )}
    </div>
  );
}

// -------- Block preview (used in both side panel and fullscreen) --------
function BlockPreview({ block }: { block: GoalTableBlock }) {
  const { type, columns } = block;
  if (columns.length === 0) {
    return (
      <div style={{ border: '2px dashed #e2e8f0', borderRadius: 8, padding: '12px', textAlign: 'center', color: '#cbd5e1', fontSize: '0.8em' }}>
        {type === 'vertical' ? 'שדות יוצגו כאן' : 'עמודות יוצגו כאן'}
      </div>
    );
  }

  if (type === 'vertical') {
    return (
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        {columns.map((col, i) => (
          <div key={col.id} style={{
            display: 'grid', gridTemplateColumns: '140px 1fr',
            borderBottom: i < columns.length - 1 ? '1px solid #f1f5f9' : 'none',
          }}>
            <div style={{ background: '#f8fafc', padding: '7px 10px', fontSize: '0.8em', fontWeight: 600, color: '#475569', borderLeft: '1px solid #e2e8f0' }}>
              {col.label || '—'}
            </div>
            <div style={{ padding: '7px 10px', fontSize: '0.8em', color: '#cbd5e1', fontStyle: 'italic' }}>
              {col.type === 'date' ? '01/01/2025' : col.type === 'options' ? (col.options?.[0] || '—') : 'טקסט...'}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
      <table style={{ borderCollapse: 'collapse', fontSize: '0.8em', minWidth: '100%' }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.id} style={{
                padding: '6px 10px', background: '#f8fafc', border: '1px solid #e2e8f0',
                textAlign: 'right', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap',
              }}>
                {col.label || '—'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[0, 1].map(ri => (
            <tr key={ri}>
              {columns.map(col => (
                <td key={col.id} style={{ padding: '6px 10px', border: '1px solid #f1f5f9', color: '#cbd5e1', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                  {col.type === 'date' ? (ri === 0 ? '01/01/2025' : '15/03/2025') : col.type === 'options' ? (col.options?.[ri % (col.options?.length || 1)] || '—') : 'טקסט...'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -------- Live preview panel --------
function LivePreviewPanel({ blocks, title }: { blocks: GoalTableBlock[]; title: string }) {
  const hasAny = blocks.some(b => b.columns.length > 0);
  return (
    <div>
      {!hasAny ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#cbd5e1', fontSize: '0.85em', lineHeight: 1.8 }}>
          הוסף עמודות<br />כדי לראות תצוגה מקדימה
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {blocks.filter(b => b.columns.length > 0).map((block, idx) => (
            <div key={block.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                <span style={{ fontSize: '0.7em', fontWeight: 700, color: '#6366f1', background: '#e0e7ff', borderRadius: 20, padding: '2px 8px' }}>
                  {idx + 1}
                </span>
                {block.title && <span style={{ fontSize: '0.82em', fontWeight: 600, color: '#334155' }}>{block.title}</span>}
                <span style={{ fontSize: '0.71em', color: '#94a3b8' }}>({block.type === 'vertical' ? 'אנכי' : 'אופקי'})</span>
              </div>
              <BlockPreview block={block} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -------- Table block editor --------
const TABLE_TYPE_CARDS: { type: GoalTableType; label: string; desc: string }[] = [
  { type: 'vertical', label: 'אנכי', desc: 'שדה אחד לכל שורה — לפרטים והוראות' },
  { type: 'horizontal', label: 'אופקי', desc: 'עמודות עם שורות — לטבלאות נתונים' },
];

function TableBlockEditor({ block, idx, total, onChange, onRemove, onMoveUp, onMoveDown }: {
  block: GoalTableBlock;
  idx: number;
  total: number;
  onChange: (b: GoalTableBlock) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  function addColumn() {
    onChange({ ...block, columns: [...block.columns, { id: makeId(), label: '', type: 'text' }] });
  }

  function updateColumn(colIdx: number, col: GoalColumnDef) {
    onChange({ ...block, columns: block.columns.map((c, i) => i === colIdx ? col : c) });
  }

  function removeColumn(colIdx: number) {
    onChange({ ...block, columns: block.columns.filter((_, i) => i !== colIdx) });
  }

  function moveColumn(colIdx: number, dir: -1 | 1) {
    const cols = [...block.columns];
    const swap = colIdx + dir;
    if (swap < 0 || swap >= cols.length) return;
    [cols[colIdx], cols[swap]] = [cols[swap], cols[colIdx]];
    onChange({ ...block, columns: cols });
  }

  return (
    <div style={{
      border: '2px solid #c7d2fe',
      borderRadius: 12,
      marginBottom: 14,
      background: '#fafbff',
      overflow: 'hidden',
    }}>
      {/* Header bar */}
      <div style={{
        background: '#eef2ff',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: '1px solid #c7d2fe',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
          <button type="button" onClick={onMoveUp} disabled={idx === 0}
            style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? '#c7d2fe' : '#6366f1', fontSize: '0.72em', padding: 0, lineHeight: 1 }}>▲</button>
          <button type="button" onClick={onMoveDown} disabled={idx === total - 1}
            style={{ background: 'none', border: 'none', cursor: idx === total - 1 ? 'default' : 'pointer', color: idx === total - 1 ? '#c7d2fe' : '#6366f1', fontSize: '0.72em', padding: 0, lineHeight: 1 }}>▼</button>
        </div>

        <span style={{ fontSize: '0.73em', fontWeight: 700, color: '#6366f1', background: '#e0e7ff', borderRadius: 20, padding: '2px 9px', flexShrink: 0 }}>
          טבלה {idx + 1}
        </span>

        <input
          type="text"
          value={block.title || ''}
          onChange={e => onChange({ ...block, title: e.target.value })}
          placeholder="כותרת (אופציונלי)..."
          style={{
            flex: 1, padding: '4px 8px', border: '1.5px solid #c7d2fe', borderRadius: 6,
            fontSize: '0.87em', fontWeight: 500, outline: 'none',
            background: 'white', color: '#1e293b', fontFamily: 'inherit',
          }}
        />

        {total > 1 && (
          <button type="button" onClick={onRemove}
            style={{ background: 'none', border: '1.5px solid #fecaca', borderRadius: 5, color: '#ef4444', cursor: 'pointer', fontSize: '0.75em', padding: '3px 8px', flexShrink: 0 }}>
            הסר
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '11px 13px' }}>
        {/* Type selector */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: '0.74em', fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>סוג טבלה:</div>
          <div style={{ display: 'flex', gap: 7 }}>
            {TABLE_TYPE_CARDS.map(tc => (
              <button
                key={tc.type}
                type="button"
                onClick={() => onChange({ ...block, type: tc.type })}
                style={{
                  flex: 1, padding: '8px 11px',
                  border: `2px solid ${block.type === tc.type ? '#667eea' : '#e2e8f0'}`,
                  borderRadius: 9,
                  background: block.type === tc.type ? '#eef2ff' : 'white',
                  cursor: 'pointer', textAlign: 'right',
                }}
              >
                <div style={{ fontSize: '0.87em', fontWeight: 700, color: block.type === tc.type ? '#4f46e5' : '#334155' }}>{tc.label}</div>
                <div style={{ fontSize: '0.71em', color: '#64748b', marginTop: 2 }}>{tc.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Column label */}
        <div style={{ fontSize: '0.74em', fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          {block.type === 'vertical' ? 'שדות:' : 'עמודות:'}
        </div>

        {block.columns.length === 0 && (
          <div style={{ border: '2px dashed #e2e8f0', borderRadius: 7, padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.82em', marginBottom: 6 }}>
            {block.type === 'vertical' ? 'הוסף שדות לטבלה' : 'הוסף עמודות לטבלה'}
          </div>
        )}

        {block.columns.map((col, colIdx) => (
          <ColumnRow
            key={col.id}
            col={col}
            onChange={c => updateColumn(colIdx, c)}
            onRemove={() => removeColumn(colIdx)}
            onMoveUp={() => moveColumn(colIdx, -1)}
            onMoveDown={() => moveColumn(colIdx, 1)}
            isFirst={colIdx === 0}
            isLast={colIdx === block.columns.length - 1}
          />
        ))}

        <button type="button" onClick={addColumn}
          style={{
            width: '100%', padding: '7px', border: '1.5px dashed #667eea', borderRadius: 7,
            background: 'none', color: '#667eea', cursor: 'pointer', fontSize: '0.83em', fontWeight: 600,
            marginTop: 2,
          }}>
          + {block.type === 'vertical' ? 'הוסף שדה' : 'הוסף עמודה'}
        </button>
      </div>
    </div>
  );
}

// -------- Preset strip --------
function PresetStrip({ formType, onLoad }: { formType: 'lp' | 'dc'; onLoad: (t: GoalFormTemplate) => void }) {
  const presets = formType === 'lp'
    ? [{ label: '📋 תוכנית למידה', desc: 'פרטי תוכנית + טבלת פריטים', preset: PRESET_LP_PROGRAM }]
    : [
        { label: '🏃 פעילות', desc: 'שיתוף פעולה / סיוע / קשיים', preset: PRESET_DC_ACTIVITY },
        { label: '✓✗ ניסויים DTT', desc: 'פריט / תגובה / הערות', preset: PRESET_DC_DTT },
      ];

  return (
    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 9, padding: '9px 14px', marginBottom: 0 }}>
      <div style={{ fontSize: '0.74em', fontWeight: 700, color: '#166534', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.03em' }}>טעינת תבנית מוכנה:</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {presets.map(p => (
          <button
            key={p.label}
            type="button"
            onClick={() => onLoad(p.preset)}
            style={{
              padding: '6px 13px', border: '1.5px solid #86efac', borderRadius: 8,
              background: 'white', cursor: 'pointer', textAlign: 'right',
            }}
          >
            <div style={{ fontSize: '0.87em', fontWeight: 700, color: '#15803d' }}>{p.label}</div>
            <div style={{ fontSize: '0.71em', color: '#64748b', marginTop: 1 }}>{p.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// -------- Main component --------
interface Props {
  goal: GoalLibraryItem;
  formType: 'lp' | 'dc';
  onClose: () => void;
}

export default function GoalFormTemplateEditor({ goal, formType, onClose }: Props) {
  const queryClient = useQueryClient();

  const existingTemplate = formType === 'lp' ? goal.learningPlanTemplate : goal.dataCollectionTemplate;
  const initialBlocks = normalizeTemplate(existingTemplate ?? null);

  const [blocks, setBlocks] = useState<GoalTableBlock[]>(
    initialBlocks.length > 0
      ? initialBlocks
      : [{ id: makeId(), title: '', type: 'horizontal', columns: [] }]
  );
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const hasExistingTemplate = initialBlocks.length > 0;

  function loadPreset(preset: GoalFormTemplate) {
    setBlocks(preset.tables.map(b => ({
      ...b,
      id: makeId(),
      columns: b.columns.map(c => ({ ...c, id: makeId() })),
    })));
  }

  function addBlock() {
    setBlocks(prev => [...prev, { id: makeId(), title: '', type: 'horizontal', columns: [] }]);
  }

  function updateBlock(idx: number, block: GoalTableBlock) {
    setBlocks(prev => prev.map((b, i) => i === idx ? block : b));
  }

  function removeBlock(idx: number) {
    setBlocks(prev => prev.filter((_, i) => i !== idx));
  }

  function moveBlock(idx: number, dir: -1 | 1) {
    setBlocks(prev => {
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const template: GoalFormTemplate = { tables: blocks };
      return goalTemplatesApi.updateTemplates(goal.id, {
        [formType === 'lp' ? 'learningPlanTemplate' : 'dataCollectionTemplate']: template,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals-library-all'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      goalTemplatesApi.updateTemplates(goal.id, {
        [formType === 'lp' ? 'learningPlanTemplate' : 'dataCollectionTemplate']: null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals-library-all'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      onClose();
    },
  });

  const title = formType === 'lp' ? 'תוכנית למידה' : 'איסוף נתונים';
  const hasColumns = blocks.some(b => b.columns.length > 0);

  return (
    <div className="modal-overlay" onClick={onClose}>

      {/* ── Fullscreen preview overlay ── */}
      {previewFullscreen && (
        <div
          style={{
            position: 'absolute', inset: 0, background: 'white', zIndex: 200,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 22px', borderBottom: '1px solid #e2e8f0', flexShrink: 0,
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1em', color: '#1e293b' }}>תצוגה מקדימה — {title}</div>
              <div style={{ fontSize: '0.82em', color: '#64748b', marginTop: 2 }}>{goal.title}</div>
            </div>
            <button
              onClick={() => setPreviewFullscreen(false)}
              style={{ background: 'none', border: '1.5px solid #e2e8f0', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontSize: '0.87em', color: '#475569', fontWeight: 500 }}
            >
              ✕ סגור
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', maxWidth: 900, width: '100%', margin: '0 auto' }}>
            <LivePreviewPanel blocks={blocks} title={title} />
          </div>
        </div>
      )}

      {/* ── Main modal ── */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(1180px, 97vw)',
          maxHeight: '94vh',
          background: 'white',
          borderRadius: 14,
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          padding: '15px 20px 11px',
          borderBottom: '1px solid #f1f5f9',
          flexShrink: 0,
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.07em', color: '#1e293b' }}>עריכת תבנית — {title}</h3>
            <div style={{ fontSize: '0.83em', color: '#64748b', marginTop: 3 }}>{goal.title}</div>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.3em', cursor: 'pointer', color: '#94a3b8', padding: '0 4px' }}>✕</button>
        </div>

        {/* Preset strip */}
        <div style={{ padding: '11px 20px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <PresetStrip formType={formType} onLoad={loadPreset} />
        </div>

        {/* Two-column main area */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

          {/* Left: editor */}
          <div style={{
            flex: '0 0 56%',
            overflowY: 'auto',
            padding: '14px 12px 14px 20px',
            borderLeft: '1px solid #f1f5f9',
          }}>
            <div style={{ fontSize: '0.76em', color: '#94a3b8', marginBottom: 12, lineHeight: 1.6 }}>
              הגדר טבלאות עם עמודות/שדות. ניתן להוסיף מספר טבלאות — כל אחת תוצג בנפרד בטופס.
            </div>

            {blocks.map((block, idx) => (
              <TableBlockEditor
                key={block.id}
                block={block}
                idx={idx}
                total={blocks.length}
                onChange={b => updateBlock(idx, b)}
                onRemove={() => removeBlock(idx)}
                onMoveUp={() => moveBlock(idx, -1)}
                onMoveDown={() => moveBlock(idx, 1)}
              />
            ))}

            <button type="button" onClick={addBlock}
              style={{
                width: '100%', padding: '9px', border: '2px dashed #c7d2fe', borderRadius: 9,
                background: '#fafbff', color: '#6366f1', cursor: 'pointer', fontSize: '0.87em', fontWeight: 600,
              }}>
              + הוסף טבלה
            </button>
          </div>

          {/* Right: live preview */}
          <div style={{
            flex: '0 0 44%',
            overflowY: 'auto',
            padding: '14px 20px 14px 12px',
            background: '#f8fafc',
          }}>
            {/* Preview header with fullscreen button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: '0.74em', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                תצוגה מקדימה
              </div>
              <button
                type="button"
                onClick={() => setPreviewFullscreen(true)}
                title="הגדל תצוגה מקדימה"
                style={{
                  background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 6,
                  padding: '3px 9px', cursor: 'pointer', fontSize: '0.82em', color: '#475569',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <span style={{ fontSize: '1.1em' }}>⛶</span> הגדל
              </button>
            </div>
            <LivePreviewPanel blocks={blocks} title={title} />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10,
          padding: '11px 20px',
          borderTop: '1px solid #f1f5f9',
          flexShrink: 0,
        }}>
          {/* Delete template — only if one exists */}
          {hasExistingTemplate && !confirmDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              style={{ marginRight: 'auto', background: 'none', border: '1px solid #fca5a5', borderRadius: 6, color: '#ef4444', fontSize: '0.82em', padding: '5px 12px', cursor: 'pointer' }}
            >
              מחק תבנית
            </button>
          )}
          {confirmDelete && (
            <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.83em', color: '#ef4444' }}>
              <span>למחוק את התבנית לגמרי?</span>
              <button
                type="button"
                className="btn-danger btn-small"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'מוחק...' : 'כן, מחק'}
              </button>
              <button type="button" className="btn-secondary btn-small" onClick={() => setConfirmDelete(false)}>ביטול</button>
            </div>
          )}

          {(saveMutation.isError || deleteMutation.isError) && (
            <div style={{ color: '#ef4444', fontSize: '0.82em' }}>
              {((saveMutation.error || deleteMutation.error) as Error)?.message || 'שגיאה'}
            </div>
          )}
          <button type="button" className="btn-secondary" onClick={onClose}>ביטול</button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !hasColumns}
          >
            {saveMutation.isPending ? 'שומר...' : 'שמור תבנית'}
          </button>
        </div>
      </div>
    </div>
  );
}
