// Upgrade the "מרכז טיפולי לדוגמה" admin (adminId 'demo3-admin') to a
// no-limit Pro subscription. Idempotent — re-running just refreshes the
// expiry date.
//
// Run: node scripts/upgrade-demo-to-pro.js

const path = require('path');
const { getDb } = require(path.join(__dirname, '..', 'server', 'services', 'firebase'));

const ADMIN_ID = 'demo3-admin';
// Far-future expiry — 100 years out. Effectively no limit.
const FAR_FUTURE = new Date('2126-01-01T00:00:00Z');

async function main() {
  const db = getDb();

  // 1. Sanity-check the admin exists
  const keySnap = await db.collection('adminKeys').where('adminId', '==', ADMIN_ID).limit(1).get();
  if (keySnap.empty) {
    console.error(`No adminKeys doc found for adminId="${ADMIN_ID}". Seed the demo first.`);
    process.exit(1);
  }
  const adminKey = keySnap.docs[0].data();
  console.log(`Found admin: "${adminKey.name}" (key: ${adminKey.key}, adminId: ${ADMIN_ID})`);

  // 2. Find or create the subscription doc for this admin
  const subSnap = await db.collection('subscriptions').where('adminId', '==', ADMIN_ID).limit(1).get();
  const now = new Date();
  const proPayload = {
    adminId: ADMIN_ID,
    plan: 'pro',
    status: 'active',
    proStartDate: now,
    proEndDate: FAR_FUTURE,
    billingCycle: 'manual',     // not driven by PayPal
    paypalSubscriptionId: null,
    nextPaymentDate: FAR_FUTURE,
    updatedAt: now,
  };

  if (subSnap.empty) {
    proPayload.createdAt = now;
    const ref = await db.collection('subscriptions').add(proPayload);
    console.log(`Created new pro subscription: ${ref.id}`);
  } else {
    const ref = subSnap.docs[0].ref;
    await ref.set(proPayload, { merge: true });
    console.log(`Updated existing subscription ${ref.id} → pro until ${FAR_FUTURE.toISOString()}`);
  }

  console.log('\nDone. "מרכז טיפולי לדוגמה" is now Pro with no expiry.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
