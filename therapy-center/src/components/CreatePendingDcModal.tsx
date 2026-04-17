import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { goalDataApi } from '../api/client';
import { normalizeTemplate } from '../types';
import type { Goal, Practitioner } from '../types';

interface CreatePendingDcModalProps {
  kidId: string;
  goals: Goal[];
  practitioners: Practitioner[];
  onClose: () => void;
}

export default function CreatePendingDcModal({
  kidId, goals, practitioners, onClose,
}: CreatePendingDcModalProps) {
  const queryClient = useQueryClient();
  const [selectedGoalLibraryId, setSelectedGoalLibraryId] = useState('');
  const [sessionDate, setSessionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [practitionerId, setPractitionerId] = useState('');

  const goal = goals.find(g => g.libraryItemId === selectedGoalLibraryId);

  const goalsWithDc = goals.filter(g =>
    g.isActive && g.libraryItemId && normalizeTemplate(g.dataCollectionTemplate ?? null).some(b => b.columns.length > 0)
  );

  // All practitioners are non-parents (parents are in a separate collection)

  const createMutation = useMutation({
    mutationFn: async () => {
      return goalDataApi.addEntry(kidId, selectedGoalLibraryId, {
        goalTitle: goal?.title || '',
        sessionDate,
        practitionerId: practitionerId || undefined,
        tables: [],
        status: 'pending',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-dc', kidId] });
      queryClient.invalidateQueries({ queryKey: ['all-dc', kidId] });
      queryClient.invalidateQueries({ queryKey: ['goal-data'] });
      onClose();
    },
  });

  const canSave = selectedGoalLibraryId && sessionDate;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal dc-modal-small" onClick={e => e.stopPropagation()}>
        <h3 style={{ marginBottom: 16 }}>יצירת טופס איסוף נתונים</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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

          <div>
            <label style={{ display: 'block', fontSize: '0.9em', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              הקצה למטפל/ת
            </label>
            <select
              value={practitionerId}
              onChange={e => setPractitionerId(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1.5px solid #e2e8f0', fontSize: '0.95em', fontFamily: 'inherit',
              }}
            >
              <option value="">ללא הקצאה (לכולם)</option>
              {practitioners.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
          <button
            className="btn-primary"
            disabled={!canSave || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? 'יוצר...' : 'צור טופס'}
          </button>
        </div>
      </div>
    </div>
  );
}
