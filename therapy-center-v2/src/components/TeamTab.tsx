import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { practitionersApi, parentsApi } from '../api/client';
import type { Practitioner, Parent, PractitionerType } from '../types';

interface AddMemberModalProps {
  type: 'practitioner' | 'parent';
  onClose: () => void;
  onAdd: (data: { name: string; mobile?: string; email?: string; practitionerType?: PractitionerType }) => void;
}

function AddMemberModal({ type, onClose, onAdd }: AddMemberModalProps) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [practitionerType, setPractitionerType] = useState<PractitionerType>('מטפלת');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      name,
      mobile: mobile || undefined,
      email: email || undefined,
      practitionerType: type === 'practitioner' ? practitionerType : undefined,
    });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>{type === 'practitioner' ? 'הוספת מטפלת' : 'הוספת הורה'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>שם</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {type === 'practitioner' && (
            <div className="form-group">
              <label>סוג</label>
              <select
                value={practitionerType}
                onChange={(e) => setPractitionerType(e.target.value as PractitionerType)}
              >
                <option value="מטפלת">מטפלת</option>
                <option value="מנתחת התנהגות">מנתחת התנהגות</option>
                <option value="מדריכת הורים">מדריכת הורים</option>
              </select>
            </div>
          )}

          <div className="form-group">
            <label>טלפון (לא חובה)</label>
            <input
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              dir="ltr"
            />
          </div>

          <div className="form-group">
            <label>אימייל (לא חובה)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
            />
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              ביטול
            </button>
            <button type="submit" className="btn-primary">
              הוסף
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MemberCard({
  name,
  type,
  mobile,
  email,
  onDelete,
}: {
  name: string;
  type?: string;
  mobile?: string;
  email?: string;
  onDelete: () => void;
}) {
  return (
    <div className="list-item">
      <div className="list-item-info">
        <h4>{name}</h4>
        {type && <p>{type}</p>}
        {mobile && (
          <a href={`tel:${mobile}`}>{mobile}</a>
        )}
        {email && (
          <a href={`mailto:${email}`} style={{ marginRight: mobile ? '12px' : 0 }}>{email}</a>
        )}
      </div>
      <button onClick={onDelete} className="btn-icon" title="הסר">
        ✕
      </button>
    </div>
  );
}

export default function TeamTab({ kidId }: { kidId: string }) {
  const [showAddPractitioner, setShowAddPractitioner] = useState(false);
  const [showAddParent, setShowAddParent] = useState(false);
  const queryClient = useQueryClient();

  const { data: practitionersRes, isLoading: practitionersLoading } = useQuery({
    queryKey: ['practitioners', kidId],
    queryFn: () => practitionersApi.getForKid(kidId),
  });

  const { data: parentsRes, isLoading: parentsLoading } = useQuery({
    queryKey: ['parents', kidId],
    queryFn: () => parentsApi.getForKid(kidId),
  });

  const addPractitionerMutation = useMutation({
    mutationFn: (data: { name: string; mobile?: string; email?: string; practitionerType?: PractitionerType }) =>
      practitionersApi.add(kidId, {
        name: data.name,
        mobile: data.mobile,
        email: data.email,
        type: data.practitionerType || 'מטפלת',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practitioners', kidId] });
    },
  });

  const deletePractitionerMutation = useMutation({
    mutationFn: (id: string) => practitionersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practitioners', kidId] });
    },
  });

  const addParentMutation = useMutation({
    mutationFn: (data: { name: string; mobile?: string; email?: string }) =>
      parentsApi.add(kidId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parents', kidId] });
    },
  });

  const deleteParentMutation = useMutation({
    mutationFn: (id: string) => parentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parents', kidId] });
    },
  });

  const practitioners = practitionersRes?.data || [];
  const parents = parentsRes?.data || [];

  return (
    <div>
      {/* Practitioners Section */}
      <div className="section">
        <div className="section-header">
          <h3>מטפלות</h3>
          <button
            onClick={() => setShowAddPractitioner(true)}
            className="btn-primary btn-small"
          >
            + הוסף
          </button>
        </div>

        {practitionersLoading ? (
          <div className="loading">טוען...</div>
        ) : practitioners.length === 0 ? (
          <div className="empty-state">
            <p>אין מטפלות</p>
          </div>
        ) : (
          <div>
            {practitioners.map((p: Practitioner) => (
              <MemberCard
                key={p.id}
                name={p.name}
                type={p.type}
                mobile={p.mobile}
                email={p.email}
                onDelete={() => deletePractitionerMutation.mutate(p.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Parents Section */}
      <div className="section">
        <div className="section-header">
          <h3>הורים</h3>
          <button
            onClick={() => setShowAddParent(true)}
            className="btn-primary btn-small"
          >
            + הוסף
          </button>
        </div>

        {parentsLoading ? (
          <div className="loading">טוען...</div>
        ) : parents.length === 0 ? (
          <div className="empty-state">
            <p>אין הורים</p>
          </div>
        ) : (
          <div>
            {parents.map((p: Parent) => (
              <MemberCard
                key={p.id}
                name={p.name}
                mobile={p.mobile}
                email={p.email}
                onDelete={() => deleteParentMutation.mutate(p.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddPractitioner && (
        <AddMemberModal
          type="practitioner"
          onClose={() => setShowAddPractitioner(false)}
          onAdd={(data) => addPractitionerMutation.mutate(data)}
        />
      )}

      {showAddParent && (
        <AddMemberModal
          type="parent"
          onClose={() => setShowAddParent(false)}
          onAdd={(data) => addParentMutation.mutate(data)}
        />
      )}
    </div>
  );
}
