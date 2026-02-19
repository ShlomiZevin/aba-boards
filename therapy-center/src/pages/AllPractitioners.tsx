import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { practitionersApi } from '../api/client';
import type { Practitioner, PractitionerType } from '../types';
import ConfirmModal from '../components/ConfirmModal';

const BASE = import.meta.env.BASE_URL;

function EditModal({ practitioner, onSave, onClose, isPending }: {
  practitioner: Practitioner;
  onSave: (data: Partial<Practitioner>) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(practitioner.name);
  const [mobile, setMobile] = useState(practitioner.mobile || '');
  const [email, setEmail] = useState(practitioner.email || '');
  const [type, setType] = useState<PractitionerType>(practitioner.type);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>עריכת איש צוות</h3>
        <form onSubmit={(e) => { e.preventDefault(); onSave({ name, mobile: mobile || undefined, email: email || undefined, type }); }}>
          <div className="form-group">
            <label>שם</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="form-group">
            <label>סוג</label>
            <select value={type} onChange={(e) => setType(e.target.value as PractitionerType)}>
              <option value="מטפלת">מטפלת</option>
              <option value="מנתחת התנהגות">מנתחת התנהגות</option>
              <option value="מדריכת הורים">מדריכת הורים</option>
            </select>
          </div>
          <div className="form-group">
            <label>טלפון (לא חובה)</label>
            <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} dir="ltr" />
          </div>
          <div className="form-group">
            <label>אימייל (לא חובה)</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">ביטול</button>
            <button type="submit" className="btn-primary" disabled={isPending}>
              {isPending ? 'שומר...' : 'שמור'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AllPractitioners() {
  const queryClient = useQueryClient();
  const [toDelete, setToDelete] = useState<Practitioner | null>(null);
  const [editing, setEditing] = useState<Practitioner | null>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ['myTherapists'],
    queryFn: () => practitionersApi.getMyTherapists(),
    staleTime: 0,
  });

  const practitioners: Practitioner[] = res?.data || [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => practitionersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTherapists'] });
      setToDelete(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Practitioner> }) =>
      practitionersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTherapists'] });
      setEditing(null);
    },
  });

  const byType = practitioners.reduce((acc, p) => {
    const t = p.type || 'אחר';
    if (!acc[t]) acc[t] = [];
    acc[t].push(p);
    return acc;
  }, {} as Record<string, Practitioner[]>);

  return (
    <div className="container">
      <div className="kid-header-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" className="kid-header-back">
            <span className="back-arrow">←</span>
            <img src={`${BASE}doing-logo-transparent2.png`} alt="Doing" className="logo-small" />
          </Link>
          <h2 style={{ margin: 0, fontSize: '1.2em' }}>כל אנשי הצוות</h2>
          <div style={{ width: '60px' }} />
        </div>
      </div>

      <div className="content-card">
        {isLoading ? (
          <div className="loading">טוען...</div>
        ) : practitioners.length === 0 ? (
          <p className="empty-text">אין אנשי צוות במערכת</p>
        ) : (
          Object.entries(byType).map(([type, group]) => (
            <div key={type} style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '0.9em', color: '#64748b', fontWeight: 600, marginBottom: '10px', borderBottom: '1px solid #f0f4f8', paddingBottom: '6px' }}>
                {type} ({group.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {group.map((p) => (
                  <div key={p.id} className="team-member">
                    <div>
                      <div className="team-name">{p.name}</div>
                      {(p.mobile || p.email) && (
                        <div style={{ fontSize: '0.8em', color: '#94a3b8', marginTop: '2px' }}>
                          {p.mobile && (
                            <a href={`tel:${p.mobile}`} style={{ color: '#94a3b8', textDecoration: 'none' }}>{p.mobile}</a>
                          )}
                          {p.mobile && p.email && ' · '}
                          {p.email && (
                            <a href={`mailto:${p.email}`} style={{ color: '#94a3b8', textDecoration: 'none' }}>{p.email}</a>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => setEditing(p)}
                        className="edit-btn-small"
                        title="ערוך"
                      >✎</button>
                      <button
                        onClick={() => setToDelete(p)}
                        className="delete-btn-small"
                        title="מחק מהמערכת"
                      >✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {editing && (
        <EditModal
          practitioner={editing}
          onSave={(data) => updateMutation.mutate({ id: editing.id, data })}
          onClose={() => setEditing(null)}
          isPending={updateMutation.isPending}
        />
      )}

      {toDelete && (
        <ConfirmModal
          title="מחיקת איש צוות"
          message={`למחוק את ${toDelete.name} מהמערכת לחלוטין? הם יוסרו מכל הילדים.`}
          confirmText="מחק"
          confirmStyle="danger"
          onConfirm={() => deleteMutation.mutate(toDelete.id)}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
