import { PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { useAuth } from '../contexts/AuthContext';
import { adminApi } from '../api/client';
import Icon from '../v2/Icon';
import '../v2/pages/dr-admin.css';

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
    <div className="dr-pay-page" dir="rtl">
      <div className="dr-pay-card nb-card nb-tape">
        <span className="dr-status-ico tone-yellow" aria-hidden><Icon name="clock" size={36} /></span>
        <h2 className="dr-status-title">תקופת הניסיון <mark className="hl-yellow">הסתיימה</mark></h2>
        <p className="dr-status-text">
          7 ימי הניסיון החינמיים שלך הסתיימו.<br />
          בחר תוכנית כדי להמשיך להשתמש במערכת.
        </p>

        <div className="dr-pay-plans">
          <PricingCard title="חודשי" price="20" period="לחודש" billingCycle="monthly" />
          <PricingCard title="שנתי" price="200" period="לשנה" billingCycle="yearly" badge="חסכון 17%" highlight />
        </div>

        <a
          href="https://wa.me/972545567213"
          target="_blank"
          rel="noopener noreferrer"
          className="dr-pay-help"
        >
          <Icon name="chat" size={18} /> יש שאלות? צור קשר בוואטסאפ
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
    <div className={`dr-plan${highlight ? ' is-highlight' : ''}`}>
      {badge && <span className="nb-sticker tone-mint dr-plan-badge">{badge}</span>}
      <div className="dr-plan-title">{title}</div>
      <div className="dr-plan-price tabular">₪{price}</div>
      <div className="dr-plan-period">{period}</div>
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
