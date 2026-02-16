import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { kidsApi, sessionsApi } from '../api/client';
import type { Kid } from '../types';

// Use import.meta.env.BASE_URL for correct path in both dev and production
const BASE = import.meta.env.BASE_URL;
const DEFAULT_AVATAR = `${BASE}me-default-small.jpg`;

function KidCard({ kid }: { kid: Kid }) {
  const avatarUrl = kid.imageName ? `${BASE}${kid.imageName}` : DEFAULT_AVATAR;

  return (
    <div className="kid-card-container">
      <Link to={`/kid/${kid.id}`} className="kid-card">
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
        <Link to={`/kid/${kid.id}`} className="kid-action-btn with-label">
          <span className="action-icon">🏠</span>
          <span className="action-label">דף ילד</span>
        </Link>
        <a href={`/board.html?kid=${kid.id}`} className="kid-action-btn with-label">
          <span className="action-icon">📱</span>
          <span className="action-label">לוח</span>
        </a>
        <a href={`/board-builder.html?kid=${kid.id}`} className="kid-action-btn with-label">
          <span className="action-icon">🎨</span>
          <span className="action-label">בנה לוח</span>
        </a>
        <a href={`/stats.html?kid=${kid.id}`} className="kid-action-btn with-label">
          <span className="action-icon">📊</span>
          <span className="action-label">סטטיסטיקה</span>
        </a>
      </div>
    </div>
  );
}


export default function Dashboard() {
  const { data: kidsResponse, isLoading: kidsLoading } = useQuery({
    queryKey: ['kids'],
    queryFn: () => kidsApi.getAll(),
  });

  const { data: alertsResponse } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => sessionsApi.getAlerts(),
  });

  const kids = kidsResponse?.data || [];
  const alerts = alertsResponse?.data || [];

  return (
    <div className="container">
      {/* Header */}
      <div className="header-card">
        <img src={`${BASE}doing-logo-transparent2.png`} alt="Doing" className="logo" />
        <h1>מרכז הטיפול</h1>
        <p>ניהול ילדים, מטפלות, מטרות וטפסים</p>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="alerts-box">
          <h3>התראות ({alerts.length})</h3>
          <p>יש {alerts.length} טפסים שממתינים למילוי</p>
        </div>
      )}

      {/* Kids Section */}
      <div className="content-card">
        <div className="content-card-header">
          <h2>הילדים</h2>
        </div>

        {kidsLoading ? (
          <div className="loading">טוען...</div>
        ) : kids.length === 0 ? (
          <div className="empty-state">
            <p>אין ילדים במערכת</p>
            <p style={{ fontSize: '0.85em', marginTop: '8px' }}>
              הוסף ילדים דרך מסך הניהול הראשי
            </p>
          </div>
        ) : (
          <div className="kids-grid">
            {kids.map((kid) => (
              <KidCard key={kid.id} kid={kid} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
