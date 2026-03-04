import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { goalDataApi } from '../api/client';
import { normalizeTemplate, normalizeDcEntry } from '../types';
import { toDate } from '../utils/date';
import type { Goal, KidGoalDataEntry, GoalFormRow, TableBlockData, Practitioner } from '../types';
import { EditableVerticalBlock, CellInput } from './GoalFormRenderer';

interface DcEntryModalProps {
  kidId: string;
  goals: Goal[];
  practitioners: Practitioner[];
  /** null for add mode, entry for fill/edit mode */
  entry: KidGoalDataEntry | null;
  onClose: () => void;
}

export default function DcEntryModal({
  kidId, goals, practitioners, entry, onClose,
}: DcEntryModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!entry && entry.status === 'filled';
  const isFilling = !!entry && entry.status === 'pending';
  const isAdding = !entry;

  const [selectedGoalLibraryId, setSelectedGoalLibraryId] = useState<string>(
    entry?.goalLibraryId || ''
  );
  const [sessionDate, setSessionDate] = useState<string>(
    entry?.sessionDate
      ? format(toDate(entry.sessionDate), 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd')
  );

  const goal = goals.find(g => g.libraryItemId === selectedGoalLibraryId);
  const templateBlocks = goal ? normalizeTemplate(goal.dataCollectionTemplate ?? null) : [];
  const hasTemplate = templateBlocks.length > 0 && templateBlocks.some(b => b.columns.length > 0);

  const [dcData, setDcData] = useState<Record<string, GoalFormRow[]>>({});

  // Initialize data from existing entry for edit mode
  useEffect(() => {
    if (entry && (isEditing || isFilling) && templateBlocks.length > 0) {
      const entryTables = normalizeDcEntry(entry);
      const state: Record<string, GoalFormRow[]> = {};
      for (const block of templateBlocks) {
        const existing = entryTables.find(t => t.tableId === block.id);
        if (existing && existing.rows.length > 0) {
          state[block.id] = existing.rows;
        } else {
          state[block.id] = [Object.fromEntries(block.columns.map(c => [c.id, '']))];
        }
      }
      setDcData(state);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset form when goal changes in add mode
  useEffect(() => {
    if (isAdding) {
      setDcData({});
    }
  }, [selectedGoalLibraryId, isAdding]);

  const goalsWithDc = goals.filter(g =>
    g.isActive && g.libraryItemId && normalizeTemplate(g.dataCollectionTemplate ?? null).some(b => b.columns.length > 0)
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const tables: TableBlockData[] = templateBlocks.map(block => ({
        tableId: block.id,
        rows: dcData[block.id] || [Object.fromEntries(block.columns.map(c => [c.id, '']))],
      }));

      if (isEditing || isFilling) {
        return goalDataApi.updateEntry(kidId, entry!.goalLibraryId, entry!.id, { tables });
      } else {
        return goalDataApi.addEntry(kidId, selectedGoalLibraryId, {
          goalTitle: goal?.title || '',
          sessionDate,
          tables,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-dc', kidId] });
      queryClient.invalidateQueries({ queryKey: ['all-dc', kidId] });
      queryClient.invalidateQueries({ queryKey: ['goal-data'] });
      onClose();
    },
  });

  const title = isAdding ? 'איסוף נתונים חדש' : isEditing ? 'עריכת איסוף נתונים' : 'מילוי איסוף נתונים';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal dc-modal" onClick={e => e.stopPropagation()}>
        <h3 style={{ marginBottom: 12, flexShrink: 0 }}>{title}</h3>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Add mode: goal selector + date */}
          {isAdding && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.9em', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  מטרה
                </label>
                <select
                  value={selectedGoalLibraryId}
                  onChange={e => setSelectedGoalLibraryId(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 8,
                    border: '1.5px solid #e2e8f0', fontSize: '0.95em', fontFamily: 'inherit',
                  }}
                >
                  <option value="">בחר מטרה...</option>
                  {goalsWithDc.map(g => (
                    <option key={g.libraryItemId} value={g.libraryItemId!}>{g.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.9em', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  תאריך
                </label>
                <input
                  type="date"
                  value={sessionDate}
                  onChange={e => setSessionDate(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 8,
                    border: '1.5px solid #e2e8f0', fontSize: '0.95em', fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          )}

          {/* Fill/Edit mode: show entry meta */}
          {!isAdding && entry && (
            <div className="dc-fill-meta">
              <span className="dc-fill-goal">{entry.goalTitle}</span>
              <span className="dc-fill-date">
                {entry.sessionDate ? format(toDate(entry.sessionDate), 'dd/MM/yyyy') : ''}
                {(() => { const t = practitioners.find(p => p.id === entry.practitionerId); return t ? ` · ${t.name}` : ''; })()}
              </span>
            </div>
          )}

          {/* Form content */}
          {!selectedGoalLibraryId && isAdding ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>בחר מטרה כדי להתחיל</p>
          ) : !hasTemplate ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>
              תבנית איסוף נתונים טרם הוגדרה עבור מטרה זו.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {templateBlocks.map(block => {
                const blockRows = dcData[block.id] || [Object.fromEntries(block.columns.map(c => [c.id, '']))];

                if (block.type === 'vertical') {
                  return (
                    <EditableVerticalBlock
                      key={block.id}
                      block={block}
                      row={blockRows[0] || {}}
                      onChange={(row) => setDcData(prev => ({ ...prev, [block.id]: [row] }))}
                    />
                  );
                }

                // Horizontal blocks → spacious table
                const cols = block.columns;
                return (
                  <div key={block.id}>
                    {block.title && (
                      <div style={{ fontWeight: 700, fontSize: '0.95em', color: '#334155', marginBottom: 12 }}>
                        {block.title}
                      </div>
                    )}
                    <div className="dc-edit-table-wrap">
                      <table className="dc-edit-table">
                        <thead>
                          <tr>
                            <th className="dc-edit-row-num">#</th>
                            {cols.map(col => <th key={col.id}>{col.label}</th>)}
                            <th className="dc-edit-row-action"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {blockRows.map((row, rowIdx) => (
                            <tr key={rowIdx}>
                              <td className="dc-edit-row-num">{rowIdx + 1}</td>
                              {cols.map(col => (
                                <td key={col.id}>
                                  <CellInput
                                    col={col}
                                    value={row[col.id] || ''}
                                    onChange={v => {
                                      const updated = blockRows.map((r, i) => i === rowIdx ? { ...r, [col.id]: v } : r);
                                      setDcData(prev => ({ ...prev, [block.id]: updated }));
                                    }}
                                    colKey={`${block.id}-${rowIdx}-${col.id}`}
                                  />
                                </td>
                              ))}
                              <td className="dc-edit-row-action">
                                {blockRows.length > 1 && (
                                  <button
                                    type="button"
                                    className="dc-row-delete"
                                    onClick={() => {
                                      const updated = blockRows.filter((_, i) => i !== rowIdx);
                                      setDcData(prev => ({ ...prev, [block.id]: updated }));
                                    }}
                                  >✕</button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button
                      type="button"
                      className="dc-add-row"
                      onClick={() => {
                        const empty: Record<string, string> = {};
                        cols.forEach(c => (empty[c.id] = ''));
                        setDcData(prev => ({ ...prev, [block.id]: [...blockRows, empty] }));
                      }}
                    >
                      + הוסף שורה
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {hasTemplate && selectedGoalLibraryId && (
          <div className="modal-actions" style={{ flexShrink: 0, marginTop: 16 }}>
            <button className="btn-secondary" onClick={onClose}>ביטול</button>
            <button
              className="btn-primary"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? 'שומר...' : 'שמור'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
