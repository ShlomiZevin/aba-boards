import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { useAuth } from '../contexts/AuthContext';
import { sessionsApi, adminApi } from '../api/client';
import NbNav, { type NavItem, type QuickAction } from '../v2/NbNav';
import Icon from '../v2/Icon';
import { useTrialDaysLeft } from './SubscriptionGate';


interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const { user, logout } = useAuth();
  const trialDays = useTrialDaysLeft();
  const navigate = useNavigate();


  // Change key state
  const [showChangeKey, setShowChangeKey] = useState(false);
  const [changeKeyNew, setChangeKeyNew] = useState('');
  const [changeKeyConfirm, setChangeKeyConfirm] = useState('');
  const [changeKeyError, setChangeKeyError] = useState('');
  const [changeKeyLoading, setChangeKeyLoading] = useState(false);

  // Upgrade / cancel state
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const { updateSubscription } = useAuth();

  async function handleCancelSubscription() {
    setCancelLoading(true);
    const res = await adminApi.cancelSubscription();
    setCancelLoading(false);
    if (res.success) {
      updateSubscription({ ...user!.subscription!, status: 'cancelled' });
      setShowCancelConfirm(false);
    }
  }

  // Profile edit state
  const [showProfile, setShowProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileMobile, setProfileMobile] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const { updateUserProfile } = useAuth();

  const { data: alertsResponse } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => sessionsApi.getAlerts(),
  });
  const alertCount = alertsResponse?.data?.length || 0;

  function openProfile() {
    setProfileName(user?.name || '');
    setProfileMobile(user?.mobile || '');
    setProfileEmail(user?.email || '');
    setProfileError('');
    setShowProfile(true);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profileName.trim()) { setProfileError('שם הוא שדה חובה'); return; }
    setProfileLoading(true);
    setProfileError('');
    const res = await adminApi.updateProfile({ name: profileName.trim(), mobile: profileMobile.trim(), email: profileEmail.trim() });
    setProfileLoading(false);
    if (res.success) {
      updateUserProfile(profileName.trim(), profileMobile.trim(), profileEmail.trim());
      setShowProfile(false);
    } else {
      setProfileError(res.error || 'שגיאה בשמירה');
    }
  }

  async function handleChangeKey(e: React.FormEvent) {
    e.preventDefault();
    if (changeKeyNew !== changeKeyConfirm) {
      setChangeKeyError('מפתחות הגישה אינם תואמים');
      return;
    }
    if (changeKeyNew.trim().length < 4) {
      setChangeKeyError('מפתח גישה חייב להכיל לפחות 4 תווים');
      return;
    }
    setChangeKeyLoading(true);
    setChangeKeyError('');
    const res = await adminApi.changeKey(changeKeyNew.trim());
    setChangeKeyLoading(false);
    if (res.success) {
      logout();
      navigate('/login');
    } else {
      setChangeKeyError(res.error || 'שגיאה בשינוי המפתח');
    }
  }

  const primary: NavItem[] = [
    { path: '/', label: 'היום', icon: 'today', exact: true },
    { path: '/kids', label: 'ילדים', icon: 'kids', badge: alertCount || undefined },
    { path: '/calendar', label: 'יומן', icon: 'calendar' },
    { path: '/notifications', label: 'הודעות', icon: 'bell' },
  ];
  const more: NavItem[] = [
    { path: '/forms', label: 'טפסים', icon: 'form' },
    { path: '/chat', label: 'צ׳אט AI', icon: 'sparkle' },
    { path: '/practitioners', label: 'אנשי צוות', icon: 'team' },
    { path: '/crew-hours', label: 'שעות צוות', icon: 'clock' },
    { path: '/knowledge', label: 'מרכז הידע', icon: 'book' },
    { path: '/models', label: 'מודלים לבנייה', icon: 'blocks' },
    ...(user?.isSuperAdmin ? [
      { path: '/goal-library', label: 'ספריית מטרות', icon: 'target' as const },
      { path: '/admin-management', label: 'מנהלי מרכזים', icon: 'settings' as const },
      { path: '/super-admin', label: 'סקירת אדמין', icon: 'search' as const },
      { path: '/mcp-connect', label: 'חיבור לעוזרי AI', icon: 'link' as const },
    ] : []),
    { path: '/install-app', label: 'התקנת אפליקציה', icon: 'phone' },
  ];
  const quick: QuickAction[] = [
    { key: 'form', label: 'טופס טיפול', hint: 'מילוי אחרי מפגש', icon: 'form', tone: 'yellow', needsKid: true, to: id => `/form/new?kidId=${id}` },
    { key: 'meet', label: 'פגישה חדשה', hint: 'תזמון ביומן', icon: 'calendar', tone: 'sky', needsKid: false, to: () => '/calendar?new=1' },
    { key: 'daily', label: 'דיווח יומי', hint: 'טוב · בסדר · קשה', icon: 'report', tone: 'mint', needsKid: true, to: id => `/kid/${id}/daily-reports` },
    { key: 'msg', label: 'הודעה', hint: 'לצוות או להורים', icon: 'chat', tone: 'pink', needsKid: false, to: () => '/notifications' },
  ];

  const footer = (
    <>
      {!user?.isSuperAdmin && user?.subscription?.plan === 'trial' && trialDays > 0 && (
        <div className="nb-plan"><b>ניסיון · {trialDays} ימים</b><button type="button" onClick={() => setShowUpgrade(true)}>שדרוג לפרו</button></div>
      )}
      {!user?.isSuperAdmin && user?.subscription?.plan === 'pro' && user.subscription.status === 'active' && (
        <div className="nb-plan pro"><b>✓ פרו פעיל</b><button type="button" onClick={() => setShowCancelConfirm(true)} style={{ color: 'var(--muted)', fontWeight: 400 }}>ביטול מנוי</button></div>
      )}
      <button type="button" className="nb-foot-btn" onClick={() => { setShowChangeKey(true); setChangeKeyError(''); setChangeKeyNew(''); setChangeKeyConfirm(''); }}>
        <Icon name="key" /> שינוי מפתח גישה
      </button>
      <button type="button" className="nb-foot-btn danger" onClick={() => { logout(); navigate('/login'); }}>
        <Icon name="logout" /> יציאה
      </button>
    </>
  );

  return (
    <>
      <NbNav
        prefix=""
        primary={primary}
        more={more}
        quick={quick}
        userName={user?.name || ''}
        userRole={user?.isSuperAdmin ? 'מנהלת מערכת' : 'מנהלת מרכז'}
        onUserClick={openProfile}
        footer={footer}
      >
        {children}
      </NbNav>

      {/* Upgrade overlay (trial → pro) */}
      {showUpgrade && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowUpgrade(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 24, padding: '40px 32px', maxWidth: 500, width: '90%', direction: 'rtl', textAlign: 'center', position: 'relative' }}>
            <button onClick={() => setShowUpgrade(false)} style={{ position: 'absolute', top: 16, left: 16, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⭐</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>שדרג לפרו</h2>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280' }}>גישה מלאה ללא הגבלה</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <UpgradeCard title="חודשי" price="20" period="לחודש" billingCycle="monthly" onSuccess={() => setShowUpgrade(false)} />
              <UpgradeCard title="שנתי" price="200" period="לשנה" billingCycle="yearly" badge="חסכון 17%" onSuccess={() => setShowUpgrade(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Cancel subscription confirmation */}
      {showCancelConfirm && (
        <div className="modal-overlay" onClick={() => setShowCancelConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ direction: 'rtl' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 17 }}>ביטול מנוי</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280' }}>האם אתה בטוח? הגישה תישמר עד סוף תקופת החיוב הנוכחית.</p>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowCancelConfirm(false)} className="btn-secondary">ביטול</button>
              <button
                type="button"
                onClick={handleCancelSubscription}
                disabled={cancelLoading}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#ef4444', color: 'white', fontSize: 14, fontWeight: 600, cursor: cancelLoading ? 'not-allowed' : 'pointer', opacity: cancelLoading ? 0.6 : 1 }}
              >
                {cancelLoading ? 'מבטל...' : 'כן, בטל מנוי'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile edit modal */}
      {showProfile && (
        <div className="modal-overlay" onClick={() => setShowProfile(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ direction: 'rtl' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 17 }}>עריכת פרופיל</h3>
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text"
                placeholder="שם"
                value={profileName}
                onChange={e => setProfileName(e.target.value)}
                autoFocus
                required
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 15 }}
              />
              <input
                type="tel"
                placeholder="טלפון"
                value={profileMobile}
                onChange={e => setProfileMobile(e.target.value)}
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 15 }}
              />
              <input
                type="email"
                placeholder="אימייל"
                value={profileEmail}
                onChange={e => setProfileEmail(e.target.value)}
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 15 }}
              />
              {profileError && <p style={{ color: '#e53935', margin: 0, fontSize: 13 }}>{profileError}</p>}
              <div className="modal-actions">
                <button type="button" onClick={() => setShowProfile(false)} className="btn-secondary">ביטול</button>
                <button type="submit" className="btn-primary" disabled={profileLoading || !profileName}>
                  {profileLoading ? 'שומר...' : 'שמור'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change passkey modal */}
      {showChangeKey && (
        <div className="modal-overlay" onClick={() => setShowChangeKey(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ direction: 'rtl' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 17 }}>שינוי מפתח גישה</h3>
            <form onSubmit={handleChangeKey} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="password"
                placeholder="מפתח גישה חדש (לפחות 4 תווים)"
                value={changeKeyNew}
                onChange={e => setChangeKeyNew(e.target.value)}
                autoFocus
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 15 }}
              />
              <input
                type="password"
                placeholder="אימות מפתח גישה"
                value={changeKeyConfirm}
                onChange={e => setChangeKeyConfirm(e.target.value)}
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 15 }}
              />
              {changeKeyError && <p style={{ color: '#e53935', margin: 0, fontSize: 13 }}>{changeKeyError}</p>}
              <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>לאחר השמירה תצא מהמערכת ותצטרך להתחבר עם המפתח החדש</p>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowChangeKey(false)} className="btn-secondary">ביטול</button>
                <button type="submit" className="btn-primary" disabled={changeKeyLoading || !changeKeyNew || !changeKeyConfirm}>
                  {changeKeyLoading ? 'שומר...' : 'שמור מפתח'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function UpgradeCard({ title, price, period, billingCycle, badge, onSuccess }: {
  title: string; price: string; period: string;
  billingCycle: 'monthly' | 'yearly'; badge?: string; onSuccess: () => void;
}) {
  const [{ isPending }] = usePayPalScriptReducer();
  const { refreshUser } = useAuth();

  return (
    <div style={{
      border: billingCycle === 'yearly' ? '2px solid #667eea' : '2px solid #e2e8f0',
      borderRadius: 14, padding: '20px 20px 16px', minWidth: 180, flex: 1,
      background: billingCycle === 'yearly' ? '#f5f3ff' : 'white', position: 'relative',
    }}>
      {badge && (
        <div style={{ position: 'absolute', top: -11, right: '50%', transform: 'translateX(50%)', background: '#667eea', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>{badge}</div>
      )}
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#667eea', marginBottom: 2 }}>₪{price}</div>
      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14 }}>{period}</div>
      {isPending ? (
        <div style={{ height: 40, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#9ca3af' }}>טוען...</div>
      ) : (
        <PayPalButtons
          style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'subscribe', height: 40 }}
          createSubscription={async (_data, _actions) => {
            const res = await adminApi.createSubscription(billingCycle);
            if (!res.success || !res.data?.subscriptionId) throw new Error(res.error || 'Failed');
            return res.data.subscriptionId;
          }}
          onApprove={async (data) => {
            const res = await adminApi.activateSubscription(data.subscriptionID || '');
            if (res.success) { await refreshUser(); onSuccess(); }
          }}
        />
      )}
    </div>
  );
}
