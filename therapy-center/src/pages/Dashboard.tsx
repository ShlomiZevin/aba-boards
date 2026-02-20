import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { kidsApi, practitionersApi, sessionsApi, adminApi } from '../api/client';
import { useTherapist } from '../contexts/TherapistContext';
import { useTherapistLinks } from '../hooks/useTherapistLinks';
import { useAuth } from '../contexts/AuthContext';
import type { Kid } from '../types';

// Use import.meta.env.BASE_URL for correct path in both dev and production
const BASE = import.meta.env.BASE_URL;
const DEFAULT_AVATAR = `${BASE}me-default-small.jpg`;

function KidCard({ kid, isTherapistView, links }: { kid: Kid; isTherapistView: boolean; links: ReturnType<typeof useTherapistLinks> }) {
  const avatarUrl = kid.imageName
    ? (kid.imageName.startsWith('data:') ? kid.imageName : `${BASE}${kid.imageName}`)
    : DEFAULT_AVATAR;

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
  const { logout, user } = useAuth();

  // Create admin
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminMobile, setNewAdminMobile] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminKey, setNewAdminKey] = useState('');
  const [newAdminKeyConfirm, setNewAdminKeyConfirm] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [createAdminError, setCreateAdminError] = useState('');
  const [createAdminLoading, setCreateAdminLoading] = useState(false);

  // Admin list
  const [showAdminList, setShowAdminList] = useState(false);
  const [adminList, setAdminList] = useState<{ docId: string; adminId: string; name: string; key: string; mobile: string; email: string }[]>([]);
  const [adminListLoading, setAdminListLoading] = useState(false);

  // User menu dropdown
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showUserMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  // Change my key
  const [showChangeKey, setShowChangeKey] = useState(false);
  const [changeKeyNew, setChangeKeyNew] = useState('');
  const [changeKeyConfirm, setChangeKeyConfirm] = useState('');
  const [changeKeyError, setChangeKeyError] = useState('');
  const [changeKeyLoading, setChangeKeyLoading] = useState(false);
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

  const { data: practitionerInfoRes } = useQuery({
    queryKey: ['practitioner-info', practitionerId],
    queryFn: () => practitionersApi.getInfo(practitionerId!),
    enabled: isTherapistView && !!practitionerId,
  });
  const practitionerName = practitionerInfoRes?.data?.name || '';

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

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!newAdminName.trim() || !newAdminKey.trim()) return;
    if (newAdminKey !== newAdminKeyConfirm) {
      setCreateAdminError('מפתחות הגישה אינם תואמים');
      return;
    }
    if (newAdminKey.trim().length < 4) {
      setCreateAdminError('מפתח גישה חייב להכיל לפחות 4 תווים');
      return;
    }
    setCreateAdminLoading(true);
    setCreateAdminError('');
    const res = await adminApi.createKey({
      name: newAdminName.trim(),
      key: newAdminKey.trim(),
      mobile: newAdminMobile.trim(),
      email: newAdminEmail.trim(),
    });
    setCreateAdminLoading(false);
    if (res.success && res.data) {
      setCreatedKey(res.data.key);
      setNewAdminName(''); setNewAdminMobile(''); setNewAdminEmail('');
      setNewAdminKey(''); setNewAdminKeyConfirm('');
      if (showAdminList) loadAdminList();
    } else {
      setCreateAdminError(res.error || 'שגיאה ביצירת מנהל');
    }
  }

  async function loadAdminList() {
    setAdminListLoading(true);
    const res = await adminApi.listAdmins();
    setAdminListLoading(false);
    if (res.success && res.data) setAdminList(res.data);
  }

  async function handleDeleteAdmin(adminId: string, name: string) {
    if (!confirm(`למחוק את ${name}?`)) return;
    const res = await adminApi.deleteAdmin(adminId);
    if (res.success) {
      setAdminList(prev => prev.filter(a => a.adminId !== adminId));
    }
  }

  async function handleChangeKey(e: React.FormEvent) {
    e.preventDefault();
    if (changeKeyNew !== changeKeyConfirm) {
      setChangeKeyError('מפתחות הגישה אינם תואמים');
      return;
    }
    if (changeKeyNew.trim().length < 4) {
      setChangeKeyError('מפתח גישה חייב להכיל לפחות 4 תווים');
      return;
    }
    setChangeKeyLoading(true);
    setChangeKeyError('');
    const res = await adminApi.changeKey(changeKeyNew.trim());
    setChangeKeyLoading(false);
    if (res.success) {
      logout();
      navigate('/login');
    } else {
      setChangeKeyError(res.error || 'שגיאה בשינוי המפתח');
    }
  }

  return (
    <div className="container">
      {/* Header */}
      <div className="header-card" style={{ position: 'relative' }}>
        <img src={`${BASE}doing-logo-transparent2.png`} alt="Doing" className="logo" />
        <h1>{isTherapistView && practitionerName ? `שלום, ${practitionerName}` : 'מרכז הטיפול'}</h1>
        <p>{isTherapistView ? 'הילדים שלי' : 'ניהול ילדים, מטפלות, מטרות וטפסים'}</p>
        {user && (
          <div ref={userMenuRef} style={{ position: 'absolute', top: 12, left: 12, zIndex: 20 }}>
            {/* Badge — minimal pill */}
            <button
              onClick={() => setShowUserMenu(v => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: 40,
                padding: '4px 10px 4px 4px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                cursor: 'pointer',
                direction: 'rtl',
              }}
            >
              <div style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: user.isSuperAdmin
                  ? 'linear-gradient(135deg, #667eea, #764ba2)'
                  : 'linear-gradient(135deg, #60a5fa, #3b82f6)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 13,
                flexShrink: 0,
              }}>
                {user.name.charAt(0)}
              </div>
              <span style={{ fontWeight: 500, fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>
                {user.name}
              </span>
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none"
                style={{
                  color: '#94a3b8',
                  transform: showUserMenu ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s',
                }}
              >
                <path d="M1.5 3.5l3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Dropdown */}
            {showUserMenu && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 5px)',
                left: 0,
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                boxShadow: '0 8px 24px rgba(0,0,0,0.09), 0 2px 6px rgba(0,0,0,0.05)',
                minWidth: 200,
                overflow: 'hidden',
                direction: 'rtl',
              }}>
                {/* Light header — tint only, no heavy gradient */}
                <div style={{
                  background: user.isSuperAdmin ? '#f5f3ff' : '#f0f7ff',
                  borderBottom: `1px solid ${user.isSuperAdmin ? '#ede9fe' : '#dbeafe'}`,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: user.isSuperAdmin
                      ? 'linear-gradient(135deg, #667eea, #764ba2)'
                      : 'linear-gradient(135deg, #60a5fa, #3b82f6)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 15,
                    flexShrink: 0,
                  }}>
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ color: '#111827', fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>{user.name}</div>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 500,
                      marginTop: 2,
                      color: user.isSuperAdmin ? '#7c3aed' : '#2563eb',
                    }}>
                      {user.isSuperAdmin ? 'מנהל מערכת' : 'מנהל מרכז'}
                    </div>
                  </div>
                </div>

                {/* Menu items */}
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowChangeKey(true);
                    setChangeKeyError('');
                    setChangeKeyNew('');
                    setChangeKeyConfirm('');
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    width: '100%', padding: '10px 14px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, color: '#374151', textAlign: 'right',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span>🔑</span>
                  שנה מפתח גישה
                </button>
                <div style={{ height: 1, background: '#f1f5f9', margin: '0 14px' }} />
                <button
                  onClick={() => { logout(); navigate('/login'); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    width: '100%', padding: '10px 14px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, color: '#ef4444', textAlign: 'right',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fff5f5')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span>🚪</span>
                  יציאה
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Change passkey modal */}
      {showChangeKey && (
        <div className="modal-overlay" onClick={() => setShowChangeKey(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ direction: 'rtl' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 17 }}>שינוי מפתח גישה</h3>
            <form onSubmit={handleChangeKey} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="password"
                placeholder="מפתח גישה חדש (לפחות 4 תווים)"
                value={changeKeyNew}
                onChange={e => setChangeKeyNew(e.target.value)}
                autoFocus
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 15 }}
              />
              <input
                type="password"
                placeholder="אימות מפתח גישה"
                value={changeKeyConfirm}
                onChange={e => setChangeKeyConfirm(e.target.value)}
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 15 }}
              />
              {changeKeyError && <p style={{ color: '#e53935', margin: 0, fontSize: 13 }}>{changeKeyError}</p>}
              <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>לאחר השמירה תצא מהמערכת ותצטרך להתחבר עם המפתח החדש</p>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowChangeKey(false)} className="btn-secondary">ביטול</button>
                <button type="submit" className="btn-primary" disabled={changeKeyLoading || !changeKeyNew || !changeKeyConfirm}>
                  {changeKeyLoading ? 'שומר...' : 'שמור מפתח'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* Super admin: manage center admins */}
      {!isTherapistView && user?.isSuperAdmin && (
        <div className="content-card" style={{ marginBottom: 16 }}>
          <div className="content-card-header">
            <h2>מנהלי מרכזים</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setShowAdminList(v => { const next = !v; if (next) loadAdminList(); return next; }); }}
                style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #667eea', background: 'white', color: '#667eea', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                {showAdminList ? 'הסתר רשימה' : 'הצג רשימה'}
              </button>
              <button
                onClick={() => { setShowCreateAdmin(true); setCreatedKey(null); setCreateAdminError(''); setNewAdminName(''); setNewAdminMobile(''); setNewAdminEmail(''); setNewAdminKey(''); setNewAdminKeyConfirm(''); }}
                className="btn-primary btn-small"
              >
                + מנהל חדש
              </button>
            </div>
          </div>

          {/* Admin list */}
          {showAdminList && (
            <div style={{ marginTop: 12, direction: 'rtl' }}>
              {adminListLoading ? (
                <p style={{ color: '#9ca3af', fontSize: 14 }}>טוען...</p>
              ) : adminList.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: 14 }}>אין מנהלים עדיין</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f3f4f6', textAlign: 'right' }}>
                      <th style={{ padding: '6px 8px', fontWeight: 600, color: '#6b7280' }}>שם</th>
                      <th style={{ padding: '6px 8px', fontWeight: 600, color: '#6b7280' }}>טלפון</th>
                      <th style={{ padding: '6px 8px', fontWeight: 600, color: '#6b7280' }}>אימייל</th>
                      <th style={{ padding: '6px 8px', fontWeight: 600, color: '#6b7280' }}>מפתח</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminList.map(a => (
                      <tr key={a.adminId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px' }}>{a.name}</td>
                        <td style={{ padding: '8px', color: '#6b7280' }}>{a.mobile || '—'}</td>
                        <td style={{ padding: '8px', color: '#6b7280' }}>{a.email || '—'}</td>
                        <td style={{ padding: '8px' }}>
                          <code style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: 6, letterSpacing: 2, fontSize: 13 }}>{a.key}</code>
                        </td>
                        <td style={{ padding: '8px' }}>
                          <button
                            onClick={() => handleDeleteAdmin(a.adminId, a.name)}
                            style={{ background: 'none', border: '1px solid #fca5a5', color: '#ef4444', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 12 }}
                          >
                            מחק
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create admin modal */}
      {showCreateAdmin && (
        <div className="modal-overlay" onClick={() => setShowCreateAdmin(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ direction: 'rtl', minWidth: 320 }}>
            {!createdKey ? (
              <>
                <h3 style={{ margin: '0 0 18px', fontSize: 17 }}>הוספת מנהל מרכז חדש</h3>
                <form onSubmit={handleCreateAdmin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>שם המנהל / המרכז *</label>
                    <input
                      placeholder="שם"
                      value={newAdminName}
                      onChange={e => setNewAdminName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>טלפון נייד</label>
                    <input
                      placeholder="05X-XXXXXXX"
                      value={newAdminMobile}
                      onChange={e => setNewAdminMobile(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>אימייל</label>
                    <input
                      type="email"
                      placeholder="example@email.com"
                      value={newAdminEmail}
                      onChange={e => setNewAdminEmail(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>מפתח גישה *</label>
                    <input
                      type="password"
                      placeholder="לפחות 4 תווים"
                      value={newAdminKey}
                      onChange={e => setNewAdminKey(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>אימות מפתח גישה *</label>
                    <input
                      type="password"
                      placeholder="הכנס שוב"
                      value={newAdminKeyConfirm}
                      onChange={e => setNewAdminKeyConfirm(e.target.value)}
                      required
                    />
                  </div>
                  {createAdminError && <p style={{ color: '#e53935', margin: 0, fontSize: 13 }}>{createAdminError}</p>}
                  <div className="modal-actions">
                    <button type="button" onClick={() => setShowCreateAdmin(false)} className="btn-secondary">ביטול</button>
                    <button type="submit" className="btn-primary" disabled={createAdminLoading || !newAdminName.trim() || !newAdminKey.trim()}>
                      {createAdminLoading ? 'יוצר...' : 'צור מנהל'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <h3 style={{ margin: '0 0 8px', color: '#15803d' }}>מנהל נוצר בהצלחה!</h3>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>שלח את המפתח הזה למנהל המרכז:</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, direction: 'ltr', marginBottom: 16 }}>
                  <code style={{ fontSize: 24, fontWeight: 700, letterSpacing: 4, color: '#1e3a8a', background: '#dbeafe', padding: '8px 16px', borderRadius: 10 }}>
                    {createdKey}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(createdKey)}
                    style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #93c5fd', background: 'white', cursor: 'pointer', fontSize: 13 }}
                  >
                    העתק
                  </button>
                </div>
                <button
                  onClick={() => { setCreatedKey(null); setShowCreateAdmin(false); if (showAdminList) loadAdminList(); }}
                  className="btn-primary"
                >
                  סגור
                </button>
              </div>
            )}
          </div>
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
