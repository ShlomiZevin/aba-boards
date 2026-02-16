import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { kidsApi } from '../api/client';
import GoalsTab from '../components/GoalsTab';

const BASE = import.meta.env.BASE_URL;
const DEFAULT_AVATAR = `${BASE}me-default-small.jpg`;

export default function GoalsPage() {
  const { kidId } = useParams<{ kidId: string }>();

  const { data: kidRes, isLoading } = useQuery({
    queryKey: ['kid', kidId],
    queryFn: () => kidsApi.getById(kidId!),
    enabled: !!kidId,
  });

  const kid = kidRes?.data;

  if (isLoading) {
    return (
      <div className="container">
        <div className="loading">טוען...</div>
      </div>
    );
  }

  if (!kid) {
    return (
      <div className="container">
        <div className="content-card">
          <div className="empty-state">
            <p>הילד לא נמצא</p>
            <Link to="/" className="btn-primary" style={{ marginTop: '16px', display: 'inline-block' }}>
              חזור לדף הבית
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const avatarUrl = kid.imageName ? `${BASE}${kid.imageName}` : DEFAULT_AVATAR;

  return (
    <div className="container">
      {/* Combined Header with Logo and Back */}
      <div className="kid-header-card">
        <div className="kid-header-top">
          <Link to={`/kid/${kidId}`} className="kid-header-back">
            <span className="back-arrow">←</span>
            <img src={`${BASE}doing-logo-transparent2.png`} alt="Doing" className="logo-small" />
          </Link>
        </div>
        <div className="goals-page-header">
          <img
            src={avatarUrl}
            alt={kid.name}
            className="kid-avatar"
            onError={(e) => {
              (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
            }}
          />
          <div>
            <h1 style={{ fontSize: '1.3em', fontWeight: 700, color: '#2d3748', marginBottom: '4px', margin: 0 }}>
              מטרות טיפוליות
            </h1>
            <p style={{ color: '#64748b', margin: '4px 0 0 0' }}>{kid.name}</p>
          </div>
        </div>
      </div>

      {/* Goals Content */}
      <div className="content-card">
        <GoalsTab kidId={kidId!} />
      </div>
    </div>
  );
}
