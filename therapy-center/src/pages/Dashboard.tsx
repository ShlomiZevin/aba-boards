import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { kidsApi, practitionersApi, sessionsApi } from '../api/client';
import { useTherapist } from '../contexts/TherapistContext';
import { useTherapistLinks } from '../hooks/useTherapistLinks';
import type { Kid } from '../types';

// Use import.meta.env.BASE_URL for correct path in both dev and production
const BASE = import.meta.env.BASE_URL;
const DEFAULT_AVATAR = `${BASE}me-default-small.jpg`;

function KidCard({ kid, isTherapistView, links }: { kid: Kid; isTherapistView: boolean; links: ReturnType<typeof useTherapistLinks> }) {
  const avatarUrl = kid.imageName ? `${BASE}${kid.imageName}` : DEFAULT_AVATAR;

  return (
    <div className="kid-card-container">
      <Link to={links.kidDetail(kid.id)} className="kid-card">
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
        </div>
      </Link>
      <div className="kid-card-actions">
        <Link to={links.kidDetail(kid.id)} className="kid-action-btn with-label">
          <span className="action-icon">🏠</span>
          <span className="action-label">דף ילד</span>
        </Link>
        <a href={`/board.html?kid=${kid.id}`} className="kid-action-btn with-label">
          <span className="action-icon">📱</span>
          <span className="action-label">לוח</span>
        </a>
        {!isTherapistView && (
          <>
            <a href={`/board-builder.html?kid=${kid.id}`} className="kid-action-btn with-label">
              <span className="action-icon">🎨</span>
              <span className="action-label">בנה לוח</span>
            </a>
            <a href={`/stats.html?kid=${kid.id}`} className="kid-action-btn with-label">
              <span className="action-icon">📊</span>
              <span className="action-label">סטטיסטיקה</span>
            </a>
          </>
        )}
      </div>
    </div>
  );
}


export default function Dashboard() {
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
      {/* Header */}
      <div className="header-card">
        <img src={`${BASE}doing-logo-transparent2.png`} alt="Doing" className="logo" />
        <h1>מרכז הטיפול</h1>
        <p>{isTherapistView ? 'הילדים שלי' : 'ניהול ילדים, מטפלות, מטרות וטפסים'}</p>
      </div>

      {/* Alerts */}
      {!isTherapistView && alerts.length > 0 && (
        <div className="alerts-box">
          <h3>התראות ({alerts.length})</h3>
          <p>יש {alerts.length} טפסים שממתינים למילוי</p>
        </div>
      )}

      {/* Admin quick links */}
      {!isTherapistView && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <Link
            to="/practitioners"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              background: 'white',
              border: '2px solid #667eea',
              borderRadius: '12px',
              color: '#667eea',
              fontWeight: 600,
              fontSize: '0.95em',
              textDecoration: 'none',
              boxShadow: '0 2px 6px rgba(102,126,234,0.15)',
            }}
          >
            <span>👥</span>
            <span>ניהול אנשי צוות</span>
          </Link>
        </div>
      )}

      {/* Kids Section */}
      <div className="content-card">
        <div className="content-card-header">
          <h2>הילדים</h2>
          {!isTherapistView && (
            <button onClick={() => setShowCreateKid(true)} className="btn-primary btn-small">
              + הוסף ילד
            </button>
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
