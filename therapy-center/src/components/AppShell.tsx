import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { sessionsApi, adminApi } from '../api/client';
import SideDrawer from './SideDrawer';

const BASE = import.meta.env.BASE_URL;

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Change key state
  const [showChangeKey, setShowChangeKey] = useState(false);
  const [changeKeyNew, setChangeKeyNew] = useState('');
  const [changeKeyConfirm, setChangeKeyConfirm] = useState('');
  const [changeKeyError, setChangeKeyError] = useState('');
  const [changeKeyLoading, setChangeKeyLoading] = useState(false);

  const { data: alertsResponse } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => sessionsApi.getAlerts(),
  });
  const alertCount = alertsResponse?.data?.length || 0;

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
            <div className="sidebar-user">
              <div className="sidebar-user-avatar">
                {user.name.charAt(0)}
              </div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{user.name}</div>
                <div className="sidebar-user-role">
                  {user.isSuperAdmin ? 'מנהל מערכת' : 'מנהל מרכז'}
                </div>
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
