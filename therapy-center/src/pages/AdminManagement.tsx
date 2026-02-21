import { useState } from 'react';
import { adminApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

export default function AdminManagement() {
  const { user } = useAuth();

  // Create admin
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminMobile, setNewAdminMobile] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminKey, setNewAdminKey] = useState('');
  const [newAdminKeyConfirm, setNewAdminKeyConfirm] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [createAdminError, setCreateAdminError] = useState('');
  const [createAdminLoading, setCreateAdminLoading] = useState(false);

  // Admin list
  const [adminList, setAdminList] = useState<{ docId: string; adminId: string; name: string; key: string; mobile: string; email: string }[]>([]);
  const [adminListLoading, setAdminListLoading] = useState(false);
  const [adminListLoaded, setAdminListLoaded] = useState(false);

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!newAdminName.trim() || !newAdminKey.trim()) return;
    if (newAdminKey !== newAdminKeyConfirm) {
      setCreateAdminError('מפתחות הגישה אינם תואמים');
      return;
    }
    if (newAdminKey.trim().length < 4) {
      setCreateAdminError('מפתח גישה חייב להכיל לפחות 4 תווים');
      return;
    }
    setCreateAdminLoading(true);
    setCreateAdminError('');
    const res = await adminApi.createKey({
      name: newAdminName.trim(),
      key: newAdminKey.trim(),
      mobile: newAdminMobile.trim(),
      email: newAdminEmail.trim(),
    });
    setCreateAdminLoading(false);
    if (res.success && res.data) {
      setCreatedKey(res.data.key);
      setNewAdminName(''); setNewAdminMobile(''); setNewAdminEmail('');
      setNewAdminKey(''); setNewAdminKeyConfirm('');
      loadAdminList();
    } else {
      setCreateAdminError(res.error || 'שגיאה ביצירת מנהל');
    }
  }

  async function loadAdminList() {
    setAdminListLoading(true);
    const res = await adminApi.listAdmins();
    setAdminListLoading(false);
    if (res.success && res.data) {
      setAdminList(res.data);
      setAdminListLoaded(true);
    }
  }

  async function handleDeleteAdmin(adminId: string, name: string) {
    if (!confirm(`למחוק את ${name}?`)) return;
    const res = await adminApi.deleteAdmin(adminId);
    if (res.success) {
      setAdminList(prev => prev.filter(a => a.adminId !== adminId));
    }
  }

  // Load on first render
  if (!adminListLoaded && !adminListLoading) {
    loadAdminList();
  }

  if (!user?.isSuperAdmin) {
    return (
      <div className="container">
        <div className="content-card">
          <div className="empty-state">
            <p>אין הרשאה לצפות בדף זה</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="content-card">
        <div className="content-card-header">
          <h2>מנהלי מרכזים</h2>
          <button
            onClick={() => { setShowCreateAdmin(true); setCreatedKey(null); setCreateAdminError(''); setNewAdminName(''); setNewAdminMobile(''); setNewAdminEmail(''); setNewAdminKey(''); setNewAdminKeyConfirm(''); }}
            className="btn-primary btn-small"
          >
            + מנהל חדש
          </button>
        </div>

        {/* Admin list */}
        <div style={{ direction: 'rtl' }}>
          {adminListLoading ? (
            <p style={{ color: '#9ca3af', fontSize: 14 }}>טוען...</p>
          ) : adminList.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 14 }}>אין מנהלים עדיין</p>
          ) : (
            <div className="admin-list">
              {adminList.map(a => (
                <div key={a.adminId} className="admin-card">
                  <div className="admin-card-info">
                    <div className="admin-card-name">{a.name}</div>
                    {a.mobile && <div className="admin-card-detail">{a.mobile}</div>}
                    {a.email && <div className="admin-card-detail">{a.email}</div>}
                    <code className="admin-card-key">{a.key}</code>
                  </div>
                  <button
                    onClick={() => handleDeleteAdmin(a.adminId, a.name)}
                    style={{ background: 'none', border: '1px solid #fca5a5', color: '#ef4444', borderRadius: 8, padding: '5px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0 }}
                  >
                    מחק
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create admin modal */}
      {showCreateAdmin && (
        <div className="modal-overlay" onClick={() => setShowCreateAdmin(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ direction: 'rtl' }}>
            {!createdKey ? (
              <>
                <h3 style={{ margin: '0 0 18px', fontSize: 17 }}>הוספת מנהל מרכז חדש</h3>
                <form onSubmit={handleCreateAdmin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>שם המנהל / המרכז *</label>
                    <input
                      placeholder="שם"
                      value={newAdminName}
                      onChange={e => setNewAdminName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>טלפון נייד</label>
                    <input
                      placeholder="05X-XXXXXXX"
                      value={newAdminMobile}
                      onChange={e => setNewAdminMobile(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>אימייל</label>
                    <input
                      type="email"
                      placeholder="example@email.com"
                      value={newAdminEmail}
                      onChange={e => setNewAdminEmail(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>מפתח גישה *</label>
                    <input
                      type="password"
                      placeholder="לפחות 4 תווים"
                      value={newAdminKey}
                      onChange={e => setNewAdminKey(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>אימות מפתח גישה *</label>
                    <input
                      type="password"
                      placeholder="הכנס שוב"
                      value={newAdminKeyConfirm}
                      onChange={e => setNewAdminKeyConfirm(e.target.value)}
                      required
                    />
                  </div>
                  {createAdminError && <p style={{ color: '#e53935', margin: 0, fontSize: 13 }}>{createAdminError}</p>}
                  <div className="modal-actions">
                    <button type="button" onClick={() => setShowCreateAdmin(false)} className="btn-secondary">ביטול</button>
                    <button type="submit" className="btn-primary" disabled={createAdminLoading || !newAdminName.trim() || !newAdminKey.trim()}>
                      {createAdminLoading ? 'יוצר...' : 'צור מנהל'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <h3 style={{ margin: '0 0 8px', color: '#15803d' }}>מנהל נוצר בהצלחה!</h3>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>שלח את המפתח הזה למנהל המרכז:</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, direction: 'ltr', marginBottom: 16 }}>
                  <code style={{ fontSize: 24, fontWeight: 700, letterSpacing: 4, color: '#1e3a8a', background: '#dbeafe', padding: '8px 16px', borderRadius: 10 }}>
                    {createdKey}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(createdKey)}
                    style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #93c5fd', background: 'white', cursor: 'pointer', fontSize: 13 }}
                  >
                    העתק
                  </button>
                </div>
                <button
                  onClick={() => { setCreatedKey(null); setShowCreateAdmin(false); }}
                  className="btn-primary"
                >
                  סגור
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
