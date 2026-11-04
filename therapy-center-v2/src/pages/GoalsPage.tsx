import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { kidsApi } from '../api/client';
import { useTherapist } from '../contexts/TherapistContext';
import { useTherapistLinks } from '../hooks/useTherapistLinks';
import GoalsTab from '../components/GoalsTab';
import Icon from '../v2/Icon';
import { kidColor } from '../v2/kidColor';
import '../v2/pages/kp.css';

const BASE = import.meta.env.BASE_URL;
const DEFAULT_AVATAR = `${BASE}me-default-small.jpg`;

export default function GoalsPage() {
  const { kidId } = useParams<{ kidId: string }>();
  const { isTherapistView } = useTherapist();
  const links = useTherapistLinks();

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
            <Link to={links.home()} className="btn-primary" style={{ marginTop: '16px', display: 'inline-block' }}>
              חזור לדף הבית
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const avatarUrl = kid.imageName
    ? (kid.imageName.startsWith('data:') ? kid.imageName : `${BASE}${kid.imageName}`)
    : DEFAULT_AVATAR;

  return (
    <div className="container kp-goals-page">
      <header className="kp-gp-head">
        <Link to={links.kidDetail(kidId!)} className="kh-back"><Icon name="back" size={20} /> {kid.name}</Link>
        <div className="kp-gp-who">
          {kid.imageName ? (
            <img
              src={avatarUrl}
              alt=""
              className={`nb-av lg tone-${kidColor(kid.id)}`}
              style={{ objectFit: 'cover' }}
              onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_AVATAR; }}
            />
          ) : (
            <span className={`nb-av lg tone-${kidColor(kid.id)}`}>{kid.name.charAt(0)}</span>
          )}
          <div>
            <h1 className="nb-h1"><mark className="hl-sky">מטרות</mark> טיפוליות</h1>
            <p className="nb-muted" style={{ margin: '6px 0 0' }}>{kid.name}</p>
          </div>
        </div>
      </header>

      <section className="nb-card kp-panel">
        <GoalsTab kidId={kidId!} readOnly={isTherapistView} />
      </section>
    </div>
  );
}
