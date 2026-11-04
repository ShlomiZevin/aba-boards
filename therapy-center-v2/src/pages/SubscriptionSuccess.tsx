import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { adminApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import Icon from '../v2/Icon';
import '../v2/pages/dr-admin.css';

const BASE = import.meta.env.BASE_URL;

export default function SubscriptionSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const subscriptionId = searchParams.get('subscription_id') || searchParams.get('token');
    if (!subscriptionId) {
      setError('לא נמצא מזהה מנוי');
      setStatus('error');
      return;
    }

    adminApi.activateSubscription(subscriptionId).then(async (res) => {
      if (res.success) {
        await refreshUser();
        setStatus('success');
        setTimeout(() => navigate('/'), 2000);
      } else {
        setError(res.error || 'שגיאה באימות התשלום');
        setStatus('error');
      }
    });
  }, []);

  return (
    <div className="dr-status-page" dir="rtl">
      <div className="dr-status-card nb-card nb-tape">
        <img src={`${BASE}doing-logo-transparent2.png`} alt="Doing" className="dr-status-logo" />

        {status === 'loading' && (
          <>
            <span className="dr-status-ico tone-sky" aria-hidden><Icon name="clock" size={34} /></span>
            <h2 className="dr-status-title">מאמת תשלום…</h2>
            <p className="dr-status-text">רגע אחד</p>
          </>
        )}

        {status === 'success' && (
          <>
            <span className="dr-status-ico tone-mint" aria-hidden><Icon name="sparkle" size={34} /></span>
            <h2 className="dr-status-title">התשלום <mark className="hl-mint">הצליח!</mark></h2>
            <p className="dr-status-text">ברוך הבא לפרו. מעביר אותך…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <span className="dr-status-ico tone-pink" aria-hidden><Icon name="close" size={34} /></span>
            <h2 className="dr-status-title is-error">שגיאה</h2>
            <p className="dr-status-text">{error}</p>
            <button type="button" onClick={() => navigate('/')} className="nb-btn block">
              חזרה לדשבורד
            </button>
          </>
        )}
      </div>
    </div>
  );
}
