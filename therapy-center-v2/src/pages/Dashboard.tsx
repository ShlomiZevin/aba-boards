import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { kidsApi, practitionersApi, sessionsApi, boardRequestsApi } from '../api/client';
import { useTherapist } from '../contexts/TherapistContext';
import { useTherapistLinks } from '../hooks/useTherapistLinks';
import { useAuth } from '../contexts/AuthContext';
import ConfirmModal from '../components/ConfirmModal';
import BoardRequests from '../components/BoardRequests';
import type { Kid, KidWithAdmin } from '../types';

// Use import.meta.env.BASE_URL for correct path in both dev and production
const BASE = import.meta.env.BASE_URL;
const DEFAULT_AVATAR = `${BASE}me-default-small.jpg`;

interface KidCardProps {
  kid: Kid | KidWithAdmin;
  isTherapistView: boolean;
  links: ReturnType<typeof useTherapistLinks>;
  variant?: 'default' | 'orphan' | 'other-admin';
  onDetach?: (kidId: string) => void;
  onAttach?: (kidId: string) => void;
  onDelete?: (kidId: string) => void;
}

function KidCard({ kid, isTherapistView, links, variant = 'default', onDetach, onAttach, onDelete }: KidCardProps) {
  const avatarUrl = kid.imageName
    ? (kid.imageName.startsWith('data:') ? kid.imageName : `${BASE}${kid.imageName}`)
    : DEFAULT_AVATAR;

  const isOtherAdmin = variant === 'other-admin';

  return (
    <div className={`kid-card-container${isOtherAdmin ? ' read-only' : ''}`}>
      <div className="kid-corner-btns">
        {variant === 'default' && onDetach && (
          <button
            onClick={() => onDetach(kid.id)}
            className="kid-corner-btn detach"
            title="הסר שיוך"
          >⛓️‍💥</button>
        )}
        {variant === 'orphan' && onAttach && (
          <button
            onClick={() => onAttach(kid.id)}
            className="kid-corner-btn attach"
            title="שייך אליי"
          >🔗</button>
        )}
        {!isOtherAdmin && onDelete && (
          <button
            onClick={() => onDelete(kid.id)}
            className="kid-corner-btn delete"
            title="מחק ילד"
          >🗑️</button>
        )}
      </div>
      <Link to={isOtherAdmin ? '#' : links.kidDetail(kid.id)} className="kid-card" onClick={isOtherAdmin ? (e) => e.preventDefault() : undefined}>
        <img
          src={avatarUrl}
          alt={kid.name}
          className="kid-avatar"
          onError={(e) => {
            (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
          }}
        />
        <div>
          <div className="kid-name">{kid.name}</div>
          {kid.age && <div className="kid-age">גיל {kid.age}</div>}
          {isOtherAdmin && (kid as KidWithAdmin).adminName && (
            <div style={{ fontSize: 11, marginTop: 3 }}>
              <span style={{ background: '#e0e7ff', color: '#4338ca', borderRadius: 10, padding: '1px 7px', fontWeight: 600 }}>
                {(kid as KidWithAdmin).adminName}
              </span>
            </div>
          )}
          {(kid.totalMoney !== undefined || kid.tasks !== undefined) && (() => {
            const completedToday = (kid.completedTasks?.length ?? 0) + (kid.completedBonusTasks?.length ?? 0);
            const bonusToday = kid.completedBonusTasks?.length ?? 0;
            return (
              <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                {kid.totalMoney !== undefined && (
                  <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', borderRadius: 10, padding: '1px 7px', fontWeight: 600 }}>
                    💰 {parseFloat(kid.totalMoney.toFixed(2))}
                  </span>
                )}
                {kid.tasks !== undefined && (
                  <span style={{ fontSize: 11, background: '#f0f9ff', color: '#0369a1', borderRadius: 10, padding: '1px 7px', fontWeight: 600 }}>
                    📋 {kid.tasks.length}
                  </span>
                )}
                {completedToday > 0 && (
                  <span style={{ fontSize: 11, background: '#f0fdf4', color: '#15803d', borderRadius: 10, padding: '1px 7px', fontWeight: 600 }}>
                    ✅ {completedToday}{bonusToday > 0 ? ` (+${bonusToday}⭐)` : ''}
                  </span>
                )}
              </div>
            );
          })()}
        </div>
      </Link>
      <div className="kid-card-actions">
        {!isOtherAdmin && (
          <>
            <Link to={links.kidDetail(kid.id)} className="kid-action-btn with-label">
              <span className="action-icon">🏠</span>
              <span className="action-label">דף ילד</span>
            </Link>
            <a href={`/board.html?kid=${kid.id}`} className="kid-action-btn with-label">
              <span className="action-icon">📱</span>
              <span className="action-label">לוח</span>
            </a>
          </>
        )}
        {!isTherapistView && !isOtherAdmin && (
          <>
            <a href={`/board.html?kid=${kid.id}&mode=edit`} className="kid-action-btn with-label">
              <span className="action-icon">🎨</span>
              <span className="action-label">ערוך לוח</span>
            </a>
            <a href={`/stats.html?kid=${kid.id}`} className="kid-action-btn with-label">
              <span className="action-icon">📊</span>
              <span className="action-label">סטטיסטיקה</span>
            </a>
          </>
        )}
        {isOtherAdmin && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 12px', fontSize: '0.8em', color: '#94a3b8' }}>
            צפייה בלבד
          </div>
        )}
      </div>
    </div>
  );
}

function SuperAdminDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const links = useTherapistLinks();

  const [activeTab, setActiveTab] = useState<'my' | 'orphan' | 'other' | 'requests'>('my');
  const [confirmDetach, setConfirmDetach] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showCreateKid, setShowCreateKid] = useState(false);
  const [newKidName, setNewKidName] = useState('');
  const [newKidAge, setNewKidAge] = useState('');
  const [newKidGender, setNewKidGender] = useState('');

  const { data: groupedResponse, isLoading } = useQuery({
    queryKey: ['kids', 'super-admin-grouped'],
    queryFn: () => kidsApi.getAllGrouped(),
  });

  const { data: alertsResponse } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => sessionsApi.getAlerts(),
  });

  const { data: boardRequestsResponse } = useQuery({
    queryKey: ['board-requests'],
    queryFn: () => boardRequestsApi.getAll(),
  });
  const pendingRequestsCount = (boardRequestsResponse?.data || []).filter(r => r.status === 'pending').length;

  const createKidMutation = useMutation({
    mutationFn: (data: { name: string; age?: string; gender?: string }) =>
      kidsApi.create(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['kids'] });
      setShowCreateKid(false);
      setNewKidName('');
      setNewKidAge('');
      setNewKidGender('');
      if (res.data?.id) {
        navigate(links.kidDetail(res.data.id));
      }
    },
  });

  const detachMutation = useMutation({
    mutationFn: (kidId: string) => kidsApi.detach(kidId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kids'] });
      setConfirmDetach(null);
    },
  });

  const attachMutation = useMutation({
    mutationFn: (kidId: string) => kidsApi.attach(kidId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kids'] });
    },
  });

  const deleteKidMutation = useMutation({
    mutationFn: (kidId: string) => kidsApi.delete(kidId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kids'] });
      setConfirmDelete(null);
    },
  });

  const grouped = groupedResponse?.data;
  const myKids = grouped?.myKids || [];
  const orphanKids = grouped?.orphanKids || [];
  const otherAdminKids = grouped?.otherAdminKids || [];
  const alerts = alertsResponse?.data || [];

  const allKids = [...myKids, ...orphanKids, ...otherAdminKids];
  const detachKidName = confirmDetach ? myKids.find(k => k.id === confirmDetach)?.name : '';
  const deleteKidName = confirmDelete ? allKids.find(k => k.id === confirmDelete)?.name : '';

  const renderGrid = (kids: (Kid | KidWithAdmin)[], variant: 'default' | 'orphan' | 'other-admin', emptyText: string) => {
    if (kids.length === 0) {
      return <div className="empty-state"><p>{emptyText}</p></div>;
    }
    return (
      <div className="kids-grid">
        {kids.map(kid => (
          <KidCard
            key={kid.id}
            kid={kid}
            isTherapistView={false}
            links={links}
            variant={variant}
            onDetach={variant === 'default' ? (id) => setConfirmDetach(id) : undefined}
            onAttach={variant === 'orphan' ? (id) => attachMutation.mutate(id) : undefined}
            onDelete={variant !== 'other-admin' ? (id) => setConfirmDelete(id) : undefined}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="container">
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="alerts-box">
          <h3>התראות ({alerts.length})</h3>
          <p>יש {alerts.length} טפסים שממתינים למילוי</p>
        </div>
      )}

      <div className="content-card">
        <div className="content-card-header">
          <h2>ניהול ילדים</h2>
          <button onClick={() => setShowCreateKid(true)} className="btn-primary btn-small">
            + הוסף ילד
          </button>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab-btn${activeTab === 'my' ? ' active' : ''}`}
            onClick={() => setActiveTab('my')}
          >
            הילדים שלי ({myKids.length})
          </button>
          <button
            className={`tab-btn${activeTab === 'orphan' ? ' active' : ''}`}
            onClick={() => setActiveTab('orphan')}
          >
            ללא מרכז ({orphanKids.length})
          </button>
          <button
            className={`tab-btn${activeTab === 'other' ? ' active' : ''}`}
            onClick={() => setActiveTab('other')}
          >
            מרכזים אחרים ({otherAdminKids.length})
          </button>
          <button
            className={`tab-btn${activeTab === 'requests' ? ' active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            בקשות לוחות {pendingRequestsCount > 0 && <span className="tab-badge">{pendingRequestsCount}</span>}
          </button>
        </div>

        {isLoading ? (
          <div className="loading">טוען...</div>
        ) : (
          <>
            {activeTab === 'my' && renderGrid(myKids, 'default', 'אין ילדים משויכים אליך')}
            {activeTab === 'orphan' && renderGrid(orphanKids, 'orphan', 'אין ילדים ללא מרכז')}
            {activeTab === 'other' && renderGrid(otherAdminKids, 'other-admin', 'אין ילדים של מרכזים אחרים')}
            {activeTab === 'requests' && <BoardRequests />}
          </>
        )}
      </div>

      {/* Detach confirmation */}
      {confirmDetach && (
        <ConfirmModal
          title="הסרת שיוך ילד"
          message={`להסיר את ${detachKidName} מהמרכז שלך? הילד יעבור לרשימת "ללא מרכז".`}
          confirmText="הסר שיוך"
          confirmStyle="danger"
          onConfirm={() => detachMutation.mutate(confirmDetach)}
          onCancel={() => setConfirmDetach(null)}
        />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <ConfirmModal
          title="מחיקת ילד"
          message={`למחוק את ${deleteKidName} לצמיתות? כל הנתונים של הילד יימחקו ולא ניתן יהיה לשחזר.`}
          confirmText={deleteKidMutation.isPending ? 'מוחק...' : 'מחק לצמיתות'}
          confirmStyle="danger"
          onConfirm={() => deleteKidMutation.mutate(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Create Kid Modal */}
      {showCreateKid && (
        <div className="modal-overlay" onClick={() => setShowCreateKid(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>הוספת ילד חדש</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              createKidMutation.mutate({
                name: newKidName,
                age: newKidAge || undefined,
                gender: newKidGender || undefined,
              });
            }}>
              <div className="form-group">
                <label>שם הילד *</label>
                <input
                  type="text"
                  value={newKidName}
                  onChange={(e) => setNewKidName(e.target.value)}
                  required
                  autoFocus
                  placeholder="הכנס שם ילד"
                />
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>גיל (לא חובה)</label>
                  <input
                    type="number"
                    value={newKidAge}
                    onChange={(e) => setNewKidAge(e.target.value)}
                    min="0"
                    max="18"
                    placeholder="גיל"
                  />
                </div>
                <div className="form-group">
                  <label>מין (לא חובה)</label>
                  <select value={newKidGender} onChange={(e) => setNewKidGender(e.target.value)}>
                    <option value="">בחר</option>
                    <option value="boy">בן</option>
                    <option value="girl">בת</option>
                  </select>
                </div>
              </div>
              {createKidMutation.isError && (
                <div style={{ color: '#D32F2F', fontSize: '0.9em', marginBottom: '12px' }}>
                  {(createKidMutation.error as Error)?.message || 'שגיאה ביצירת ילד'}
                </div>
              )}
              <div className="modal-actions">
                <button type="button" onClick={() => setShowCreateKid(false)} className="btn-secondary">
                  ביטול
                </button>
                <button type="submit" className="btn-primary" disabled={createKidMutation.isPending}>
                  {createKidMutation.isPending ? 'יוצר...' : 'הוסף ילד'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function RegularDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isTherapistView, practitionerId } = useTherapist();
  const links = useTherapistLinks();

  const [showCreateKid, setShowCreateKid] = useState(false);
  const [newKidName, setNewKidName] = useState('');
  const [newKidAge, setNewKidAge] = useState('');
  const [newKidGender, setNewKidGender] = useState('');

  const { data: kidsResponse, isLoading: kidsLoading } = useQuery({
    queryKey: isTherapistView ? ['kids', 'practitioner', practitionerId] : ['kids'],
    queryFn: () => isTherapistView
      ? practitionersApi.getKidsForPractitioner(practitionerId!)
      : kidsApi.getAll(),
  });

  const { data: alertsResponse } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => sessionsApi.getAlerts(),
    enabled: !isTherapistView,
  });

  const createKidMutation = useMutation({
    mutationFn: (data: { name: string; age?: string; gender?: string }) =>
      kidsApi.create(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['kids'] });
      setShowCreateKid(false);
      setNewKidName('');
      setNewKidAge('');
      setNewKidGender('');
      if (res.data?.id) {
        navigate(links.kidDetail(res.data.id));
      }
    },
  });

  const kids = kidsResponse?.data || [];
  const alerts = alertsResponse?.data || [];

  return (
    <div className="container">
      {/* Alerts */}
      {!isTherapistView && alerts.length > 0 && (
        <div className="alerts-box">
          <h3>התראות ({alerts.length})</h3>
          <p>יש {alerts.length} טפסים שממתינים למילוי</p>
        </div>
      )}

      {/* Kids Section */}
      <div className="content-card">
        <div className="content-card-header">
          <h2>הילדים</h2>
          {!isTherapistView && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <a href="/therapy/chat" className="btn-secondary btn-small" style={{ textDecoration: 'none' }}>
                🤖 צ׳אט AI
              </a>
              <button onClick={() => setShowCreateKid(true)} className="btn-primary btn-small">
                + הוסף ילד
              </button>
            </div>
          )}
        </div>

        {kidsLoading ? (
          <div className="loading">טוען...</div>
        ) : kids.length === 0 ? (
          <div className="empty-state">
            <p>{isTherapistView ? 'אין ילדים משויכים אלייך' : 'אין ילדים במערכת'}</p>
            {!isTherapistView && (
              <button
                onClick={() => setShowCreateKid(true)}
                className="btn-primary"
                style={{ marginTop: '12px' }}
              >
                + הוסף ילד חדש
              </button>
            )}
          </div>
        ) : (
          <div className="kids-grid">
            {kids.map((kid) => (
              <KidCard key={kid.id} kid={kid} isTherapistView={isTherapistView} links={links} />
            ))}
          </div>
        )}
      </div>

      {/* Create Kid Modal - Admin only */}
      {!isTherapistView && showCreateKid && (
        <div className="modal-overlay" onClick={() => setShowCreateKid(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>הוספת ילד חדש</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              createKidMutation.mutate({
                name: newKidName,
                age: newKidAge || undefined,
                gender: newKidGender || undefined,
              });
            }}>
              <div className="form-group">
                <label>שם הילד *</label>
                <input
                  type="text"
                  value={newKidName}
                  onChange={(e) => setNewKidName(e.target.value)}
                  required
                  autoFocus
                  placeholder="הכנס שם ילד"
                />
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>גיל (לא חובה)</label>
                  <input
                    type="number"
                    value={newKidAge}
                    onChange={(e) => setNewKidAge(e.target.value)}
                    min="0"
                    max="18"
                    placeholder="גיל"
                  />
                </div>
                <div className="form-group">
                  <label>מין (לא חובה)</label>
                  <select value={newKidGender} onChange={(e) => setNewKidGender(e.target.value)}>
                    <option value="">בחר</option>
                    <option value="boy">בן</option>
                    <option value="girl">בת</option>
                  </select>
                </div>
              </div>
              {createKidMutation.isError && (
                <div style={{ color: '#D32F2F', fontSize: '0.9em', marginBottom: '12px' }}>
                  {(createKidMutation.error as Error)?.message || 'שגיאה ביצירת ילד'}
                </div>
              )}
              <div className="modal-actions">
                <button type="button" onClick={() => setShowCreateKid(false)} className="btn-secondary">
                  ביטול
                </button>
                <button type="submit" className="btn-primary" disabled={createKidMutation.isPending}>
                  {createKidMutation.isPending ? 'יוצר...' : 'הוסף ילד'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { isTherapistView } = useTherapist();

  if (!isTherapistView && user?.isSuperAdmin) {
    return <SuperAdminDashboard />;
  }

  return <RegularDashboard />;
}
