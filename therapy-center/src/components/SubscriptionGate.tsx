import { PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { useAuth } from '../contexts/AuthContext';
import { adminApi } from '../api/client';

interface SubscriptionGateProps {
  children: React.ReactNode;
}

function daysLeft(isoDate: string | null): number {
  if (!isoDate) return 0;
  const diff = new Date(isoDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function isExpired(sub: { plan: string; status: string; trialEndDate: string | null; proEndDate: string | null } | null): boolean {
  if (!sub) return false;
  if (sub.plan === 'trial' && sub.status === 'active') {
    return daysLeft(sub.trialEndDate) === 0;
  }
  if (sub.plan === 'trial' && sub.status !== 'active') return true;
  if (sub.plan === 'pro' && sub.status !== 'active') return true;
  return false;
}

export function useTrialDaysLeft(): number {
  const { user } = useAuth();
  if (!user?.subscription || user.isSuperAdmin) return 999;
  if (user.subscription.plan !== 'trial') return 999;
  return daysLeft(user.subscription.trialEndDate);
}

export default function SubscriptionGate({ children }: SubscriptionGateProps) {
  const { user } = useAuth();

  if (!user || user.isSuperAdmin) return <>{children}</>;
  if (!user.subscription) return <>{children}</>;
  if (!isExpired(user.subscription)) return <>{children}</>;

  return <PaywallScreen />;
}

function PaywallScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'linear-gradient(150deg, #f0eeff 0%, #e8f0ff 60%, #f5f5ff 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, direction: 'rtl', padding: 20, overflowY: 'auto',
    }}>
      <div style={{
        background: 'white', borderRadius: 24, padding: '48px 40px',
        boxShadow: '0 8px 40px rgba(102,126,234,0.13)',
        maxWidth: 560, width: '100%', textAlign: 'center',
        margin: '20px 0',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
        <h2 style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 700, color: '#1a1a2e' }}>
          תקופת הניסיון הסתיימה
        </h2>
        <p style={{ margin: '0 0 32px', fontSize: 15, color: '#6b7280', lineHeight: 1.6 }}>
          7 ימי הניסיון החינמיים שלך הסתיימו.<br />
          בחר תוכנית כדי להמשיך להשתמש במערכת.
        </p>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 }}>
          <PricingCard title="חודשי" price="20" period="לחודש" billingCycle="monthly" />
          <PricingCard title="שנתי" price="200" period="לשנה" billingCycle="yearly" badge="חסכון 17%" highlight />
        </div>

        <a
          href="https://wa.me/972545567213"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 14, color: '#9ca3af', textDecoration: 'none' }}
        >
          💬 יש שאלות? צור קשר בוואטסאפ
        </a>
      </div>
    </div>
  );
}

function PricingCard({
  title, price, period, billingCycle, badge, highlight,
}: {
  title: string;
  price: string;
  period: string;
  billingCycle: 'monthly' | 'yearly';
  badge?: string;
  highlight?: boolean;
}) {
  return (
    <div style={{
      border: highlight ? '2px solid #667eea' : '2px solid #e2e8f0',
      borderRadius: 16, padding: '24px 24px 20px',
      minWidth: 210, flex: 1, maxWidth: 240,
      position: 'relative',
      background: highlight ? '#f5f3ff' : 'white',
    }}>
      {badge && (
        <div style={{
          position: 'absolute', top: -12, right: '50%', transform: 'translateX(50%)',
          background: '#667eea', color: 'white', fontSize: 11, fontWeight: 700,
          padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap',
        }}>
          {badge}
        </div>
      )}
      <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color: '#667eea', marginBottom: 2 }}>₪{price}</div>
      <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 20 }}>{period}</div>
      <PayPalSubscribeButton billingCycle={billingCycle} />
    </div>
  );
}

function PayPalSubscribeButton({ billingCycle }: { billingCycle: 'monthly' | 'yearly' }) {
  const [{ isPending }] = usePayPalScriptReducer();
  const { refreshUser } = useAuth();

  if (isPending) {
    return (
      <div style={{
        height: 44, borderRadius: 10, background: '#f3f4f6',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, color: '#9ca3af',
      }}>
        טוען...
      </div>
    );
  }

  return (
    <PayPalButtons
      style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'subscribe', height: 44 }}
      createSubscription={async (_data, _actions) => {
        // Get the plan ID from the server
        const res = await adminApi.createSubscription(billingCycle);
        if (!res.success || !res.data?.subscriptionId) {
          throw new Error(res.error || 'Failed to create subscription');
        }
        // PayPal expects us to use actions.subscription.create OR return an existing subscription ID
        // Since we created it server-side, return the ID
        return res.data.subscriptionId;
      }}
      onApprove={async (data) => {
        const subscriptionId = data.subscriptionID || '';
        const res = await adminApi.activateSubscription(subscriptionId);
        if (res.success) {
          await refreshUser();
          window.location.href = '/therapy/';
        }
      }}
      onError={(err) => {
        console.error('PayPal error:', err);
      }}
    />
  );
}
