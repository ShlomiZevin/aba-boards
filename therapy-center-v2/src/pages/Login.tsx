import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

import '../v2/pages/tm.css';

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
    <div className="tm-cover-page" dir="rtl">
      <div className="tm-cover">
        <span className="tm-cover-label" aria-hidden="true">מחברת שטח</span>
        <img className="tm-cover-logo" src={`${BASE}doing-logo-transparent2.png`} alt="Doing" />
        <h1>מרכז <mark className="hl-yellow">הטיפול</mark></h1>
        <p className="tm-cover-sub">הכניסו את מפתח הגישה שלכם כדי להמשיך</p>

        <form onSubmit={handleSubmit}>
          <label className={`tm-in tm-key${error ? ' is-err' : ''}`}>
            <span>מפתח גישה</span>
            <input
              type="password"
              placeholder="• • • •"
              value={value}
              onChange={e => { setValue(e.target.value); setError(''); }}
              autoComplete="current-password"
              aria-invalid={!!error}
              autoFocus
            />
          </label>

          {error && <p className="tm-err" role="alert">{error}</p>}

          <button type="submit" className="nb-btn block" disabled={loading || !value.trim()}>
            {loading ? 'נכנסים…' : 'כניסה'}
          </button>
        </form>

        <p className="tm-cover-foot">
          אין לך חשבון? <Link to="/signup">הרשמה חינם</Link>
        </p>
      </div>
    </div>
  );
}
