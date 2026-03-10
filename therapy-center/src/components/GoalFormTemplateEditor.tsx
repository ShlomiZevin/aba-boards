import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalTemplatesApi, goalsApi } from '../api/client';
import {
  PRESET_LP_PROGRAM,
  PRESET_DC_ACTIVITY,
  PRESET_DC_DTT,
  GOAL_CATEGORIES,
  normalizeTemplate,
} from '../types';
import type { GoalFormTemplate, GoalTableBlock, GoalTableType, GoalColumnDef, GoalColumnType, GoalLibraryItem } from '../types';

function makeId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// -------- Column type — compact pill toggle --------
const TYPE_LABELS: Record<string, string> = {
  text: 'טקסט',
  date: 'תאריך',
  options: 'אפשרויות',
  checkbox: 'סימון',
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
        borderRadius: (['options', 'repeated'].includes(col.type) || (col.type === 'repeated' && col.innerType === 'options')) ? '8px 8px 0 0' : 8,
        borderBottom: (['options', 'repeated'].includes(col.type) || (col.type === 'repeated' && col.innerType === 'options')) ? '1px solid #f1f5f9' : undefined,
      }}>
        {/* Order arrows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
          <button type="button" onClick={onMoveUp} disabled={isFirst}
            style={{ background: 'none', border: 'none', cursor: isFirst ? 'default' : 'pointer', color: isFirst ? '#e2e8f0' : '#94a3b8', fontSize: '0.65em', padding: 0, lineHeight: 1 }}>▲</button>
          <button type="button" onClick={onMoveDown} disabled={isLast}
            style={{ background: 'none', border: 'none', cursor: isLast ? 'default' : 'pointer', color: isLast ? '#e2e8f0' : '#94a3b8', fontSize: '0.65em', padding: 0, lineHeight: 1 }}>▼</button>
        </div>

        {/* Name + description inputs */}
        <div style={{ flex: 1, minWidth: 80, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <input
            type="text"
            value={col.label}
            onChange={e => onChange({ ...col, label: e.target.value })}
            placeholder="שם עמודה..."
            autoComplete="off"
            style={{
              width: '100%',
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
          <input
            type="text"
            value={col.description || ''}
            onChange={e => onChange({ ...col, description: e.target.value || undefined })}
            placeholder="תיאור (אופציונלי)..."
            autoComplete="off"
            style={{
              width: '100%',
              padding: '3px 9px',
              border: '1px solid #f1f5f9',
              borderRadius: 5,
              fontSize: '0.76em',
              outline: 'none',
              background: '#fafafa',
              color: '#94a3b8',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Type pills — show effective type (innerType for repeated, type otherwise) */}
        <TypePills
          value={(col.type === 'repeated' ? (col.innerType || 'checkbox') : col.type) as GoalColumnType}
          onChange={t => {
            if (col.type === 'repeated') {
              onChange({ ...col, innerType: t, options: t === 'options' ? (col.options || []) : undefined });
            } else {
              onChange({ ...col, type: t, options: t === 'options' ? (col.options || []) : undefined });
            }
          }}
        />

        {/* Repeated toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', flexShrink: 0 }}>
          <input
            type="checkbox"
            checked={col.type === 'repeated'}
            onChange={e => {
              if (e.target.checked) {
                onChange({ ...col, type: 'repeated', innerType: col.type === 'repeated' ? col.innerType : col.type, repeatCount: col.repeatCount || 10 });
              } else {
                const effectiveType = col.innerType || 'text';
                onChange({ ...col, type: effectiveType, innerType: undefined, repeatCount: undefined });
              }
            }}
            style={{ width: 14, height: 14, accentColor: '#667eea', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.73em', color: '#64748b', whiteSpace: 'nowrap' }}>חוזר</span>
        </label>

        {/* Remove */}
        <button type="button" onClick={onRemove}
          style={{
            background: 'none', border: '1.5px solid #fecaca', borderRadius: 5,
            color: '#ef4444', cursor: 'pointer', fontSize: '0.85em', padding: '3px 7px', flexShrink: 0,
          }}>✕</button>
      </div>

      {/* Options editor — shown when effective type is options */}
      {((col.type === 'options') || (col.type === 'repeated' && col.innerType === 'options')) && (
        <div style={{
          padding: '6px 10px',
          background: 'white',
          border: '1.5px solid #e2e8f0',
          borderTop: 'none',
          borderRadius: col.type === 'repeated' ? undefined : '0 0 8px 8px',
        }}>
          <div style={{ fontSize: '0.73em', color: '#94a3b8', marginBottom: 4 }}>אפשרויות:</div>
          <OptionsEditor
            options={col.options || []}
            onChange={opts => onChange({ ...col, options: opts })}
          />
        </div>
      )}

      {/* Repeated column config — repeat count */}
      {col.type === 'repeated' && (
        <div style={{
          padding: '8px 10px',
          background: 'white',
          border: '1.5px solid #e2e8f0',
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: '0.73em', color: '#94a3b8' }}>מספר חזרות:</span>
          <input
            type="number"
            min={2}
            max={50}
            value={col.repeatCount || 10}
            onChange={e => onChange({ ...col, repeatCount: Math.max(2, Math.min(50, parseInt(e.target.value) || 10)) })}
            style={{
              width: 70, padding: '4px 8px', border: '1.5px solid #e2e8f0',
              borderRadius: 6, fontSize: '0.85em', fontFamily: 'inherit',
            }}
          />
        </div>
      )}
    </div>
  );
}

// -------- Preview cell content helper --------
function PreviewCellContent({ col, rowIdx }: { col: GoalColumnDef; rowIdx: number }) {
  if (col.type === 'checkbox') {
    const checked = rowIdx === 0;
    return <span style={{ color: checked ? '#16a34a' : '#ef4444', fontWeight: 600 }}>{checked ? '✓' : '✗'}</span>;
  }
  if (col.type === 'date') {
    return <span style={{ color: '#94a3b8' }}>{rowIdx === 0 ? '01/01/2025' : '15/03/2025'}</span>;
  }
  if (col.type === 'options') {
    const opts = col.options || [];
    if (opts.length === 0) return <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>—</span>;
    const val = opts[rowIdx % opts.length];
    return (
      <span style={{
        background: '#eef2ff', color: '#4f46e5', borderRadius: 10,
        padding: '1px 8px', fontSize: '0.92em', fontWeight: 500,
      }}>
        {val}
      </span>
    );
  }
  if (col.type === 'repeated') {
    const count = col.repeatCount || 10;
    const innerCol: GoalColumnDef = { id: 'preview', label: '', type: col.innerType || 'checkbox', options: col.options };
    return (
      <div style={{ display: 'flex', gap: 2 }}>
        {Array.from({ length: Math.min(count, 6) }).map((_, i) => (
          <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 4, padding: '1px 4px', minWidth: 22, textAlign: 'center' }}>
            <PreviewCellContent col={innerCol} rowIdx={i} />
          </div>
        ))}
        {count > 6 && <span style={{ color: '#94a3b8', fontSize: '0.8em' }}>...+{count - 6}</span>}
      </div>
    );
  }
  // text
  return <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>טקסט...</span>;
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
              {col.description && <div style={{ fontSize: '0.82em', color: '#94a3b8', fontWeight: 400, marginTop: 1 }}>{col.description}</div>}
            </div>
            <div style={{ padding: '7px 10px', fontSize: '0.8em' }}>
              <PreviewCellContent col={col} rowIdx={0} />
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
            {columns.map(col => col.type === 'repeated' ? (
              <th key={col.id} colSpan={col.repeatCount || 10} style={{
                padding: '6px 10px', background: '#f8fafc', border: '1px solid #e2e8f0',
                textAlign: 'center', fontWeight: 600, color: '#475569',
              }}>
                <div style={{ whiteSpace: 'nowrap' }}>{col.label || '—'}</div>
                {col.description && <div style={{ fontSize: '0.82em', color: '#94a3b8', fontWeight: 400, whiteSpace: 'nowrap' }}>{col.description}</div>}
              </th>
            ) : (
              <th key={col.id} style={{
                padding: '6px 10px', background: '#f8fafc', border: '1px solid #e2e8f0',
                textAlign: 'right', fontWeight: 600, color: '#475569',
              }}>
                <div style={{ whiteSpace: 'nowrap' }}>{col.label || '—'}</div>
                {col.description && <div style={{ fontSize: '0.82em', color: '#94a3b8', fontWeight: 400, whiteSpace: 'nowrap' }}>{col.description}</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[0, 1].map(ri => (
            <tr key={ri}>
              {columns.flatMap(col => {
                if (col.type === 'repeated') {
                  const count = col.repeatCount || 10;
                  const innerCol: GoalColumnDef = { id: 'inner', label: '', type: col.innerType || 'checkbox', options: col.options };
                  return Array.from({ length: count }).map((_, i) => (
                    <td key={`${col.id}__${i}`} style={{ padding: '4px 3px', border: '1px solid #f1f5f9', textAlign: 'center' }}>
                      <PreviewCellContent col={innerCol} rowIdx={ri + i} />
                    </td>
                  ));
                }
                return [(
                  <td key={col.id} style={{ padding: '6px 10px', border: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                    <PreviewCellContent col={col} rowIdx={ri} />
                  </td>
                )];
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -------- Live preview panel --------
function LivePreviewPanel({ blocks }: { blocks: GoalTableBlock[]; title?: string }) {
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
function PresetStrip({ formType, onLoad }: {
  formType: 'lp' | 'dc';
  onLoad: (t: GoalFormTemplate, presetName?: string) => void;
}) {
  const queryClient = useQueryClient();
  const builtInPresets = formType === 'lp'
    ? [{ label: '📋 תוכנית למידה', desc: 'פרטי תוכנית + טבלת פריטים', preset: PRESET_LP_PROGRAM }]
    : [
        { label: '🏃 פעילות', desc: 'שיתוף פעולה / סיוע / קשיים', preset: PRESET_DC_ACTIVITY },
        { label: '✓✗ ניסויים DTT', desc: 'פריט / תגובה / הערות', preset: PRESET_DC_DTT },
      ];

  const { data: libraryRes } = useQuery({
    queryKey: ['goals-library-all'],
    queryFn: () => goalsApi.getAllLibrary(),
  });

  const presetNameField = formType === 'lp' ? 'lpPresetName' : 'dcPresetName';
  const templateField = formType === 'lp' ? 'learningPlanTemplate' : 'dataCollectionTemplate';
  const allWithPreset = ((libraryRes?.data || []) as GoalLibraryItem[]).filter(
    g => g[presetNameField] && g[templateField]
  );
  // Deduplicate by column fingerprint (same columns = same template)
  const seen = new Set<string>();
  const savedPresets = allWithPreset.filter(g => {
    const cols = (g[templateField]?.tables || []).flatMap(t => t.columns || []);
    const key = cols.map(c => `${c.label}|${c.description || ''}`).join(';;');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const removePresetMutation = useMutation({
    mutationFn: (goalId: string) =>
      goalTemplatesApi.updateTemplates(goalId, { [presetNameField]: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals-library-all'] });
    },
  });

  return (
    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 9, padding: '9px 14px' }}>
      <div style={{ fontSize: '0.74em', fontWeight: 700, color: '#166534', marginBottom: 7 }}>תבניות מוכנות:</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {builtInPresets.map(p => (
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
        {savedPresets.map(g => {
          const cols = (g[templateField]?.tables || []).flatMap(t => t.columns || []);
          const colSummary = cols.length > 0
            ? cols.map(c => c.label).join(', ')
            : '';
          return (
          <div key={g.id} style={{ display: 'flex', alignItems: 'stretch', border: '1.5px solid #93c5fd', borderRadius: 8, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => onLoad(g[templateField]!, g[presetNameField] as string)}
              style={{
                padding: '6px 13px', background: 'white', cursor: 'pointer',
                textAlign: 'right', border: 'none',
              }}
            >
              <div style={{ fontSize: '0.87em', fontWeight: 700, color: '#1e40af' }}>{g[presetNameField]}</div>
              {colSummary && <div style={{ fontSize: '0.68em', color: '#94a3b8', marginTop: 1, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cols.length} עמודות: {colSummary}</div>}
              <div style={{ fontSize: '0.65em', color: '#cbd5e1', marginTop: 1 }}>{g.title}</div>
            </button>
            <button
              type="button"
              onClick={() => removePresetMutation.mutate(g.id)}
              title="הסר מתבניות מוכנות"
              style={{
                background: '#f8fafc', border: 'none', borderRight: '1px solid #93c5fd',
                color: '#94a3b8', cursor: 'pointer', padding: '0 7px', fontSize: '0.8em',
              }}
            >✕</button>
          </div>
          );
        })}
      </div>
    </div>
  );
}

// -------- Apply to goals modal --------
function ApplyToGoalsModal({ sourceGoal, formType, currentBlocks, onClose }: {
  sourceGoal: GoalLibraryItem;
  formType: 'lp' | 'dc';
  currentBlocks?: GoalTableBlock[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [replaceTitle, setReplaceTitle] = useState(true);
  const [appliedCount, setAppliedCount] = useState<number | null>(null);

  const { data: libraryRes, isLoading } = useQuery({
    queryKey: ['goals-library-all'],
    queryFn: () => goalsApi.getAllLibrary(),
  });

  const templateField = formType === 'lp' ? 'learningPlanTemplate' : 'dataCollectionTemplate';
  const allGoals = ((libraryRes?.data || []) as GoalLibraryItem[]).filter(g => g.id !== sourceGoal.id);
  const filtered = search.trim()
    ? allGoals.filter(g => g.title.includes(search.trim()))
    : allGoals;

  // Group by category
  const grouped = GOAL_CATEGORIES.map(cat => ({
    cat,
    goals: filtered.filter(g => g.categoryId === cat.id),
  })).filter(g => g.goals.length > 0);

  const sourceIdField = formType === 'lp' ? 'lpPresetSourceId' : 'dcPresetSourceId';
  // Use live editor blocks if provided, otherwise fall back to saved template
  const srcTemplate: GoalFormTemplate | null = currentBlocks
    ? { tables: currentBlocks }
    : sourceGoal[templateField] ?? null;

  const bulkMutation = useMutation({
    mutationFn: async () => {
      const targetIdArr = Array.from(selectedIds);
      if (replaceTitle && srcTemplate) {
        for (const targetId of targetIdArr) {
          const target = allGoals.find(g => g.id === targetId);
          const tmpl = target
            ? { ...srcTemplate, tables: srcTemplate.tables.map(t => ({ ...t, title: target.title })) }
            : srcTemplate;
          await goalTemplatesApi.updateTemplates(targetId, {
            [templateField]: tmpl,
            [sourceIdField]: sourceGoal.id,
          });
        }
        return { data: { applied: targetIdArr.length } };
      }
      // bulkApply reads from DB — save current blocks first to ensure DB is up to date
      if (currentBlocks) {
        await goalTemplatesApi.updateTemplates(sourceGoal.id, {
          [templateField]: { tables: currentBlocks },
        });
      }
      return goalTemplatesApi.bulkApply(sourceGoal.id, targetIdArr, formType);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['goals-library-all'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setAppliedCount(res.data?.applied || selectedIds.size);
    },
  });

  function toggleId(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleCategory(catGoals: GoalLibraryItem[]) {
    const allSelected = catGoals.every(g => selectedIds.has(g.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      catGoals.forEach(g => allSelected ? next.delete(g.id) : next.add(g.id));
      return next;
    });
  }

  if (appliedCount !== null) {
    return (
      <div className="modal-overlay" style={{ zIndex: 300 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div style={{
          background: 'white', borderRadius: 14, padding: '32px 28px', textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)', maxWidth: 400,
        }}>
          <div style={{ fontSize: '2.5em', marginBottom: 10 }}>✓</div>
          <div style={{ fontSize: '1.05em', fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>
            התבנית הוחלה על {appliedCount} מטרות
          </div>
          <button type="button" className="btn-primary" onClick={onClose} style={{ marginTop: 14 }}>סגור</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 300 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        style={{
          background: 'white', borderRadius: 14, width: 'min(520px, 95vw)',
          maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '15px 20px 11px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.02em', color: '#1e293b' }}>החל תבנית על מטרות נוספות</h3>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3em', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
          </div>
          <div style={{ fontSize: '0.82em', color: '#64748b', marginTop: 3 }}>
            מקור: {sourceGoal.title}
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש מטרה..."
            style={{
              width: '100%', padding: '7px 12px', border: '1.5px solid #e2e8f0',
              borderRadius: 7, fontSize: '0.88em', outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Goal list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 14px' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>טוען...</div>
          ) : grouped.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8', fontSize: '0.88em' }}>לא נמצאו מטרות</div>
          ) : grouped.map(({ cat, goals }) => (
            <div key={cat.id} style={{ marginBottom: 12 }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5,
                  cursor: 'pointer', userSelect: 'none',
                }}
                onClick={() => toggleCategory(goals)}
              >
                <input
                  type="checkbox"
                  checked={goals.every(g => selectedIds.has(g.id))}
                  readOnly
                  style={{ accentColor: cat.color }}
                />
                <span style={{
                  fontSize: '0.78em', fontWeight: 700, color: cat.color,
                  background: `${cat.color}18`, borderRadius: 10, padding: '2px 9px',
                }}>
                  {cat.nameHe}
                </span>
                <span style={{ fontSize: '0.72em', color: '#94a3b8' }}>({goals.length})</span>
              </div>
              {goals.map(g => {
                const hasTemplate = !!g[templateField];
                return (
                  <label key={g.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px 5px 22px',
                    cursor: 'pointer', borderRadius: 6, fontSize: '0.87em', color: '#334155',
                    background: selectedIds.has(g.id) ? '#f0f9ff' : 'transparent',
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(g.id)}
                      onChange={() => toggleId(g.id)}
                      style={{ accentColor: '#667eea' }}
                    />
                    <span style={{ flex: 1 }}>{g.title}</span>
                    {hasTemplate && (
                      <span style={{ fontSize: '0.72em', color: '#f59e0b', background: '#fffbeb', borderRadius: 8, padding: '1px 7px' }}>
                        יש תבנית
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '11px 20px', borderTop: '1px solid #f1f5f9', flexShrink: 0,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82em', color: '#64748b' }}>
              {selectedIds.size > 0 ? `${selectedIds.size} נבחרו` : 'בחר מטרות'}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {bulkMutation.isError && (
                <span style={{ color: '#ef4444', fontSize: '0.82em', alignSelf: 'center' }}>שגיאה בהחלה</span>
              )}
              <button type="button" className="btn-secondary" onClick={onClose}>ביטול</button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => bulkMutation.mutate()}
                disabled={selectedIds.size === 0 || bulkMutation.isPending}
              >
                {bulkMutation.isPending ? 'מחיל...' : `החל על ${selectedIds.size} מטרות`}
              </button>
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82em', color: '#64748b', cursor: 'pointer' }}>
            <input type="checkbox" checked={replaceTitle} onChange={e => setReplaceTitle(e.target.checked)} style={{ accentColor: '#16a34a' }} />
            החלף כותרת בלוק בשם המטרה
          </label>
        </div>
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
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showUpdateLinked, setShowUpdateLinked] = useState<string[] | null>(null);
  const hasExistingTemplate = initialBlocks.length > 0;

  const presetNameField = formType === 'lp' ? 'lpPresetName' : 'dcPresetName';
  const sourceIdField = formType === 'lp' ? 'lpPresetSourceId' : 'dcPresetSourceId';

  // Query library to find linked goals and source preset info
  const { data: libraryForLinked } = useQuery({
    queryKey: ['goals-library-all'],
    queryFn: () => goalsApi.getAllLibrary(),
  });
  const allLibItems = (libraryForLinked?.data || []) as GoalLibraryItem[];
  const templateKey = formType === 'lp' ? 'learningPlanTemplate' : 'dataCollectionTemplate';
  const linkedGoalIds = allLibItems
    .filter(g => g.id !== goal.id && g[sourceIdField] === goal.id && g[templateKey])
    .map(g => g.id);

  // If this goal is connected to a template source, find the source's preset name
  const sourceGoalId = goal[sourceIdField] as string | undefined;
  const sourceGoal = sourceGoalId ? allLibItems.find(g => g.id === sourceGoalId) : undefined;
  const sourcePresetName = sourceGoal?.[presetNameField] as string | undefined;

  const [saveAsPreset, setSaveAsPreset] = useState(!!goal[presetNameField] || !!sourceGoalId);
  const [presetName, setPresetName] = useState<string>((goal[presetNameField] as string) || sourcePresetName || goal.title);

  // When library loads and we discover this goal is connected to a source preset, auto-check
  useEffect(() => {
    if (sourcePresetName && !goal[presetNameField]) {
      setSaveAsPreset(true);
      setPresetName(sourcePresetName);
    }
  }, [sourcePresetName]); // eslint-disable-line react-hooks/exhaustive-deps

  function loadPreset(preset: GoalFormTemplate, presetNameFromStrip?: string) {
    setBlocks(preset.tables.map(b => ({
      ...b,
      id: makeId(),
      columns: b.columns.map(c => ({ ...c, id: makeId() })),
    })));
    if (presetNameFromStrip) {
      setSaveAsPreset(true);
      setPresetName(presetNameFromStrip);
    }
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

  // Is this goal a connected target (not the source itself)?
  const isLinkedTarget = !!sourceGoalId && sourceGoalId !== goal.id;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const template: GoalFormTemplate = { tables: blocks };
      const templateKey = formType === 'lp' ? 'learningPlanTemplate' : 'dataCollectionTemplate';

      // Save template on this goal only (never set presetName on a linked target)
      await goalTemplatesApi.updateTemplates(goal.id, {
        [templateKey]: template,
        ...(!isLinkedTarget ? { [presetNameField]: saveAsPreset ? (presetName.trim() || goal.title) : null } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals-library-all'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      // Find goals to update: all connected goals except current one
      const allLinked = isLinkedTarget
        ? [
            ...allLibItems
              .filter(g => g.id !== goal.id && (g[sourceIdField] === sourceGoalId || g.id === sourceGoalId) && g[templateKey])
              .map(g => g.id),
          ]
        : linkedGoalIds;
      if (saveAsPreset && allLinked.length > 0) {
        setShowUpdateLinked(allLinked);
      } else {
        onClose();
      }
    },
  });

  const updateLinkedMutation = useMutation({
    mutationFn: (targetIds: string[]) => goalTemplatesApi.bulkApply(isLinkedTarget ? sourceGoalId! : goal.id, targetIds, formType),
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
        [presetNameField]: null,
        [sourceIdField]: null,
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
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>

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
        <div style={{ borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>
          {/* Row 1: Preset options */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px',
            background: '#f8fafc', borderBottom: '1px solid #f1f5f9',
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.82em', color: '#64748b', whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={saveAsPreset}
                onChange={e => setSaveAsPreset(e.target.checked)}
                style={{ accentColor: '#667eea' }}
              />
              שמור כתבנית מוכנה
            </label>
            {saveAsPreset && (
              <input
                type="text"
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                placeholder="שם לתבנית..."
                style={{
                  padding: '4px 10px', border: '1.5px solid #d1d5db', borderRadius: 6,
                  fontSize: '0.82em', outline: 'none', flex: '0 1 200px', minWidth: 100,
                  fontFamily: 'inherit', background: 'white',
                }}
              />
            )}
            <div style={{ flex: 1 }} />
            {hasColumns && hasExistingTemplate && (
              <button
                type="button"
                onClick={() => setShowApplyModal(true)}
                style={{
                  background: 'none', border: 'none', color: '#1d4ed8',
                  fontSize: '0.82em', padding: '4px 0', cursor: 'pointer',
                  fontWeight: 500, whiteSpace: 'nowrap', textDecoration: 'underline',
                }}
              >
                החל על מטרות נוספות
              </button>
            )}
          </div>

          {/* Row 2: Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px' }}>
            {hasExistingTemplate && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.82em', padding: '4px 0', cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap' }}
              >
                מחק תבנית
              </button>
            )}
            {confirmDelete && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.83em', color: '#ef4444' }}>
                <span>למחוק?</span>
                <button type="button" className="btn-danger btn-small" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                  {deleteMutation.isPending ? '...' : 'כן'}
                </button>
                <button type="button" className="btn-secondary btn-small" onClick={() => setConfirmDelete(false)}>לא</button>
              </div>
            )}
            <div style={{ flex: 1 }} />
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

        {/* Apply to goals modal */}
        {showApplyModal && (
          <ApplyToGoalsModal
            sourceGoal={goal}
            formType={formType}
            currentBlocks={blocks}
            onClose={() => setShowApplyModal(false)}
          />
        )}

        {/* Update linked goals prompt */}
        {showUpdateLinked && (
          <div className="modal-overlay" style={{ zIndex: 300 }} onMouseDown={(e) => { if (e.target === e.currentTarget) { setShowUpdateLinked(null); onClose(); } }}>
            <div style={{
              background: 'white', borderRadius: 14, padding: '28px 24px', textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.18)', maxWidth: 420, width: '90vw',
            }}>
              <div style={{ fontSize: '1.05em', fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>
                {showUpdateLinked.length} מטרות נוספות משתמשות בתבנית זו
              </div>
              <div style={{ fontSize: '0.88em', color: '#64748b', marginBottom: 18 }}>
                לעדכן גם אותן?
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setShowUpdateLinked(null); onClose(); }}
                >
                  לא, רק מטרה זו
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => updateLinkedMutation.mutate(showUpdateLinked)}
                  disabled={updateLinkedMutation.isPending}
                >
                  {updateLinkedMutation.isPending ? 'מעדכן...' : `כן, עדכן ${showUpdateLinked.length} מטרות`}
                </button>
              </div>
              {updateLinkedMutation.isError && (
                <div style={{ color: '#ef4444', fontSize: '0.82em', marginTop: 10 }}>שגיאה בעדכון</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
