import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { adminApi } from '../api/client';

import '../v2/pages/tm.css';

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

  return (
    <div className="tm-cover-page" dir="rtl">
      <div className="tm-cover">
        <span className="tm-cover-label" aria-hidden="true">מחברת חדשה</span>
        <img className="tm-cover-logo" src={`${BASE}doing-logo-transparent2.png`} alt="Doing" />
        <h1>יצירת <mark className="hl-mint">חשבון</mark></h1>
        <p className="tm-cover-sub">7 ימי ניסיון חינם, ללא כרטיס אשראי</p>

        <form onSubmit={handleSubmit}>
          <label className="tm-in">
            <span>שם המרכז / שמך</span>
            <input type="text" value={form.name} onChange={e => setField('name', e.target.value)} autoComplete="organization" required autoFocus />
          </label>
          <label className="tm-in">
            <span>טלפון</span>
            <input type="tel" dir="ltr" value={form.mobile} onChange={e => setField('mobile', e.target.value)} autoComplete="tel" required />
          </label>
          <label className="tm-in">
            <span>אימייל</span>
            <input type="email" dir="ltr" value={form.email} onChange={e => setField('email', e.target.value)} autoComplete="email" required />
          </label>
          <label className="tm-in">
            <span>מפתח גישה (לפחות 4 תווים)</span>
            <input type="password" value={form.key} onChange={e => setField('key', e.target.value)} autoComplete="new-password" required />
          </label>
          <label className="tm-in">
            <span>אימות מפתח גישה</span>
            <input type="password" value={form.confirmKey} onChange={e => setField('confirmKey', e.target.value)} autoComplete="new-password" required />
          </label>

          {error && <p className="tm-err" role="alert">{error}</p>}

          <button
            type="submit"
            className="nb-btn block"
            disabled={loading || !form.name || !form.mobile || !form.email || !form.key || !form.confirmKey}
          >
            {loading ? 'יוצרים…' : 'יצירת חשבון'}
          </button>
        </form>

        <p className="tm-cover-foot">
          כבר יש לך חשבון? <Link to="/login">כניסה</Link>
        </p>
      </div>
    </div>
  );
}
