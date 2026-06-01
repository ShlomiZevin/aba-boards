import { useEffect, useState } from 'react';

/* ============================================================
 *  Meeting Results — admin view of votes. Passkey-protected.
 * ============================================================ */

const API_BASE = import.meta.env.DEV
  ? '/api/therapy'
  : 'https://avatar-server-1018338671074.me-west1.run.app/api/therapy';

interface Vote {
  id: string;
  name: string;
  contact?: string;
  dates: string[];
  votedAt: string;
}

export default function MeetingResults() {
  const [votes, setVotes] = useState<Vote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const load = () => {
    const adminKey = localStorage.getItem('admin_key');
    if (!adminKey) {
      setError('לא מחובר. היכנס/י דרך /login קודם.');
      return;
    }
    setError(null);
    fetch(`${API_BASE}/meeting-votes`, {
      headers: { 'X-Admin-Key': adminKey },
    })
      .then(res => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then(setVotes)
      .catch(e => setError(e.message || 'שגיאה בטעינה'));
  };

  useEffect(() => { load(); }, []);

  const handleReset = async () => {
    if (!confirm('לאפס את כל ההצבעות? פעולה זו אינה הפיכה.')) return;
    const adminKey = localStorage.getItem('admin_key');
    if (!adminKey) return;
    setResetting(true);
    try {
      const res = await fetch(`${API_BASE}/meeting-votes`, {
        method: 'DELETE',
        headers: { 'X-Admin-Key': adminKey },
      });
      if (!res.ok) throw new Error(res.statusText);
      setVotes([]);
    } catch (e: any) {
      setError(e.message || 'שגיאה באיפוס');
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteOne = async (vote: Vote) => {
    if (!confirm(`למחוק את ההצבעה של ${vote.name}?`)) return;
    const adminKey = localStorage.getItem('admin_key');
    if (!adminKey) return;
    try {
      const res = await fetch(`${API_BASE}/meeting-votes/${vote.id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Key': adminKey },
      });
      if (!res.ok) throw new Error(res.statusText);
      setVotes(prev => prev ? prev.filter(v => v.id !== vote.id) : prev);
    } catch (e: any) {
      setError(e.message || 'שגיאה במחיקה');
    }
  };

  if (error) {
    return (
      <div className="mv-root" dir="rtl">
        <div className="mv-card">
          <h1 className="mv-title">שגיאה</h1>
          <p className="mv-subtitle">{error}</p>
        </div>
      </div>
    );
  }

  if (!votes) {
    return (
      <div className="mv-root" dir="rtl">
        <div className="mv-card">
          <p className="mv-subtitle">טוען...</p>
        </div>
      </div>
    );
  }

  // Aggregate by date label
  const counts = new Map<string, number>();
  for (const v of votes) {
    for (const d of v.dates) counts.set(d, (counts.get(d) || 0) + 1);
  }
  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mv-root" dir="rtl">
      <div className="mv-card mv-card-wide">
        <img src="/therapy/doing-logo-transparent2.png" alt="Doing" className="mv-logo" />
        <h1 className="mv-title">תוצאות הצבעה</h1>
        <p className="mv-subtitle">{votes.length} משתתפים הצביעו</p>

        <div className="mv-toolbar">
          <button className="mv-toolbar-btn" onClick={load}>↻ רענן</button>
          <button
            className="mv-toolbar-btn mv-toolbar-danger"
            onClick={handleReset}
            disabled={resetting || votes.length === 0}
          >
            {resetting ? 'מאפס...' : '🗑 איפוס הצבעות'}
          </button>
        </div>

        <h2 className="mv-section-title">סיכום לפי מועד</h2>
        {ranked.length === 0 ? (
          <p className="mv-empty">עדיין אין הצבעות.</p>
        ) : (
          <div className="mv-ranking">
            {ranked.map(([label, count], i) => {
              const max = ranked[0][1];
              const pct = max === 0 ? 0 : Math.round((count / max) * 100);
              return (
                <div key={label} className={`mv-rank-row ${i === 0 ? 'top' : ''}`}>
                  <div className="mv-rank-header">
                    <span className="mv-rank-label">{label}</span>
                    <span className="mv-rank-count">{count} {count === 1 ? 'הצבעה' : 'הצבעות'}</span>
                  </div>
                  <div className="mv-rank-bar"><div className="mv-rank-bar-fill" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        )}

        <h2 className="mv-section-title">פירוט המצביעים</h2>
        {votes.length === 0 ? (
          <p className="mv-empty">—</p>
        ) : (
          <div className="mv-voters">
            {votes.map(v => (
              <div key={v.id} className="mv-voter">
                <div className="mv-voter-head">
                  <span className="mv-voter-name">{v.name}</span>
                  {v.contact && <span className="mv-voter-contact">{v.contact}</span>}
                  <span className="mv-voter-time">{new Date(v.votedAt).toLocaleString('he-IL')}</span>
                  <button
                    className="mv-voter-delete"
                    onClick={() => handleDeleteOne(v)}
                    title="מחק הצבעה"
                  >
                    ✕
                  </button>
                </div>
                <div className="mv-voter-dates">
                  {v.dates.map(d => <span key={d} className="mv-voter-date">{d}</span>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
