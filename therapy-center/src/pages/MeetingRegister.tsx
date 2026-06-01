import { useState } from 'react';

/* ============================================================
 *  Meeting Registration — single fixed date. Doing style.
 *  Edit MEETING_LABEL to change the date.
 * ============================================================ */

const MEETING_LABEL = 'יום שלישי, 2 ביוני 2026 — 20:30 עד 21:30';

const API_BASE = import.meta.env.DEV
  ? '/api/therapy'
  : 'https://avatar-server-1018338671074.me-west1.run.app/api/therapy';

export default function MeetingRegister() {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [recordingOnly, setRecordingOnly] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setStatus('submitting');
    try {
      const res = await fetch(`${API_BASE}/meeting-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          contact: contact.trim(),
          dates: [recordingOnly ? 'ארצה צילום בלבד' : MEETING_LABEL],
        }),
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
          <h1 className="mv-title">{recordingOnly ? 'תודה!' : 'נרשמת בהצלחה!'}</h1>
          <p className="mv-subtitle">
            {recordingOnly
              ? 'נשלח אליך את הקלטת המפגש מיד לאחר שהיא תהיה זמינה 🤍'
              : 'נתראה ביום שלישי, 2 ביוני בשעה 20:30 🤍'}
          </p>
          <p className="mv-subtitle">
            {recordingOnly
              ? 'נחכה לעדכן אותך במייל.'
              : 'קישור לזום יישלח אליך לפני המפגש.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mv-root" dir="rtl">
      <div className="mv-card">
        <img src="/therapy/doing-logo-transparent2.png" alt="Doing" className="mv-logo" />
        <h1 className="mv-title">הרשמה למפגש Doing</h1>
        <p className="mv-subtitle">
          נשמח לראותך במפגש זום של שעה — נציג את המערכת, נראה איך עובדים איתה, ונענה על שאלות.
        </p>

        <div className="mv-date-badge">
          <div className="mv-date-label">מועד המפגש</div>
          <div className="mv-date-value">{MEETING_LABEL}</div>
        </div>

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
            <span>{recordingOnly ? 'מייל לקבלת ההקלטה' : 'טלפון או מייל (לא חובה)'}</span>
            <input
              className="mv-input"
              type="text"
              value={contact}
              onChange={e => setContact(e.target.value)}
              placeholder={recordingOnly ? 'כדי שנשלח לך את ההקלטה' : 'כדי שנשלח לך את קישור הזום'}
              required={recordingOnly}
            />
          </label>

          <label className="mv-checkbox">
            <input
              type="checkbox"
              checked={recordingOnly}
              onChange={e => setRecordingOnly(e.target.checked)}
            />
            <span>לא אוכל להגיע — ארצה לקבל את הצילום</span>
          </label>

          <button
            type="submit"
            className="mv-submit"
            disabled={status === 'submitting' || !name.trim() || (recordingOnly && !contact.trim())}
          >
            {status === 'submitting'
              ? 'שולח...'
              : recordingOnly ? 'שלח/י בקשה לצילום' : 'אני מצטרפ/ת'}
          </button>

          {status === 'error' && (
            <div className="mv-error">משהו השתבש, נסה/י שוב או צור/י קשר ישירות.</div>
          )}
        </form>
      </div>
    </div>
  );
}
