import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTherapist } from '../contexts/TherapistContext';
import { practitionersApi, notificationsApi } from '../api/client';
import SideDrawer from './SideDrawer';

const BASE = import.meta.env.BASE_URL;

interface TherapistShellProps {
  children: React.ReactNode;
}

export default function TherapistShell({ children }: TherapistShellProps) {
  const { practitionerId } = useTherapist();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const prefix = `/t/${practitionerId}`;

  const { data: practitionerInfoRes } = useQuery({
    queryKey: ['practitioner-info', practitionerId],
    queryFn: () => practitionersApi.getInfo(practitionerId!),
    enabled: !!practitionerId,
  });
  const practitionerName = practitionerInfoRes?.data?.name || '';

  const { data: myNotificationsRes } = useQuery({
    queryKey: ['notifications', 'mine'],
    queryFn: () => notificationsApi.getMine(),
    refetchInterval: 60_000,
  });
  const unreadCount = (myNotificationsRes?.data || []).filter(n => !n.read).length;

  const navItems = [
    { path: `${prefix}/`, label: 'ילדים', icon: '👧' },
    { path: `${prefix}/forms`, label: 'טפסים', icon: '📋' },
    { path: `${prefix}/notifications`, label: 'הודעות', icon: '💬' },
  ];

  const isActive = (path: string) => {
    const current = location.pathname;
    if (path === `${prefix}/`) return current === prefix || current === `${prefix}/`;
    return current.startsWith(path);
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
          {item.path === `${prefix}/notifications` && unreadCount > 0 && (
            <span className="alert-badge">{unreadCount}</span>
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
          {practitionerName && (
            <div className="sidebar-user">
              <div className="sidebar-user-avatar">
                {practitionerName.charAt(0)}
              </div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{practitionerName}</div>
                <div className="sidebar-user-role">מטפל/ת</div>
              </div>
            </div>
          )}
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
          {practitionerName && (
            <div className="drawer-user">
              <div className="drawer-user-avatar">
                {practitionerName.charAt(0)}
              </div>
              <div>
                <div className="drawer-user-name">{practitionerName}</div>
                <div className="drawer-user-role">מטפל/ת</div>
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
              {item.path === `${prefix}/notifications` && unreadCount > 0 && (
                <span className="alert-badge">{unreadCount}</span>
              )}
            </Link>
          ))}
        </nav>
      </SideDrawer>

      {/* Main content */}
      <main className="app-main">
        {children}
      </main>
    </div>
  );
}
