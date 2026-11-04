import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { kidsApi, practitionersApi, sessionsApi } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useTherapist } from '../../contexts/TherapistContext';
import { useTherapistLinks } from '../../hooks/useTherapistLinks';
import { toDate } from '../../utils/date';
import type { Kid } from '../../types';
import Dashboard from '../../pages/Dashboard';
import Icon from '../Icon';
import KidAvatar from '../KidAvatar';
import './kids.css';

const HE_DAY_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

export default function Kids() {
  const { user } = useAuth();
  const { isTherapistView } = useTherapist();
  // The super-admin's grouped view (all centres) keeps the original page for now.
  if (!isTherapistView && user?.isSuperAdmin) return <Dashboard />;
  return <KidsList />;
}

function KidsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const links = useTherapistLinks();
  const { isTherapistView, practitionerId } = useTherapist();
  const [q, setQ] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');

  const { data: kidsRes, isLoading } = useQuery({
    queryKey: isTherapistView ? ['kids', 'practitioner', practitionerId] : ['kids'],
    queryFn: () => (isTherapistView ? practitionersApi.getKidsForPractitioner(practitionerId!) : kidsApi.getAll()),
  });
  const from = format(new Date(), 'yyyy-MM-dd');
  const to = format(addDays(new Date(), 14), 'yyyy-MM-dd');
  const { data: upcomingRes } = useQuery({
    queryKey: ['sessions', 'upcoming', from, practitionerId],
    queryFn: () => sessionsApi.getAll({ from, to }),
  });
  const { data: alertsRes } = useQuery({ queryKey: ['alerts'], queryFn: () => sessionsApi.getAlerts() });

  const create = useMutation({
    mutationFn: (data: { name: string; age?: string; gender?: string }) => kidsApi.create(data),
    onSuccess: res => {
      queryClient.invalidateQueries({ queryKey: ['kids'] });
      setShowCreate(false); setName(''); setAge(''); setGender('');
      if (res.data?.id) navigate(links.kidDetail(res.data.id));
    },
  });

  const kids = kidsRes?.data || [];
  const nextByKid = useMemo(() => {
    const m = new Map<string, Date>();
    const now = Date.now();
    for (const s of upcomingRes?.data || []) {
      const d = toDate(s.scheduledDate);
      if (!s.kidId || d.getTime() < now) continue;
      if (!m.has(s.kidId) || d < m.get(s.kidId)!) m.set(s.kidId, d);
    }
    return m;
  }, [upcomingRes]);
  const pendingByKid = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of alertsRes?.data || []) if (s.kidId) m.set(s.kidId, (m.get(s.kidId) || 0) + 1);
    return m;
  }, [alertsRes]);

  const shown = kids.filter(k => k.name.includes(q.trim()));

  function whenLabel(d: Date) {
    const today = new Date();
    const diff = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date(today).setHours(0, 0, 0, 0)) / 86400000);
    const day = diff === 0 ? 'היום' : diff === 1 ? 'מחר' : `יום ${HE_DAY_SHORT[d.getDay()]}`;
    return `${day} · ${format(d, 'HH:mm')}`;
  }

  return (
    <div className="kd">
      <header className="kd-head">
        <div>
          <h1 className="nb-h1">{isTherapistView ? 'הילדים שלי' : 'הילדים'}</h1>
          <p className="nb-muted kd-count">{kids.length} ילדים{pendingByKid.size > 0 && ` · ${[...pendingByKid.values()].reduce((a, b) => a + b, 0)} טפסים חסרים`}</p>
        </div>
        {!isTherapistView && (
          <button type="button" className="nb-btn" onClick={() => setShowCreate(true)}><Icon name="plus" /> ילד חדש</button>
        )}
      </header>

      {kids.length > 6 && (
        <label className="kd-search">
          <Icon name="search" size={20} />
          <input id="kids-search" type="search" placeholder="חיפוש לפי שם" value={q} onChange={e => setQ(e.target.value)} />
        </label>
      )}

      {isLoading ? (
        <p className="hand nb-muted">טוען…</p>
      ) : shown.length === 0 ? (
        <div className="nb-card kd-empty">
          <p className="hand">{q ? 'לא נמצא ילד בשם הזה' : isTherapistView ? 'עדיין אין ילדים משויכים אלייך' : 'עדיין אין ילדים. מתחילים מהראשון?'}</p>
          {!isTherapistView && !q && <button type="button" className="nb-btn" onClick={() => setShowCreate(true)}><Icon name="plus" /> הוספת ילד</button>}
        </div>
      ) : (
        <ul className="kd-list">
          {shown.map(k => (
            <KidRow key={k.id} kid={k} href={links.kidDetail(k.id)} next={nextByKid.get(k.id)} pending={pendingByKid.get(k.id) || 0}
              whenLabel={whenLabel} canEditBoard={!isTherapistView} menuOpen={menuFor === k.id}
              onMenu={() => setMenuFor(menuFor === k.id ? null : k.id)} />
          ))}
        </ul>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>ילד חדש</h3>
            <form onSubmit={e => { e.preventDefault(); create.mutate({ name, age: age || undefined, gender: gender || undefined }); }}>
              <div className="form-group">
                <label htmlFor="new-kid-name">שם *</label>
                <input id="new-kid-name" value={name} onChange={e => setName(e.target.value)} required autoFocus placeholder="השם הפרטי" />
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="new-kid-age">גיל</label>
                  <input id="new-kid-age" type="number" min="0" max="18" value={age} onChange={e => setAge(e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="new-kid-gender">בן / בת</label>
                  <select id="new-kid-gender" value={gender} onChange={e => setGender(e.target.value)}>
                    <option value="">—</option>
                    <option value="boy">בן</option>
                    <option value="girl">בת</option>
                  </select>
                </div>
              </div>
              {create.isError && <p style={{ color: 'var(--red)' }}>לא הצלחנו להוסיף. נסו שוב.</p>}
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>ביטול</button>
                <button type="submit" className="btn-primary" disabled={create.isPending}>{create.isPending ? 'מוסיפים…' : 'הוספה'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function KidRow({ kid, href, next, pending, whenLabel, canEditBoard, menuOpen, onMenu }: {
  kid: Kid; href: string; next?: Date; pending: number; whenLabel: (d: Date) => string;
  canEditBoard: boolean; menuOpen: boolean; onMenu: () => void;
}) {
  return (
    <li className="kd-row">
      <Link to={href} className="kd-main">
        <KidAvatar kid={kid} size="md" />
        <span className="kd-txt">
          <b>{kid.name}</b>
          <span>{kid.age ? `${kid.gender === 'girl' ? 'בת' : kid.gender === 'boy' ? 'בן' : 'גיל'} ${kid.age}` : ''}{next && <>{kid.age ? ' · ' : ''}<span className="kd-next">הבא: {whenLabel(next)}</span></>}</span>
        </span>
        {pending > 0 && <span className="nb-sticker tone-pink kd-pending">{pending} טופס חסר</span>}
      </Link>
      <button type="button" className="kd-more" aria-label={`עוד פעולות ל${kid.name}`} aria-expanded={menuOpen} onClick={onMenu}><Icon name="more" /></button>
      {menuOpen && (
        <div className="kd-menu">
          <a href={`/board.html?kid=${kid.id}`}><Icon name="board" size={20} /> לוח המשימות</a>
          {canEditBoard && <a href={`/board.html?kid=${kid.id}&mode=edit`}><Icon name="edit" size={20} /> עריכת הלוח</a>}
          {canEditBoard && <a href={`/stats.html?kid=${kid.id}`}><Icon name="chart" size={20} /> סטטיסטיקה</a>}
        </div>
      )}
    </li>
  );
}
