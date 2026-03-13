import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { GoalTableBlock, GoalFormRow, GoalColumnDef, GoalColumnType } from '../types';
import { repeatedKey, emptyRowForColumns } from '../types';

// ---- Custom option picker (replaces native <select> in compact mode) ----
function CellOptionPicker({ col, value, onChange }: {
  col: GoalColumnDef; value: string; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (popoverRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 2, left: rect.left + rect.width / 2 });
    }
    setOpen(!open);
  };

  return (
    <>
      <div
        ref={triggerRef}
        className={`cell-option-trigger${value ? '' : ' empty'}`}
        onClick={handleOpen}
      >
        {value || '—'}
      </div>
      {open && createPortal(
        <div
          ref={popoverRef}
          className="cell-option-popover"
          style={{ top: pos.top, left: pos.left }}
        >
          <button
            type="button"
            className={`cell-option-pill${!value ? ' selected' : ''}`}
            onClick={() => { onChange(''); setOpen(false); }}
          >—</button>
          {(col.options || []).map(opt => (
            <button
              key={opt}
              type="button"
              className={`cell-option-pill${value === opt ? ' selected' : ''}`}
              onClick={() => { onChange(opt); setOpen(false); }}
            >{opt}</button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', fontSize: '0.85em',
  border: 'none', borderRadius: 6,
  background: '#f1f5f9', padding: '6px 10px',
  boxSizing: 'border-box', fontFamily: 'inherit',
  color: '#1e293b',
};

// ---- Cell input ----
export function CellInput({ col, value, onChange, colKey, compact }: {
  col: GoalColumnDef; value: string; onChange: (v: string) => void; colKey: string; compact?: boolean;
}) {
  if (col.type === 'checkbox') {
    const checked = value === 'true' || value === '1';
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: compact ? 4 : 8, cursor: 'pointer', fontSize: '0.85em', userSelect: 'none' as const, justifyContent: compact ? 'center' : undefined }}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked ? 'true' : 'false')}
          style={{ width: compact ? 18 : 20, height: compact ? 18 : 20, accentColor: '#667eea', cursor: 'pointer' }} />
        {!compact && <span style={{ color: checked ? '#1e293b' : '#94a3b8' }}>{checked ? 'כן' : 'לא'}</span>}
      </label>
    );
  }
  if (col.type === 'date') {
    return (
      <input type="date" value={value || ''} onChange={e => onChange(e.target.value)}
        style={{ ...inputStyle }} />
    );
  }
  if (col.type === 'options') {
    // Compact mode: custom option picker
    if (compact) {
      return <CellOptionPicker col={col} value={value} onChange={onChange} />;
    }
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {(col.options || []).map(opt => (
          <label key={opt} style={{
            display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
            fontSize: '0.82em', padding: '4px 10px', borderRadius: 20,
            background: value === opt ? '#667eea' : '#f1f5f9',
            color: value === opt ? 'white' : '#475569',
            border: `1.5px solid ${value === opt ? '#667eea' : '#e2e8f0'}`,
            userSelect: 'none' as const,
          }}>
            <input type="radio" name={`radio-${colKey}`} checked={value === opt} onChange={() => onChange(opt)}
              style={{ display: 'none' }} />
            {opt}
          </label>
        ))}
      </div>
    );
  }
  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };
  return (
    <textarea
      value={value || ''}
      onChange={e => { onChange(e.target.value); autoGrow(e.target); }}
      ref={el => { if (el) autoGrow(el); }}
      rows={1}
      style={{ ...inputStyle, resize: 'none', minHeight: compact ? 28 : 34, lineHeight: '1.4', overflow: 'hidden' }}
    />
  );
}

// ---- Cell view ----
function CellView({ col, value }: { col: GoalColumnDef; value: string }) {
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

// ---- Vertical block — read only ----
export function ReadOnlyVerticalBlock({ block, row }: { block: GoalTableBlock; row: GoalFormRow }) {
  const { columns, title } = block;
  if (columns.length === 0) return null;
  return (
    <div>
      {title && <div style={{ fontWeight: 700, fontSize: '0.85em', color: '#475569', marginBottom: 6 }}>{title}</div>}
      <div className="dc-vertical-block">
        {columns.map(col => (
          <div key={col.id} className="dc-vertical-row">
            <div className="dc-vertical-label">
              {col.label}
              {col.description && <div style={{ fontSize: '0.8em', color: '#94a3b8', fontWeight: 400, marginTop: 1 }}>{col.description}</div>}
            </div>
            <div className="dc-vertical-value">
              {col.type === 'repeated' ? (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {Array.from({ length: col.repeatCount || 1 }).map((_, i) => {
                    const key = repeatedKey(col.id, i);
                    const innerCol: GoalColumnDef = { id: key, label: '', type: (col.innerType || 'checkbox') as GoalColumnType, options: col.options };
                    return (
                      <div key={key} style={{ border: '1px solid #e2e8f0', borderRadius: 4, padding: '1px 5px', textAlign: 'center', minWidth: 24 }}>
                        <CellView col={innerCol} value={row[key] || ''} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <CellView col={col} value={row[col.id] || ''} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Vertical block — editable ----
export function EditableVerticalBlock({ block, row, onChange }: {
  block: GoalTableBlock; row: GoalFormRow; onChange: (row: GoalFormRow) => void;
}) {
  const { columns, title } = block;
  if (columns.length === 0) return <div style={{ color: '#94a3b8', fontSize: '0.85em' }}>אין שדות בתבנית</div>;
  return (
    <div>
      {title && <div style={{ fontWeight: 700, fontSize: '0.87em', color: '#475569', marginBottom: 10 }}>{title}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {columns.map(col => (
          <div key={col.id}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85em', color: '#334155', marginBottom: col.description ? 1 : 4 }}>{col.label}</label>
            {col.description && <div style={{ fontSize: '0.76em', color: '#94a3b8', marginBottom: 4 }}>{col.description}</div>}
            {col.type === 'repeated' ? (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(col.repeatCount || 1, 10)}, 1fr)`, gap: 3 }}>
                {Array.from({ length: col.repeatCount || 1 }).map((_, i) => {
                  const key = repeatedKey(col.id, i);
                  const innerCol: GoalColumnDef = { id: key, label: '', type: (col.innerType || 'checkbox') as GoalColumnType, options: col.options };
                  return (
                    <div key={key} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65em', color: '#94a3b8' }}>{i + 1}</div>
                      <CellInput col={innerCol} value={row[key] || ''} onChange={v => onChange({ ...row, [key]: v })} colKey={key} compact />
                    </div>
                  );
                })}
              </div>
            ) : (
              <CellInput col={col} value={row[col.id] || ''} onChange={v => onChange({ ...row, [col.id]: v })} colKey={col.id} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Horizontal block — read only ----
export function ReadOnlyHorizontalBlock({ block, rows, firstColumn, rowActions }: {
  block: GoalTableBlock;
  rows: GoalFormRow[];
  firstColumn?: { label: string; values: string[] };
  rowActions?: (rowIdx: number) => React.ReactNode;
}) {
  const { columns, title } = block;
  if (rows.length === 0) {
    return (
      <div>
        {title && <div style={{ fontWeight: 700, fontSize: '0.85em', color: '#475569', marginBottom: 6 }}>{title}</div>}
        <div style={{ color: '#94a3b8', fontSize: '0.85em', padding: '6px 0' }}>אין נתונים עדיין</div>
      </div>
    );
  }
  return (
    <div>
      {title && <div style={{ fontWeight: 700, fontSize: '0.85em', color: '#475569', marginBottom: 6 }}>{title}</div>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85em' }}>
          <thead>
            <tr>
              {firstColumn && (
                <th style={{ padding: '6px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>
                  {firstColumn.label}
                </th>
              )}
              {columns.map(col => col.type === 'repeated' ? (
                <th key={col.id} colSpan={col.repeatCount || 1} style={{ padding: '6px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 600, color: '#475569' }}>
                  <div style={{ whiteSpace: 'nowrap' }}>{col.label}</div>
                  {col.description && <div style={{ fontSize: '0.78em', color: '#94a3b8', fontWeight: 400, whiteSpace: 'nowrap' }}>{col.description}</div>}
                </th>
              ) : (
                <th key={col.id} style={{ padding: '6px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                  <div style={{ whiteSpace: 'nowrap' }}>{col.label}</div>
                  {col.description && <div style={{ fontSize: '0.78em', color: '#94a3b8', fontWeight: 400, whiteSpace: 'nowrap' }}>{col.description}</div>}
                </th>
              ))}
              {rowActions && <th style={{ width: 60, background: '#f8fafc', border: '1px solid #e2e8f0' }} />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} style={{ background: rowIdx % 2 === 0 ? 'white' : '#fafafa' }}>
                {firstColumn && (
                  <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 500, color: '#475569' }}>
                    {firstColumn.values[rowIdx] || '—'}
                  </td>
                )}
                {columns.flatMap(col => {
                  if (col.type === 'repeated') {
                    const count = col.repeatCount || 1;
                    const innerCol: GoalColumnDef = { id: '', label: '', type: (col.innerType || 'checkbox') as GoalColumnType, options: col.options };
                    return Array.from({ length: count }).map((_, i) => {
                      const key = repeatedKey(col.id, i);
                      return (
                        <td key={key} style={{ padding: '4px 3px', border: '1px solid #e2e8f0', color: '#334155', textAlign: 'center' }}>
                          <CellView col={{ ...innerCol, id: key }} value={row[key] || ''} />
                        </td>
                      );
                    });
                  }
                  return [(
                    <td key={col.id} style={{ padding: '6px 10px', border: '1px solid #e2e8f0', color: '#334155' }}>
                      <CellView col={col} value={row[col.id] || ''} />
                    </td>
                  )];
                })}
                {rowActions && (
                  <td style={{ border: '1px solid #e2e8f0', textAlign: 'center', padding: '2px' }}>
                    {rowActions(rowIdx)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Horizontal block — editable (card per row) ----
export function EditableHorizontalBlock({ block, rows, onChange }: {
  block: GoalTableBlock; rows: GoalFormRow[]; onChange: (rows: GoalFormRow[]) => void;
}) {
  const { columns, title } = block;

  function emptyRow(): GoalFormRow {
    return emptyRowForColumns(columns);
  }

  if (columns.length === 0) return <div style={{ color: '#94a3b8', fontSize: '0.85em' }}>אין עמודות בתבנית זו</div>;

  return (
    <div>
      {title && <div style={{ fontWeight: 700, fontSize: '0.87em', color: '#475569', marginBottom: 10 }}>{title}</div>}

      {rows.length === 0 && (
        <div style={{ color: '#94a3b8', fontSize: '0.85em', marginBottom: 10 }}>אין שורות — לחץ "הוסף שורה"</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} style={{
            border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '12px 14px',
            background: rowIdx % 2 === 0 ? 'white' : '#f8fafc',
          }}>
            {/* Row header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: '0.78em', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.04em' }}>
                שורה {rowIdx + 1}
              </span>
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, i) => i !== rowIdx))}
                style={{ background: 'none', border: '1px solid #fecaca', borderRadius: 5, cursor: 'pointer', color: '#ef4444', fontSize: '0.75em', padding: '2px 8px' }}
              >
                מחק שורה
              </button>
            </div>

            {/* Fields — 2-column grid for wide screens */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px 16px' }}>
              {columns.map(col => {
                if (col.type === 'repeated') {
                  const count = col.repeatCount || 1;
                  const innerCol: GoalColumnDef = { id: '', label: '', type: (col.innerType || 'checkbox') as GoalColumnType, options: col.options };
                  return (
                    <div key={col.id} style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: '0.8em', fontWeight: 600, color: '#475569', marginBottom: col.description ? 1 : 3 }}>
                        {col.label}
                      </label>
                      {col.description && <div style={{ fontSize: '0.73em', color: '#94a3b8', marginBottom: 3 }}>{col.description}</div>}
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(count, 10)}, 1fr)`, gap: 3 }}>
                        {Array.from({ length: count }).map((_, i) => {
                          const key = repeatedKey(col.id, i);
                          return (
                            <div key={key} style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '0.65em', color: '#94a3b8' }}>{i + 1}</div>
                              <CellInput
                                col={{ ...innerCol, id: key }}
                                value={row[key] || ''}
                                onChange={v => onChange(rows.map((r, ri) => ri === rowIdx ? { ...r, [key]: v } : r))}
                                colKey={`${rowIdx}-${key}`}
                                compact
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={col.id}>
                    <label style={{ display: 'block', fontSize: '0.8em', fontWeight: 600, color: '#475569', marginBottom: col.description ? 1 : 3 }}>
                      {col.label}
                    </label>
                    {col.description && <div style={{ fontSize: '0.73em', color: '#94a3b8', marginBottom: 3 }}>{col.description}</div>}
                    <CellInput
                      col={col}
                      value={row[col.id] || ''}
                      onChange={v => onChange(rows.map((r, i) => i === rowIdx ? { ...r, [col.id]: v } : r))}
                      colKey={`${rowIdx}-${col.id}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={() => onChange([...rows, emptyRow()])} style={{
        border: '1.5px dashed #667eea', borderRadius: 7, background: 'none',
        color: '#667eea', cursor: 'pointer', fontSize: '0.83em', padding: '7px 18px', fontWeight: 600,
      }}>
        + הוסף שורה
      </button>
    </div>
  );
}

// ---- Backward compat — used by GoalFileUpload.tsx for upload preview ----
// Accepts GoalColumnDef[] directly (not GoalFormTemplate)
export function ReadOnlyGoalTable({ columns, rows, firstColumn, rowActions }: {
  columns: GoalColumnDef[];
  rows: GoalFormRow[];
  firstColumn?: { label: string; values: string[] };
  rowActions?: (rowIdx: number) => React.ReactNode;
}) {
  const fakeBlock: GoalTableBlock = { id: '_preview', type: 'horizontal', columns };
  return <ReadOnlyHorizontalBlock block={fakeBlock} rows={rows} firstColumn={firstColumn} rowActions={rowActions} />;
}
