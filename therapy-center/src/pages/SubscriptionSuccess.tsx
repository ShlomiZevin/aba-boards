import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { adminApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

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
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(150deg, #f0eeff 0%, #e8f0ff 60%, #f5f5ff 100%)',
      direction: 'rtl',
    }}>
      <div style={{
        background: 'white', borderRadius: 24, padding: '48px 40px',
        boxShadow: '0 8px 40px rgba(102,126,234,0.13)',
        textAlign: 'center', maxWidth: 400, width: '100%',
      }}>
        <img src={`${BASE}doing-logo-transparent2.png`} alt="Doing" style={{ height: 50, marginBottom: 24 }} />

        {status === 'loading' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, color: '#1a1a2e' }}>מאמת תשלום...</h2>
            <p style={{ color: '#9ca3af', fontSize: 14 }}>רגע אחד</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🎉</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, color: '#15803d' }}>התשלום הצליח!</h2>
            <p style={{ color: '#6b7280', fontSize: 14 }}>ברוך הבא לפרו. מעביר אותך...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>❌</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, color: '#dc2626' }}>שגיאה</h2>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>{error}</p>
            <button
              onClick={() => navigate('/')}
              style={{
                padding: '10px 24px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              חזרה לדשבורד
            </button>
          </>
        )}
      </div>
    </div>
  );
}
