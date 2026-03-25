const express = require('express');
const router = express.Router();
const publicRouter = express.Router(); // for webhook (no admin auth)
const { getDb } = require('../services/firebase');
const { invalidateSubCache } = require('../middleware/subscription');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_MONTHLY_PLAN_ID = process.env.PAYPAL_MONTHLY_PLAN_ID;
const PAYPAL_YEARLY_PLAN_ID = process.env.PAYPAL_YEARLY_PLAN_ID;
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;

const PAYPAL_API_BASE = PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

// --- PayPal API helpers ---

async function getPayPalToken() {
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  return data.access_token;
}

async function paypalRequest(method, path, body) {
  const token = await getPayPalToken();
  const res = await fetch(`${PAYPAL_API_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

function subscriptionToResponse(sub) {
  return {
    plan: sub.plan,
    status: sub.status,
    trialEndDate: sub.trialEndDate?.toDate?.()?.toISOString() || null,
    proEndDate: sub.proEndDate?.toDate?.()?.toISOString() || null,
    billingCycle: sub.billingCycle || null,
    nextPaymentDate: sub.nextPaymentDate?.toDate?.()?.toISOString() || null,
    paypalSubscriptionId: sub.paypalSubscriptionId || null,
  };
}

// --- Protected routes ---

// POST /api/admin/subscription/create
router.post('/create', asyncHandler(async (req, res) => {
  if (!PAYPAL_CLIENT_ID) return res.status(500).json({ error: 'PayPal not configured' });

  const { billingCycle } = req.body;
  if (!['monthly', 'yearly'].includes(billingCycle)) {
    return res.status(400).json({ error: 'Invalid billing cycle' });
  }

  const planId = billingCycle === 'monthly' ? PAYPAL_MONTHLY_PLAN_ID : PAYPAL_YEARLY_PLAN_ID;
  if (!planId) return res.status(500).json({ error: 'PayPal plan not configured' });

  const appBaseUrl = process.env.APP_BASE_URL || 'https://startdoing.co.il';

  const subscription = await paypalRequest('POST', '/v1/billing/subscriptions', {
    plan_id: planId,
    application_context: {
      return_url: `${appBaseUrl}/therapy/subscription/success`,
      cancel_url: `${appBaseUrl}/therapy/subscription/cancel`,
      brand_name: 'Doing',
      locale: 'he-IL',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'SUBSCRIBE_NOW',
    },
  });

  const approvalUrl = subscription.links?.find(l => l.rel === 'approve')?.href;
  if (!approvalUrl) {
    console.error('PayPal subscription create error:', subscription);
    return res.status(500).json({ error: 'Failed to create PayPal subscription' });
  }

  res.json({ approvalUrl, subscriptionId: subscription.id });
}));

// POST /api/admin/subscription/activate
router.post('/activate', asyncHandler(async (req, res) => {
  const { subscriptionId } = req.body;
  if (!subscriptionId) return res.status(400).json({ error: 'Missing subscriptionId' });

  // Verify with PayPal
  const ppSub = await paypalRequest('GET', `/v1/billing/subscriptions/${subscriptionId}`);
  if (!ppSub || ppSub.status !== 'ACTIVE') {
    return res.status(400).json({ error: 'Subscription not active in PayPal' });
  }

  const db = getDb();
  const now = new Date();
  const billingCycle = ppSub.plan_id === PAYPAL_YEARLY_PLAN_ID ? 'yearly' : 'monthly';
  const priceILS = billingCycle === 'yearly' ? 200 : 20;

  // Calculate proEndDate from PayPal next billing time
  const proEndDate = ppSub.billing_info?.next_billing_time
    ? new Date(ppSub.billing_info.next_billing_time)
    : new Date(now.getTime() + (billingCycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000);

  const subSnap = await db.collection('subscriptions')
    .where('adminId', '==', req.adminId)
    .limit(1)
    .get();

  const updateData = {
    plan: 'pro',
    status: 'active',
    proStartDate: now,
    proEndDate,
    billingCycle,
    priceILS,
    paypalSubscriptionId: subscriptionId,
    paypalPayerId: ppSub.subscriber?.payer_id || null,
    lastPaymentDate: now,
    nextPaymentDate: proEndDate,
    updatedAt: now,
  };

  if (subSnap.empty) {
    await db.collection('subscriptions').add({ adminId: req.adminId, ...updateData, createdAt: now });
  } else {
    await subSnap.docs[0].ref.update(updateData);
  }

  invalidateSubCache(req.adminId);
  res.json({ success: true });
}));

// POST /api/admin/subscription/cancel
router.post('/cancel', asyncHandler(async (req, res) => {
  const db = getDb();
  const subSnap = await db.collection('subscriptions')
    .where('adminId', '==', req.adminId)
    .limit(1)
    .get();

  if (subSnap.empty) return res.status(404).json({ error: 'No subscription found' });

  const sub = subSnap.docs[0].data();
  if (!sub.paypalSubscriptionId) return res.status(400).json({ error: 'No PayPal subscription to cancel' });

  // Cancel in PayPal
  await paypalRequest('POST', `/v1/billing/subscriptions/${sub.paypalSubscriptionId}/cancel`, {
    reason: 'User requested cancellation',
  });

  await subSnap.docs[0].ref.update({ status: 'cancelled', updatedAt: new Date() });
  invalidateSubCache(req.adminId);

  res.json({ success: true });
}));

// --- Public: PayPal webhook ---

publicRouter.post('/paypal', asyncHandler(async (req, res) => {
  // Acknowledge immediately
  res.status(200).send('OK');

  const event = req.body;
  const eventType = event.event_type;
  const resource = event.resource;

  // Find admin by paypalSubscriptionId
  const subscriptionId = resource?.id || resource?.billing_agreement_id;
  if (!subscriptionId) return;

  const db = getDb();
  const subSnap = await db.collection('subscriptions')
    .where('paypalSubscriptionId', '==', subscriptionId)
    .limit(1)
    .get();

  if (subSnap.empty) {
    console.warn(`Webhook: no subscription found for PayPal ID ${subscriptionId}`);
    return;
  }

  const subRef = subSnap.docs[0].ref;
  const subData = subSnap.docs[0].data();
  const now = new Date();

  try {
    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await subRef.update({ plan: 'pro', status: 'active', updatedAt: now });
        break;

      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await subRef.update({ status: 'cancelled', updatedAt: now });
        break;

      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await subRef.update({ status: 'expired', updatedAt: now });
        break;

      case 'PAYMENT.SALE.COMPLETED': {
        const billingCycle = subData.billingCycle || 'monthly';
        const nextPayment = new Date(now.getTime() + (billingCycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000);
        await subRef.update({
          lastPaymentDate: now,
          nextPaymentDate: nextPayment,
          proEndDate: nextPayment,
          status: 'active',
          updatedAt: now,
        });
        break;
      }

      default:
        console.log(`Unhandled PayPal webhook: ${eventType}`);
    }
    invalidateSubCache(subData.adminId);
  } catch (err) {
    console.error('Webhook processing error:', err);
  }
}));

module.exports = { router, publicRouter };
