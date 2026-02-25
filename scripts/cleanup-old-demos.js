const path = require('path');
const { getDb } = require(path.join(__dirname, '..', 'server', 'services', 'firebase'));
const readline = require('readline');

// Only targeting old demo and demo2 data — NOT demo3
const OLD_ADMIN_IDS = ['demo-admin', 'demo2-admin'];
const OLD_KID_IDS = ['demo-noa', 'demo-ori', 'demo2-noa', 'demo2-ori'];

async function findDocs(db, collection, field, values) {
  const docs = [];
  for (const val of values) {
    const snap = await db.collection(collection).where(field, '==', val).get();
    snap.docs.forEach(doc => docs.push({ id: doc.id, collection }));
  }
  return docs;
}

async function main() {
  const db = getDb();

  console.log('=== DRY RUN — Scanning for old demo/demo2 data ===\n');

  const toDelete = [];

  // Admin keys
  for (const adminId of OLD_ADMIN_IDS) {
    const snap = await db.collection('adminKeys').where('adminId', '==', adminId).get();
    snap.docs.forEach(doc => toDelete.push({ collection: 'adminKeys', id: doc.id, info: `adminId=${adminId}, key=${doc.data().key}` }));
  }

  // Practitioners
  for (const adminId of OLD_ADMIN_IDS) {
    const snap = await db.collection('practitioners').where('adminId', '==', adminId).get();
    snap.docs.forEach(doc => toDelete.push({ collection: 'practitioners', id: doc.id, info: `name=${doc.data().name}` }));
    // Also check the admin practitioner doc itself
    const adminDoc = await db.collection('practitioners').doc(adminId).get();
    if (adminDoc.exists) toDelete.push({ collection: 'practitioners', id: adminId, info: `admin doc, name=${adminDoc.data().name}` });
  }

  // Per-kid collections
  const collections = ['kidPractitioners', 'sessionForms', 'meetingForms', 'sessions', 'goals', 'parents', 'notifications'];
  for (const col of collections) {
    const docs = await findDocs(db, col, 'kidId', OLD_KID_IDS);
    docs.forEach(d => toDelete.push(d));
  }

  // Kid docs themselves
  for (const kidId of OLD_KID_IDS) {
    const doc = await db.collection('kids').doc(kidId).get();
    if (doc.exists) toDelete.push({ collection: 'kids', id: kidId, info: `name=${doc.data().name}` });
  }

  // Also find orphan forms/sessions with random UUIDs linked to old kid IDs
  // (from the first run that used uuidv4())
  // These are already covered by the kidId queries above

  if (toDelete.length === 0) {
    console.log('Nothing to delete! All clean.');
    process.exit(0);
  }

  // Print summary
  const byColl = {};
  toDelete.forEach(d => {
    if (!byColl[d.collection]) byColl[d.collection] = [];
    byColl[d.collection].push(d);
  });

  let total = 0;
  for (const [col, docs] of Object.entries(byColl)) {
    console.log(`${col}: ${docs.length} docs`);
    docs.forEach(d => {
      console.log(`  - ${d.id}${d.info ? ' (' + d.info + ')' : ''}`);
    });
    total += docs.length;
  }
  console.log(`\nTotal: ${total} documents to delete\n`);

  // Ask for confirmation
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise(resolve => {
    rl.question('Type "DELETE" to proceed, anything else to cancel: ', resolve);
  });
  rl.close();

  if (answer !== 'DELETE') {
    console.log('Cancelled.');
    process.exit(0);
  }

  // Actually delete
  console.log('\nDeleting...');
  for (const d of toDelete) {
    await db.collection(d.collection).doc(d.id).delete();
  }
  console.log(`✅ Deleted ${total} documents.`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
