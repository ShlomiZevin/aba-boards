import { useState } from 'react';

/* ============================================================
 *  Meeting Vote Page — public, simple, Doing style.
 *  Edit the MEETING_OPTIONS array to change the date suggestions.
 * ============================================================ */

const MEETING_OPTIONS = [
  { id: 'mon', label: 'יום שני, 1 ביוני 2026 — 20:30 עד 21:30' },
  { id: 'tue', label: 'יום שלישי, 2 ביוני 2026 — 20:30 עד 21:30' },
];

const API_BASE = import.meta.env.DEV
  ? '/api/therapy'
  : 'https://avatar-server-1018338671074.me-west1.run.app/api/therapy';

export default function MeetingVote() {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');

  const toggle = (id: string) => {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || selected.length === 0) return;
    setStatus('submitting');
    try {
      const labels = MEETING_OPTIONS.filter(o => selected.includes(o.id)).map(o => o.label);
      const res = await fetch(`${API_BASE}/meeting-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), contact: contact.trim(), dates: labels }),
      });
      if (!res.ok) throw new Error('failed');
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'done') {
    return (
      <div className="mv-root" dir="rtl">
        <div className="mv-card mv-card-success">
          <img src="/therapy/doing-logo-transparent2.png" alt="Doing" className="mv-logo" />
          <div className="mv-check">✓</div>
          <h1 className="mv-title">תודה!</h1>
          <p className="mv-subtitle">קיבלנו את ההצבעה שלך 🙏</p>
          <p className="mv-subtitle">נשלח לך פרטים ברגע שנסגור את התאריך הסופי.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mv-root" dir="rtl">
      <div className="mv-card">
        <img src="/therapy/doing-logo-transparent2.png" alt="Doing" className="mv-logo" />
        <h1 className="mv-title">מפגש הדרכה ל-Doing</h1>
        <p className="mv-subtitle">
          נשמח לערוך מפגש זום של שעה כדי להכיר את המערכת ולענות על שאלות.<br />
          סמן/י את המועדים שמתאימים לך — נבחר את המועד עם הכי הרבה משתתפים.
        </p>

        <form onSubmit={submit} className="mv-form">
          <label className="mv-label">
            <span>השם שלך</span>
            <input
              className="mv-input"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="לדוגמה: יעל כהן"
              required
            />
          </label>

          <label className="mv-label">
            <span>טלפון או מייל (לא חובה)</span>
            <input
              className="mv-input"
              type="text"
              value={contact}
              onChange={e => setContact(e.target.value)}
              placeholder="כדי שנוכל לשלוח לך את הקישור"
            />
          </label>

          <div className="mv-options-label">בחר/י את המועדים שמתאימים:</div>
          <div className="mv-options">
            {MEETING_OPTIONS.map(opt => {
              const active = selected.includes(opt.id);
              return (
                <button
                  type="button"
                  key={opt.id}
                  className={`mv-option ${active ? 'active' : ''}`}
                  onClick={() => toggle(opt.id)}
                >
                  <span className="mv-option-check">{active ? '✓' : ''}</span>
                  <span className="mv-option-label">{opt.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="submit"
            className="mv-submit"
            disabled={status === 'submitting' || !name.trim() || selected.length === 0}
          >
            {status === 'submitting' ? 'שולח...' : 'שלח/י הצבעה'}
          </button>

          {status === 'error' && (
            <div className="mv-error">משהו השתבש, נסה/י שוב או צור/י קשר ישירות.</div>
          )}
        </form>
      </div>
    </div>
  );
}
