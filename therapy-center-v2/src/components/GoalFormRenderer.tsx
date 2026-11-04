import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { GoalTableBlock, GoalFormRow, GoalColumnDef, GoalColumnType } from '../types';
import { repeatedKey, emptyRowForColumns } from '../types';
import Icon from '../v2/Icon';
import '../v2/pages/kp.css';

// ---- Option value helpers (multi-select support) ----
// Multi-select columns store values as pipe-separated ("opt1|opt2"); single as plain string.
function parseOptionValue(col: GoalColumnDef, value: string): string[] {
  if (!value) return [];
  if (col.multiSelect) return value.split('|').filter(Boolean);
  return [value];
}
function stringifyOptionValue(col: GoalColumnDef, values: string[]): string {
  if (col.multiSelect) return values.join('|');
  return values[0] || '';
}
function toggleOptionValue(col: GoalColumnDef, current: string, opt: string): string {
  const arr = parseOptionValue(col, current);
  if (arr.includes(opt)) {
    return stringifyOptionValue(col, arr.filter(v => v !== opt));
  }
  return col.multiSelect
    ? stringifyOptionValue(col, [...arr, opt])
    : stringifyOptionValue(col, [opt]);
}

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

  const selected = parseOptionValue(col, value);
  const displayValue = selected.length === 0 ? '—' : selected.join(', ');

  return (
    <>
      <div
        ref={triggerRef}
        className={`cell-option-trigger${value ? '' : ' empty'}`}
        onClick={handleOpen}
      >
        {displayValue}
      </div>
      {open && createPortal(
        <div
          ref={popoverRef}
          className="cell-option-popover"
          style={{ top: pos.top, left: pos.left }}
        >
          <button
            type="button"
            className={`cell-option-pill${selected.length === 0 ? ' selected' : ''}`}
            onClick={() => { onChange(''); setOpen(false); }}
          >—</button>
          {(col.options || []).map(opt => {
            const isSelected = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                className={`cell-option-pill${isSelected ? ' selected' : ''}`}
                onClick={() => {
                  onChange(toggleOptionValue(col, value, opt));
                  if (!col.multiSelect) setOpen(false);
                }}
              >{isSelected && col.multiSelect ? <><Icon name="check" size={13} strokeWidth={2.6} /> {opt}</> : opt}</button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', fontSize: '0.85em',
  border: 'none', borderRadius: 6,
  background: 'var(--paper-2)', padding: '6px 10px',
  boxSizing: 'border-box', fontFamily: 'inherit',
  color: 'var(--ink)',
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
          style={{ width: compact ? 18 : 20, height: compact ? 18 : 20, accentColor: 'var(--pen)', cursor: 'pointer' }} />
        {!compact && <span style={{ color: checked ? 'var(--ink)' : 'var(--muted)' }}>{checked ? 'כן' : 'לא'}</span>}
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
    const selected = parseOptionValue(col, value);
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {(col.options || []).map(opt => {
          const isSelected = selected.includes(opt);
          return (
            <label key={opt} style={{
              display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
              fontSize: '0.82em', padding: '4px 10px', borderRadius: 20,
              background: isSelected ? 'var(--pen)' : 'var(--paper-2)',
              color: isSelected ? 'white' : 'var(--ink-2)',
              border: `1.5px solid ${isSelected ? 'var(--pen)' : 'var(--line)'}`,
              userSelect: 'none' as const,
            }}>
              <input
                type={col.multiSelect ? 'checkbox' : 'radio'}
                name={`radio-${colKey}`}
                checked={isSelected}
                onChange={() => onChange(toggleOptionValue(col, value, opt))}
                style={{ display: 'none' }}
              />
              {isSelected && col.multiSelect ? <><Icon name="check" size={13} strokeWidth={2.6} /> {opt}</> : opt}
            </label>
          );
        })}
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
    return <span className={`kp-cell-check${checked ? ' is-yes' : ' is-no'}`} aria-label={checked ? 'כן' : 'לא'}><Icon name={checked ? 'check' : 'close'} size={14} strokeWidth={2.8} /></span>;
  }
  if (!value) return <span style={{ color: '#cbd5e1' }}>—</span>;
  if (col.type === 'date') {
    try {
      const d = new Date(value);
      return <span>{isNaN(d.getTime()) ? value : d.toLocaleDateString('he-IL')}</span>;
    } catch { return <span>{value}</span>; }
  }
  if (col.type === 'options' && col.multiSelect) {
    return <span style={{ whiteSpace: 'pre-wrap' }}>{parseOptionValue(col, value).join(', ')}</span>;
  }
  return <span style={{ whiteSpace: 'pre-wrap' }}>{value}</span>;
}

// ---- Vertical block — read only ----
export function ReadOnlyVerticalBlock({ block, row }: { block: GoalTableBlock; row: GoalFormRow }) {
  const { columns, title } = block;
  if (columns.length === 0) return null;
  return (
    <div>
      {title && <div style={{ fontWeight: 700, fontSize: '0.85em', color: 'var(--ink-2)', marginBottom: 6 }}>{title}</div>}
      <div className="dc-vertical-block">
        {columns.map(col => (
          <div key={col.id} className="dc-vertical-row">
            <div className="dc-vertical-label">
              {col.label}
              {col.description && <div style={{ fontSize: '0.8em', color: 'var(--muted)', fontWeight: 400, marginTop: 1 }}>{col.description}</div>}
            </div>
            <div className="dc-vertical-value">
              {col.type === 'repeated' ? (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {Array.from({ length: col.repeatCount || 1 }).map((_, i) => {
                    const key = repeatedKey(col.id, i);
                    const innerCol: GoalColumnDef = { id: key, label: '', type: (col.innerType || 'checkbox') as GoalColumnType, options: col.options, multiSelect: col.multiSelect };
                    return (
                      <div key={key} style={{ border: '1px solid var(--line)', borderRadius: 4, padding: '1px 5px', textAlign: 'center', minWidth: 24 }}>
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
  if (columns.length === 0) return <div style={{ color: 'var(--muted)', fontSize: '0.85em' }}>אין שדות בתבנית</div>;
  return (
    <div>
      {title && <div style={{ fontWeight: 700, fontSize: '0.87em', color: 'var(--ink-2)', marginBottom: 10 }}>{title}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {columns.map(col => (
          <div key={col.id}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85em', color: 'var(--ink)', marginBottom: col.description ? 1 : 4 }}>{col.label}</label>
            {col.description && <div style={{ fontSize: '0.76em', color: 'var(--muted)', marginBottom: 4 }}>{col.description}</div>}
            {col.type === 'repeated' ? (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(col.repeatCount || 1, 10)}, 1fr)`, gap: 3 }}>
                {Array.from({ length: col.repeatCount || 1 }).map((_, i) => {
                  const key = repeatedKey(col.id, i);
                  const innerCol: GoalColumnDef = { id: key, label: '', type: (col.innerType || 'checkbox') as GoalColumnType, options: col.options, multiSelect: col.multiSelect };
                  return (
                    <div key={key} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65em', color: 'var(--muted)' }}>{i + 1}</div>
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
        {title && <div style={{ fontWeight: 700, fontSize: '0.85em', color: 'var(--ink-2)', marginBottom: 6 }}>{title}</div>}
        <div style={{ color: 'var(--muted)', fontSize: '0.85em', padding: '6px 0' }}>אין נתונים עדיין</div>
      </div>
    );
  }
  return (
    <div>
      {title && <div style={{ fontWeight: 700, fontSize: '0.85em', color: 'var(--ink-2)', marginBottom: 6 }}>{title}</div>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85em' }}>
          <thead>
            <tr>
              {firstColumn && (
                <th style={{ padding: '6px 10px', background: 'var(--paper)', border: '1px solid var(--line)', textAlign: 'right', fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                  {firstColumn.label}
                </th>
              )}
              {columns.map(col => col.type === 'repeated' ? (
                <th key={col.id} colSpan={col.repeatCount || 1} style={{ padding: '6px 10px', background: 'var(--paper)', border: '1px solid var(--line)', textAlign: 'center', fontWeight: 600, color: 'var(--ink-2)' }}>
                  <div style={{ whiteSpace: 'nowrap' }}>{col.label}</div>
                  {col.description && <div style={{ fontSize: '0.78em', color: 'var(--muted)', fontWeight: 400, whiteSpace: 'nowrap' }}>{col.description}</div>}
                </th>
              ) : (
                <th key={col.id} style={{ padding: '6px 10px', background: 'var(--paper)', border: '1px solid var(--line)', textAlign: 'right', fontWeight: 600, color: 'var(--ink-2)' }}>
                  <div style={{ whiteSpace: 'nowrap' }}>{col.label}</div>
                  {col.description && <div style={{ fontSize: '0.78em', color: 'var(--muted)', fontWeight: 400, whiteSpace: 'nowrap' }}>{col.description}</div>}
                </th>
              ))}
              {rowActions && <th style={{ width: 60, background: 'var(--paper)', border: '1px solid var(--line)' }} />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} style={{ background: rowIdx % 2 === 0 ? 'white' : 'var(--paper)' }}>
                {firstColumn && (
                  <td style={{ padding: '6px 10px', border: '1px solid var(--line)', whiteSpace: 'nowrap', fontWeight: 500, color: 'var(--ink-2)' }}>
                    {firstColumn.values[rowIdx] || '—'}
                  </td>
                )}
                {columns.flatMap(col => {
                  if (col.type === 'repeated') {
                    const count = col.repeatCount || 1;
                    const innerCol: GoalColumnDef = { id: '', label: '', type: (col.innerType || 'checkbox') as GoalColumnType, options: col.options, multiSelect: col.multiSelect };
                    return Array.from({ length: count }).map((_, i) => {
                      const key = repeatedKey(col.id, i);
                      return (
                        <td key={key} style={{ padding: '4px 3px', border: '1px solid var(--line)', color: 'var(--ink)', textAlign: 'center' }}>
                          <CellView col={{ ...innerCol, id: key }} value={row[key] || ''} />
                        </td>
                      );
                    });
                  }
                  return [(
                    <td key={col.id} style={{ padding: '6px 10px', border: '1px solid var(--line)', color: 'var(--ink)' }}>
                      <CellView col={col} value={row[col.id] || ''} />
                    </td>
                  )];
                })}
                {rowActions && (
                  <td style={{ border: '1px solid var(--line)', textAlign: 'center', padding: '2px' }}>
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

  if (columns.length === 0) return <div style={{ color: 'var(--muted)', fontSize: '0.85em' }}>אין עמודות בתבנית זו</div>;

  return (
    <div>
      {title && <div style={{ fontWeight: 700, fontSize: '0.87em', color: 'var(--ink-2)', marginBottom: 10 }}>{title}</div>}

      {rows.length === 0 && (
        <div style={{ color: 'var(--muted)', fontSize: '0.85em', marginBottom: 10 }}>אין שורות — לחץ "הוסף שורה"</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} style={{
            border: '1.5px solid var(--line)', borderRadius: 10, padding: '12px 14px',
            background: rowIdx % 2 === 0 ? 'white' : 'var(--paper)',
          }}>
            {/* Row header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: '0.78em', fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.04em' }}>
                שורה {rowIdx + 1}
              </span>
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, i) => i !== rowIdx))}
                style={{ background: 'none', border: '1px solid var(--red-soft)', borderRadius: 5, cursor: 'pointer', color: 'var(--red)', fontSize: '0.75em', padding: '2px 8px' }}
              >
                מחק שורה
              </button>
            </div>

            {/* Fields — 2-column grid for wide screens */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px 16px' }}>
              {columns.map(col => {
                if (col.type === 'repeated') {
                  const count = col.repeatCount || 1;
                  const innerCol: GoalColumnDef = { id: '', label: '', type: (col.innerType || 'checkbox') as GoalColumnType, options: col.options, multiSelect: col.multiSelect };
                  return (
                    <div key={col.id} style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: '0.8em', fontWeight: 600, color: 'var(--ink-2)', marginBottom: col.description ? 1 : 3 }}>
                        {col.label}
                      </label>
                      {col.description && <div style={{ fontSize: '0.73em', color: 'var(--muted)', marginBottom: 3 }}>{col.description}</div>}
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(count, 10)}, 1fr)`, gap: 3 }}>
                        {Array.from({ length: count }).map((_, i) => {
                          const key = repeatedKey(col.id, i);
                          return (
                            <div key={key} style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '0.65em', color: 'var(--muted)' }}>{i + 1}</div>
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
                    <label style={{ display: 'block', fontSize: '0.8em', fontWeight: 600, color: 'var(--ink-2)', marginBottom: col.description ? 1 : 3 }}>
                      {col.label}
                    </label>
                    {col.description && <div style={{ fontSize: '0.73em', color: 'var(--muted)', marginBottom: 3 }}>{col.description}</div>}
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
        border: '1.5px dashed var(--pen)', borderRadius: 7, background: 'none',
        color: 'var(--pen)', cursor: 'pointer', fontSize: '0.83em', padding: '7px 18px', fontWeight: 600,
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
