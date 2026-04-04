const { getDb } = require('./services/firebase');

async function run() {
  const db = getDb();

  // Check if there's a session linked to the March 1 form
  const sessions = await db.collection('sessions').where('formId', '==', 'ae59fbca-e42c-4535-8a69-860e2ffd25c8').get();
  if (sessions.empty) {
    console.log('No session linked to form ae59fbca');
  } else {
    sessions.docs.forEach(d => {
      const s = d.data();
      console.log('Session', d.id, '| therapistId:', s.therapistId, '| kidId:', s.kidId);
    });
  }

  // All orphan IDs from the diagnostic
  const orphans = [
    '019c6d7d-55b4-4c40-91c5-fab06c6b2128',
    '2813aaf5-687c-4016-9c1b-590e8039f3bd',
    'eb8d9175-f1ff-487f-98ab-ae59be9f95f2',
    '555329f2-b2cc-4999-97f2-88c6aab95502',
    '5043e5aa-9718-4534-a1b8-e9fa908cf0dd',
    '2b176c83-3066-4528-b677-649ebdeff70a',
    '4b833b01-dd99-458c-a908-65899958b86c',
    'c5fb092d-2d76-4e87-a2c0-6b2ea8f32cda',
  ];

  // Check if these IDs exist in kidPractitioners (maybe they were assigned but practitioner doc deleted)
  console.log('\nChecking kidPractitioners for orphan IDs...');
  for (const oid of orphans) {
    const kp = await db.collection('kidPractitioners').where('practitionerId', '==', oid).get();
    if (!kp.empty) {
      console.log('  Found in kidPractitioners:', oid);
      kp.docs.forEach(d => console.log('   ', JSON.stringify(d.data())));
    }
  }

  // For each orphan, check the session record to see if therapistId there resolves
  console.log('\nChecking sessions linked to orphan forms...');
  const allForms = await db.collection('sessionForms').get();
  const orphanForms = allForms.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(f => orphans.includes(f.practitionerId));

  for (const f of orphanForms) {
    const dt = f.sessionDate?.seconds ? new Date(f.sessionDate.seconds * 1000) : new Date(f.sessionDate);
    const sessSnap = await db.collection('sessions').where('formId', '==', f.id).get();
    let sessionInfo = 'no linked session';
    if (!sessSnap.empty) {
      const s = sessSnap.docs[0].data();
      sessionInfo = `session therapistId: ${s.therapistId}`;
      if (s.therapistId) {
        const pDoc = await db.collection('practitioners').doc(s.therapistId).get();
        sessionInfo += pDoc.exists ? ` (${pDoc.data().name})` : ' (NOT FOUND)';
      }
    }
    console.log(`  Form ${f.id} | ${dt.toISOString().slice(0,10)} | kid: ${f.kidId} | orphan practId: ${f.practitionerId} | ${sessionInfo}`);
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
