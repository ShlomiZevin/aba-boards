import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { useAuth } from '../contexts/AuthContext';
import { sessionsApi, adminApi } from '../api/client';
import SideDrawer from './SideDrawer';
import { useTrialDaysLeft } from './SubscriptionGate';

const BASE = import.meta.env.BASE_URL;

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const { user, logout } = useAuth();
  const trialDays = useTrialDaysLeft();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Change key state
  const [showChangeKey, setShowChangeKey] = useState(false);
  const [changeKeyNew, setChangeKeyNew] = useState('');
  const [changeKeyConfirm, setChangeKeyConfirm] = useState('');
  const [changeKeyError, setChangeKeyError] = useState('');
  const [changeKeyLoading, setChangeKeyLoading] = useState(false);

  // Upgrade / cancel state
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const { updateSubscription } = useAuth();

  async function handleCancelSubscription() {
    setCancelLoading(true);
    const res = await adminApi.cancelSubscription();
    setCancelLoading(false);
    if (res.success) {
      updateSubscription({ ...user!.subscription!, status: 'cancelled' });
      setShowCancelConfirm(false);
    }
  }

  // Profile edit state
  const [showProfile, setShowProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileMobile, setProfileMobile] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const { updateUserProfile } = useAuth();

  const { data: alertsResponse } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => sessionsApi.getAlerts(),
  });
  const alertCount = alertsResponse?.data?.length || 0;

  function openProfile() {
    setProfileName(user?.name || '');
    setProfileMobile(user?.mobile || '');
    setProfileEmail(user?.email || '');
    setProfileError('');
    setShowProfile(true);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profileName.trim()) { setProfileError('שם הוא שדה חובה'); return; }
    setProfileLoading(true);
    setProfileError('');
    const res = await adminApi.updateProfile({ name: profileName.trim(), mobile: profileMobile.trim(), email: profileEmail.trim() });
    setProfileLoading(false);
    if (res.success) {
      updateUserProfile(profileName.trim(), profileMobile.trim(), profileEmail.trim());
      setShowProfile(false);
    } else {
      setProfileError(res.error || 'שגיאה בשמירה');
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

  const navItems = [
    { path: '/', label: 'ילדים', icon: '👧' },
    { path: '/chat', label: 'צ׳אט AI', icon: '🤖' },
    { path: '/forms', label: 'טפסים', icon: '📋' },
    { path: '/practitioners', label: 'אנשי צוות', icon: '👥' },
    { path: '/crew-hours', label: 'שעות צוות', icon: '🕐' },
    { path: '/notifications', label: 'מרכז הודעות', icon: '💬' },
    ...(user?.isSuperAdmin ? [
      { path: '/goal-library', label: 'ספריית מטרות', icon: '🎯' },
      { path: '/admin-management', label: 'מנהלי מרכזים', icon: '⚙' },
    ] : []),
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/' || location.pathname === '';
    return location.pathname.startsWith(path);
  };

  const navContent = (
    <>
      {navItems.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={`sidebar-nav-item${isActive(item.path) ? ' active' : ''}`}
          onClick={() => setDrawerOpen(false)}
        >
          <span className="sidebar-nav-icon">{item.icon}</span>
          <span className="sidebar-nav-label">{item.label}</span>
          {item.path === '/' && alertCount > 0 && (
            <span className="alert-badge">{alertCount}</span>
          )}
        </Link>
      ))}
    </>
  );

  return (
    <div className="app-shell">
      {/* Sidebar - desktop only */}
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <img src={`${BASE}doing-logo-transparent2.png`} alt="Doing" className="sidebar-logo" />
          <span className="sidebar-title">מרכז הטיפול</span>
        </div>

        <nav className="sidebar-nav">
          {navContent}
        </nav>

        <div className="sidebar-footer">
          {user && (
            <button
              className="sidebar-user"
              onClick={openProfile}
              style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'right', padding: 0 }}
              title="עריכת פרופיל"
            >
              <div className="sidebar-user-avatar">
                {user.name.charAt(0)}
              </div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{user.name}</div>
                <div className="sidebar-user-role">
                  {user.isSuperAdmin ? 'מנהל מערכת' : 'מנהל מרכז'}
                </div>
              </div>
            </button>
          )}
          {/* Trial badge */}
          {!user?.isSuperAdmin && user?.subscription?.plan === 'trial' && trialDays <= 7 && trialDays > 0 && (
            <div style={{
              margin: '0 8px 8px',
              padding: '8px 12px',
              borderRadius: 10,
              background: trialDays <= 2 ? '#fff3cd' : '#f0eeff',
              border: `1px solid ${trialDays <= 2 ? '#f59e0b' : '#c4b5fd'}`,
              fontSize: 12,
              color: trialDays <= 2 ? '#92400e' : '#5b21b6',
              textAlign: 'center',
              direction: 'rtl',
            }}>
              <div style={{ fontWeight: 700 }}>ניסיון — {trialDays} ימים נותרו</div>
              <div style={{ marginTop: 4, fontSize: 11 }}>
                <button onClick={() => setShowUpgrade(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 600, padding: 0, fontSize: 11 }}>שדרג לפרו ←</button>
              </div>
            </div>
          )}
          {!user?.isSuperAdmin && user?.subscription?.plan === 'pro' && user.subscription.status === 'active' && (
            <div style={{
              margin: '0 8px 8px',
              padding: '8px 12px',
              borderRadius: 10,
              background: '#f0fdf4',
              border: '1px solid #86efac',
              fontSize: 12,
              color: '#15803d',
              textAlign: 'center',
              direction: 'rtl',
            }}>
              <div style={{ fontWeight: 700 }}>✓ פרו פעיל</div>
              <div style={{ marginTop: 4, fontSize: 11 }}>
                <button onClick={() => setShowCancelConfirm(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0, fontSize: 11 }}>ביטול מנוי</button>
              </div>
            </div>
          )}

          <button
            className="sidebar-nav-item"
            onClick={() => {
              setShowChangeKey(true);
              setChangeKeyError('');
              setChangeKeyNew('');
              setChangeKeyConfirm('');
            }}
          >
            <span className="sidebar-nav-icon">🔑</span>
            <span className="sidebar-nav-label">שנה מפתח</span>
          </button>
          <button
            className="sidebar-nav-item danger"
            onClick={() => { logout(); navigate('/login'); }}
          >
            <span className="sidebar-nav-icon">🚪</span>
            <span className="sidebar-nav-label">יציאה</span>
          </button>
        </div>
      </aside>

      {/* Top bar - mobile only */}
      <header className="app-topbar">
        <div className="topbar-brand">
          <img src={`${BASE}doing-logo-transparent2.png`} alt="Doing" className="topbar-logo" />
        </div>
        <button className="hamburger-btn" onClick={() => setDrawerOpen(true)}>
          ☰
        </button>
      </header>

      {/* Mobile drawer */}
      <SideDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <div className="drawer-header">
          {user && (
            <div className="drawer-user">
              <div className="drawer-user-avatar">
                {user.name.charAt(0)}
              </div>
              <div>
                <div className="drawer-user-name">{user.name}</div>
                <div className="drawer-user-role">
                  {user.isSuperAdmin ? 'מנהל מערכת' : 'מנהל מרכז'}
                </div>
              </div>
            </div>
          )}
        </div>
        <nav className="drawer-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`drawer-nav-item${isActive(item.path) ? ' active' : ''}`}
              onClick={() => setDrawerOpen(false)}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
              {item.path === '/' && alertCount > 0 && (
                <span className="alert-badge">{alertCount}</span>
              )}
            </Link>
          ))}
          <div className="drawer-divider" />
          <button
            className="drawer-nav-item"
            onClick={() => {
              setDrawerOpen(false);
              setShowChangeKey(true);
              setChangeKeyError('');
              setChangeKeyNew('');
              setChangeKeyConfirm('');
            }}
          >
            <span>🔑</span>
            <span>שנה מפתח גישה</span>
          </button>
          <button
            className="drawer-nav-item danger"
            onClick={() => { logout(); navigate('/login'); }}
          >
            <span>🚪</span>
            <span>יציאה</span>
          </button>
        </nav>
      </SideDrawer>

      {/* Main content */}
      <main className="app-main">
        {children}
      </main>

      {/* Upgrade overlay (trial → pro) */}
      {showUpgrade && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowUpgrade(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 24, padding: '40px 32px', maxWidth: 500, width: '90%', direction: 'rtl', textAlign: 'center', position: 'relative' }}>
            <button onClick={() => setShowUpgrade(false)} style={{ position: 'absolute', top: 16, left: 16, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⭐</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>שדרג לפרו</h2>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280' }}>גישה מלאה ללא הגבלה</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <UpgradeCard title="חודשי" price="20" period="לחודש" billingCycle="monthly" onSuccess={() => setShowUpgrade(false)} />
              <UpgradeCard title="שנתי" price="200" period="לשנה" billingCycle="yearly" badge="חסכון 17%" onSuccess={() => setShowUpgrade(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Cancel subscription confirmation */}
      {showCancelConfirm && (
        <div className="modal-overlay" onClick={() => setShowCancelConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ direction: 'rtl' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 17 }}>ביטול מנוי</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280' }}>האם אתה בטוח? הגישה תישמר עד סוף תקופת החיוב הנוכחית.</p>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowCancelConfirm(false)} className="btn-secondary">ביטול</button>
              <button
                type="button"
                onClick={handleCancelSubscription}
                disabled={cancelLoading}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#ef4444', color: 'white', fontSize: 14, fontWeight: 600, cursor: cancelLoading ? 'not-allowed' : 'pointer', opacity: cancelLoading ? 0.6 : 1 }}
              >
                {cancelLoading ? 'מבטל...' : 'כן, בטל מנוי'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile edit modal */}
      {showProfile && (
        <div className="modal-overlay" onClick={() => setShowProfile(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ direction: 'rtl' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 17 }}>עריכת פרופיל</h3>
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text"
                placeholder="שם"
                value={profileName}
                onChange={e => setProfileName(e.target.value)}
                autoFocus
                required
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 15 }}
              />
              <input
                type="tel"
                placeholder="טלפון"
                value={profileMobile}
                onChange={e => setProfileMobile(e.target.value)}
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 15 }}
              />
              <input
                type="email"
                placeholder="אימייל"
                value={profileEmail}
                onChange={e => setProfileEmail(e.target.value)}
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 15 }}
              />
              {profileError && <p style={{ color: '#e53935', margin: 0, fontSize: 13 }}>{profileError}</p>}
              <div className="modal-actions">
                <button type="button" onClick={() => setShowProfile(false)} className="btn-secondary">ביטול</button>
                <button type="submit" className="btn-primary" disabled={profileLoading || !profileName}>
                  {profileLoading ? 'שומר...' : 'שמור'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
    </div>
  );
}

function UpgradeCard({ title, price, period, billingCycle, badge, onSuccess }: {
  title: string; price: string; period: string;
  billingCycle: 'monthly' | 'yearly'; badge?: string; onSuccess: () => void;
}) {
  const [{ isPending }] = usePayPalScriptReducer();
  const { refreshUser } = useAuth();

  return (
    <div style={{
      border: billingCycle === 'yearly' ? '2px solid #667eea' : '2px solid #e2e8f0',
      borderRadius: 14, padding: '20px 20px 16px', minWidth: 180, flex: 1,
      background: billingCycle === 'yearly' ? '#f5f3ff' : 'white', position: 'relative',
    }}>
      {badge && (
        <div style={{ position: 'absolute', top: -11, right: '50%', transform: 'translateX(50%)', background: '#667eea', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>{badge}</div>
      )}
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#667eea', marginBottom: 2 }}>₪{price}</div>
      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14 }}>{period}</div>
      {isPending ? (
        <div style={{ height: 40, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#9ca3af' }}>טוען...</div>
      ) : (
        <PayPalButtons
          style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'subscribe', height: 40 }}
          createSubscription={async (_data, _actions) => {
            const res = await adminApi.createSubscription(billingCycle);
            if (!res.success || !res.data?.subscriptionId) throw new Error(res.error || 'Failed');
            return res.data.subscriptionId;
          }}
          onApprove={async (data) => {
            const res = await adminApi.activateSubscription(data.subscriptionID || '');
            if (res.success) { await refreshUser(); onSuccess(); }
          }}
        />
      )}
    </div>
  );
}
