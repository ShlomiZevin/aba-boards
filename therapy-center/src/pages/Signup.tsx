import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { adminApi } from '../api/client';

const BASE = import.meta.env.BASE_URL;

export default function Signup() {
  const { setKey } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', mobile: '', email: '', key: '', confirmKey: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function setField(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.key !== form.confirmKey) {
      setError('מפתחות הגישה אינם תואמים');
      return;
    }
    if (form.key.trim().length < 4) {
      setError('מפתח גישה חייב להכיל לפחות 4 תווים');
      return;
    }

    setLoading(true);
    setError('');

    const res = await adminApi.signup({
      name: form.name.trim(),
      mobile: form.mobile.trim(),
      email: form.email.trim(),
      key: form.key.trim(),
    });

    if (!res.success) {
      setError(res.error || 'שגיאה ביצירת החשבון');
      setLoading(false);
      return;
    }

    // Auto-login
    const ok = await setKey(form.key.trim());
    if (ok) {
      navigate('/');
    } else {
      setError('החשבון נוצר, אך הכניסה נכשלה. נסה להתחבר ידנית.');
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderRadius: 10,
    border: '1.5px solid #e2e8f0',
    background: '#f8fafc',
    fontSize: 15,
    outline: 'none',
    color: '#1a1a2e',
    transition: 'border-color 0.15s',
    width: '100%',
    boxSizing: 'border-box',
    direction: 'rtl',
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(150deg, #f0eeff 0%, #e8f0ff 60%, #f5f5ff 100%)',
      overflowY: 'auto',
    }}>
      <div style={{
        background: 'white',
        borderRadius: 20,
        padding: '40px 44px 36px',
        boxShadow: '0 8px 40px rgba(102,126,234,0.13), 0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: 340,
        direction: 'rtl',
        margin: '20px 0',
      }}>
        <img
          src={`${BASE}doing-logo-transparent2.png`}
          alt="Doing"
          style={{ height: 54, marginBottom: 18, objectFit: 'contain' }}
        />

        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#1a1a2e' }}>
          יצירת חשבון
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
          7 ימי ניסיון חינם, ללא כרטיס אשראי
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
          <input
            style={inputStyle}
            type="text"
            placeholder="שם המרכז / שמך"
            value={form.name}
            onChange={e => setField('name', e.target.value)}
            required
            autoFocus
          />
          <input
            style={inputStyle}
            type="tel"
            placeholder="טלפון"
            value={form.mobile}
            onChange={e => setField('mobile', e.target.value)}
            required
          />
          <input
            style={inputStyle}
            type="email"
            placeholder="אימייל"
            value={form.email}
            onChange={e => setField('email', e.target.value)}
            required
          />
          <input
            style={inputStyle}
            type="password"
            placeholder="מפתח גישה (לפחות 4 תווים)"
            value={form.key}
            onChange={e => setField('key', e.target.value)}
            required
          />
          <input
            style={inputStyle}
            type="password"
            placeholder="אימות מפתח גישה"
            value={form.confirmKey}
            onChange={e => setField('confirmKey', e.target.value)}
            required
          />

          {error && (
            <p style={{ margin: 0, color: '#ef4444', fontSize: 13, textAlign: 'center' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !form.name || !form.mobile || !form.email || !form.key || !form.confirmKey}
            style={{
              marginTop: 4,
              padding: '12px 0',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading || !form.name || !form.mobile || !form.email || !form.key || !form.confirmKey ? 0.55 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? '...' : 'יצירת חשבון'}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 13, color: '#9ca3af' }}>
          כבר יש לך חשבון?{' '}
          <Link to="/login" style={{ color: '#667eea', textDecoration: 'none', fontWeight: 600 }}>
            כניסה
          </Link>
        </p>
      </div>
    </div>
  );
}
