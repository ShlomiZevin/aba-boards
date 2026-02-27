import type { GoalTableBlock, GoalFormRow, GoalColumnDef } from '../types';

const inputStyle: React.CSSProperties = {
  width: '100%', fontSize: '0.85em',
  border: 'none', borderRadius: 6,
  background: '#f1f5f9', padding: '6px 10px',
  boxSizing: 'border-box', fontFamily: 'inherit',
  color: '#1e293b',
};

// ---- Cell input ----
function CellInput({ col, value, onChange, colKey }: {
  col: GoalColumnDef; value: string; onChange: (v: string) => void; colKey: string;
}) {
  if (col.type === 'date') {
    return (
      <input type="date" value={value || ''} onChange={e => onChange(e.target.value)}
        style={{ ...inputStyle }} />
    );
  }
  if (col.type === 'options') {
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
  return (
    <input
      type="text"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      style={{ ...inputStyle }}
    />
  );
}

// ---- Cell view ----
function CellView({ col, value }: { col: GoalColumnDef; value: string }) {
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
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        {columns.map(col => (
          <div key={col.id} style={{ display: 'grid', gridTemplateColumns: '160px 1fr', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ background: '#f8fafc', padding: '8px 12px', fontSize: '0.85em', fontWeight: 600, color: '#475569', borderLeft: '1px solid #e2e8f0' }}>
              {col.label}
            </div>
            <div style={{ padding: '8px 12px', fontSize: '0.85em', color: '#334155' }}>
              <CellView col={col} value={row[col.id] || ''} />
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
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85em', color: '#334155', marginBottom: 4 }}>{col.label}</label>
            <CellInput col={col} value={row[col.id] || ''} onChange={v => onChange({ ...row, [col.id]: v })} colKey={col.id} />
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
              {columns.map(col => (
                <th key={col.id} style={{ padding: '6px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>
                  {col.label}
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
                {columns.map(col => (
                  <td key={col.id} style={{ padding: '6px 10px', border: '1px solid #e2e8f0', color: '#334155' }}>
                    <CellView col={col} value={row[col.id] || ''} />
                  </td>
                ))}
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
    const r: GoalFormRow = {};
    columns.forEach(c => (r[c.id] = ''));
    return r;
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
              {columns.map(col => (
                <div key={col.id}>
                  <label style={{ display: 'block', fontSize: '0.8em', fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                    {col.label}
                  </label>
                  <CellInput
                    col={col}
                    value={row[col.id] || ''}
                    onChange={v => onChange(rows.map((r, i) => i === rowIdx ? { ...r, [col.id]: v } : r))}
                    colKey={`${rowIdx}-${col.id}`}
                  />
                </div>
              ))}
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
