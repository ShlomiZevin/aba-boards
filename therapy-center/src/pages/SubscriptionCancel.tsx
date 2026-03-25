import { useNavigate } from 'react-router-dom';

const BASE = import.meta.env.BASE_URL;

export default function SubscriptionCancel() {
  const navigate = useNavigate();

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
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔙</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, color: '#1a1a2e' }}>התשלום בוטל</h2>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>
          לא בוצע חיוב. תוכל לשדרג בכל עת.
        </p>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '10px 24px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          חזרה
        </button>
      </div>
    </div>
  );
}
