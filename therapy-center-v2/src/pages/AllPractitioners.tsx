import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { practitionersApi } from '../api/client';
import type { Practitioner, PractitionerType } from '../types';
import ConfirmModal from '../components/ConfirmModal';
import Icon from '../v2/Icon';
import { kidColor, type Tone } from '../v2/kidColor';
import '../v2/pages/tm.css';
import { CLASSIC_ORIGIN } from '../v2/classic';

const TYPE_TONE: Record<string, Tone> = { 'מטפלת': 'sky', 'מנתחת התנהגות': 'lilac', 'מדריכת הורים': 'peach' };
const typeTone = (t?: string) => TYPE_TONE[t || ''] || 'yellow';

function MailIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h16v12H4z M4.5 6.5l7.5 6 7.5-6" />
    </svg>
  );
}

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

function CreateModal({ onSave, onClose, isPending }: {
  onSave: (data: Omit<Practitioner, 'id' | 'createdAt'>) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [type, setType] = useState<PractitionerType>('מטפלת');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>הוספת איש צוות</h3>
        <form onSubmit={(e) => { e.preventDefault(); onSave({ name, mobile: mobile || undefined, email: email || undefined, type } as any); }}>
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
            <button type="submit" className="btn-primary" disabled={isPending || !name.trim()}>
              {isPending ? 'מוסיף...' : 'הוסף'}
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
  const [creating, setCreating] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const copyTherapistLink = (id: string) => {
    const url = `${CLASSIC_ORIGIN}/therapy/t/${id}/`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLinkId(id);
      setTimeout(() => setCopiedLinkId(null), 2000);
    });
  };

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

  const createMutation = useMutation({
    mutationFn: (data: Omit<Practitioner, 'id' | 'createdAt'>) => practitionersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTherapists'] });
      setCreating(false);
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

  const typeCounts = practitioners.reduce((acc, p) => {
    const t = p.type || 'אחר';
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  // Keep the people grouped by type (same order as before), one flat list
  const ordered = Object.keys(typeCounts).flatMap(t => practitioners.filter(p => (p.type || 'אחר') === t));
  const shown = typeFilter === 'all' ? ordered : ordered.filter(p => (p.type || 'אחר') === typeFilter);

  return (
    <div className="tm-team">
      <header className="tm-head">
        <div>
          <h1 className="nb-h1">ה<mark className="hl-mint">צוות</mark></h1>
          <p className="nb-muted tm-sub">{practitioners.length} אנשי צוות</p>
        </div>
        <button type="button" className="nb-btn" onClick={() => setCreating(true)}><Icon name="plus" /> איש צוות חדש</button>
      </header>

      {Object.keys(typeCounts).length > 1 && (
        <div className="tm-chips" role="group" aria-label="סינון לפי סוג">
          <button type="button" className={`tm-pick${typeFilter === 'all' ? ' is-on' : ''}`} aria-pressed={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>
            כולם <span className="tabular">{practitioners.length}</span>
          </button>
          {Object.entries(typeCounts).map(([t, n]) => (
            <button key={t} type="button" className={`tm-pick${typeFilter === t ? ' is-on' : ''}`} aria-pressed={typeFilter === t} onClick={() => setTypeFilter(t)}>
              <span className={`nb-dot tone-${typeTone(t)}`} /> {t} <span className="tabular">{n}</span>
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="hand nb-muted">טוען…</p>
      ) : practitioners.length === 0 ? (
        <div className="nb-card tm-empty">
          <p className="hand">עדיין אין אנשי צוות. מוסיפים את הראשונה?</p>
          <button type="button" className="nb-btn" onClick={() => setCreating(true)}><Icon name="plus" /> הוספת איש צוות</button>
        </div>
      ) : (
        <div className="nb-card tm-sheet">
          <div className="tm-row tm-row-head" aria-hidden="true">
            <span>שם</span><span>סוג</span><span>טלפון</span><span>אימייל</span><span />
          </div>
          <ul className="tm-list">
            {shown.map(p => (
              <li key={p.id} className="tm-row">
                <span className="tm-who">
                  <span className={`nb-av sm tone-${kidColor(p.id)}`} aria-hidden="true">{p.name.charAt(0)}</span>
                  <b>{p.name}</b>
                  {copiedLinkId === p.id && <span className="nb-sticker tone-mint tm-copied" role="status">הקישור הועתק</span>}
                </span>
                <span className="tm-type"><span className={`nb-chip tone-${typeTone(p.type)}`}>{p.type || 'אחר'}</span></span>
                <span className="tm-contact tm-phone">
                  {p.mobile ? (
                    <>
                      <a href={`tel:${p.mobile}`} className="tm-contact-ic" aria-label={`חיוג אל ${p.name}`}><Icon name="phone" size={18} /></a>
                      <span className="tm-sel" dir="ltr">{p.mobile}</span>
                    </>
                  ) : <span className="tm-none">—</span>}
                </span>
                <span className="tm-contact tm-email">
                  {p.email ? (
                    <>
                      <a href={`mailto:${p.email}`} className="tm-contact-ic" aria-label={`מייל אל ${p.name}`}><MailIcon /></a>
                      <span className="tm-sel" dir="ltr">{p.email}</span>
                    </>
                  ) : <span className="tm-none">—</span>}
                </span>
                <span className="tm-actions">
                  {p.type === 'מטפלת' && (
                    <button type="button" className="tm-ic" onClick={() => copyTherapistLink(p.id)} title="העתק קישור מטפלת" aria-label={`העתקת הקישור של ${p.name}`}>
                      <Icon name={copiedLinkId === p.id ? 'check' : 'link'} size={20} />
                    </button>
                  )}
                  <button type="button" className="tm-ic" onClick={() => setEditing(p)} title="ערוך" aria-label={`עריכת ${p.name}`}><Icon name="edit" size={20} /></button>
                  <button type="button" className="tm-ic danger" onClick={() => setToDelete(p)} title="מחק מהמערכת" aria-label={`מחיקת ${p.name}`}><Icon name="trash" size={20} /></button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {creating && (
        <CreateModal
          onSave={(data) => createMutation.mutate(data)}
          onClose={() => setCreating(false)}
          isPending={createMutation.isPending}
        />
      )}

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
