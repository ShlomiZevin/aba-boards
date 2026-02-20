import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const BASE = import.meta.env.BASE_URL;

export default function Login() {
  const { setKey } = useAuth();
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setLoading(true);
    setError('');
    const ok = await setKey(value.trim());
    if (ok) {
      navigate('/');
    } else {
      setError('מפתח גישה שגוי');
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(150deg, #f0eeff 0%, #e8f0ff 60%, #f5f5ff 100%)',
    }}>
      <div style={{
        background: 'white',
        borderRadius: 20,
        padding: '40px 44px 36px',
        boxShadow: '0 8px 40px rgba(102,126,234,0.13), 0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0,
        width: 320,
        direction: 'rtl',
      }}>
        {/* Logo */}
        <img
          src={`${BASE}doing-logo-transparent2.png`}
          alt="Doing"
          style={{ height: 54, marginBottom: 18, objectFit: 'contain' }}
        />

        {/* Title */}
        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#1a1a2e' }}>
          מרכז הטיפול
        </h2>
        <p style={{ margin: '0 0 28px', fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
          הכנס את מפתח הגישה שלך להמשך
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
          <input
            type="password"
            placeholder="• • • • • • • •"
            value={value}
            onChange={e => { setValue(e.target.value); setError(''); }}
            autoFocus
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              border: error ? '1.5px solid #fca5a5' : '1.5px solid #e2e8f0',
              background: error ? '#fff5f5' : '#f8fafc',
              fontSize: 20,
              textAlign: 'center',
              outline: 'none',
              letterSpacing: 6,
              color: '#1a1a2e',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => { if (!error) e.target.style.borderColor = '#a5b4fc'; }}
            onBlur={e => { if (!error) e.target.style.borderColor = '#e2e8f0'; }}
          />

          {error && (
            <p style={{ margin: 0, color: '#ef4444', fontSize: 13, textAlign: 'center' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !value.trim()}
            style={{
              marginTop: 4,
              padding: '12px 0',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: loading || !value.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !value.trim() ? 0.55 : 1,
              transition: 'opacity 0.15s',
              letterSpacing: 0.5,
            }}
          >
            {loading ? '...' : 'כניסה'}
          </button>
        </form>
      </div>
    </div>
  );
}
