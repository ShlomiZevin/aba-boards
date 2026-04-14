const { getDb } = require('./services/firebase');

(async () => {
  const db = getDb();

  // Find הילור kid
  const kidsSnap = await db.collection('kids').get();
  const hilor = kidsSnap.docs.find(d => d.data().name && d.data().name.includes('הילור'));
  if (!hilor) { console.log('Kid not found'); return; }
  const kidId = hilor.id;
  console.log('Kid:', kidId, hilor.data().name);

  // Get recent session forms for this kid
  const formsSnap = await db.collection('sessionForms').where('kidId', '==', kidId).get();
  console.log('\n=== Recent Session Forms ===');
  formsSnap.docs.forEach(d => {
    const f = d.data();
    console.log('Form:', d.id);
    console.log('  practitionerId:', f.practitionerId);
    console.log('  sessionDate:', f.sessionDate);
    console.log('  goalsWorkedOn:', JSON.stringify((f.goalsWorkedOn || []).map(g => ({ goalId: g.goalId, goalTitle: g.goalTitle }))));
    console.log('  createdAt:', f.createdAt);
  });

  // Get recent meeting forms
  const meetingSnap = await db.collection('meetingForms').where('kidId', '==', kidId).get();
  console.log('\n=== Recent Meeting Forms ===');
  meetingSnap.docs.forEach(d => {
    const f = d.data();
    console.log('Meeting:', d.id);
    console.log('  goalsWorkedOn:', JSON.stringify((f.goalsWorkedOn || []).map(g => ({ goalId: g.goalId, goalTitle: g.goalTitle }))));
    console.log('  dcPractitionerId:', f.dcPractitionerId);
    console.log('  createdAt:', f.createdAt);
  });

  // Get DC entries
  const dcSnap = await db.collection('kidGoalDataEntries').where('kidId', '==', kidId).get();
  console.log('\n=== DC Entries ===');
  dcSnap.docs.forEach(d => {
    const e = d.data();
    console.log('DC:', d.id);
    console.log('  goalTitle:', e.goalTitle);
    console.log('  practitionerId:', e.practitionerId);
    console.log('  status:', e.status);
    console.log('  sessionFormId:', e.sessionFormId || 'NONE');
    console.log('  meetingFormId:', e.meetingFormId || 'NONE');
    console.log('  sessionDate:', e.sessionDate);
    console.log('  createdAt:', e.createdAt);
  });

  // Get goals for this kid to check DC templates
  const goalsSnap = await db.collection('goals')
    .where('kidId', '==', kidId).get();
  // Focus on the most recent form's goals
  const recentFormId = '3a173767-adb9-4a7c-8102-98e1e875eb41';
  const recentFormGoalIds = ['36ee4472-eb1b-41b3-8000-8e4935fbf100','1359886e-ed47-4bf8-9070-6b40ae455500','6ee062ef-41fe-4a69-b673-9f68dc7c4593','98f9f08f-c7a2-4c00-a625-dd366e2a63d7','8e7f4176-9b82-42ea-986c-e302424f0dac','3ab8687d-6663-4cdb-aba3-7135f092e185','47ba0618-7b29-443d-ba10-2d4fe59cb55b','2e244418-9f1e-4b9a-bd24-d1cce0f7c6fc','3e843020-6604-41d8-b5da-b6af473d5fb1','773c429c-68f2-46c9-8101-93879db6ab82'];

  console.log('\n=== Goals from recent form (שי) ===');
  for (const goalId of recentFormGoalIds) {
    const goalDoc = goalsSnap.docs.find(d => d.id === goalId);
    if (!goalDoc) {
      console.log('Goal:', goalId, '-> NOT FOUND in goals collection');
      continue;
    }
    const g = goalDoc.data();
    const dcTemplate = g.dataCollectionTemplate;
    console.log('Goal:', goalId);
    console.log('  title:', g.title);
    console.log('  libraryItemId:', g.libraryItemId);
    console.log('  dcTemplate type:', typeof dcTemplate, Array.isArray(dcTemplate) ? 'array' : '');
    console.log('  dcTemplate:', JSON.stringify(dcTemplate)?.substring(0, 200));
  }

  // Check DC entries linked to this form
  console.log('\n=== DC Entries for form', recentFormId, '===');
  const dcForForm = dcSnap.docs.filter(d => d.data().sessionFormId === recentFormId);
  console.log('Count:', dcForForm.length);
  dcForForm.forEach(d => {
    const e = d.data();
    console.log('  DC:', d.id, '- goal:', e.goalTitle, '- status:', e.status, '- practitioner:', e.practitionerId);
  });

  // Check library items for these goals
  const libIds = recentFormGoalIds.map(gid => {
    const doc = goalsSnap.docs.find(d => d.id === gid);
    return doc ? doc.data().libraryItemId : null;
  }).filter(Boolean);

  console.log('\n=== Library Items for form goals ===');
  for (const libId of libIds) {
    const libDoc = await db.collection('goalsLibrary').doc(libId).get();
    if (!libDoc.exists) {
      console.log('Library:', libId, '-> NOT FOUND');
      continue;
    }
    const lib = libDoc.data();
    const dcTemplate = lib.dataCollectionTemplate;
    const hasTemplate = dcTemplate && (
      Array.isArray(dcTemplate) ? dcTemplate.length > 0 :
      dcTemplate.tables && dcTemplate.tables.length > 0
    );
    console.log('Library:', libId, '- title:', lib.title, '- hasDcTemplate:', hasTemplate);
  }

  // Compare: check a goal that DID create DC entries (from older form)
  console.log('\n=== Compare: goals from older form beb7839e that DID create DC entries ===');
  const olderFormGoalIds = ['1b2f5221-8cf9-45dc-bc0f-265b3d51d060','61e58759-0073-490e-af3a-06221cd6a125','7e601212-7c91-4525-9f6d-b344f1c46f83','a504045d-dd4f-4bef-8c1c-69cd1b824bcb','3ab8687d-6663-4cdb-aba3-7135f092e185','47ba0618-7b29-443d-ba10-2d4fe59cb55b','2e244418-9f1e-4b9a-bd24-d1cce0f7c6fc','47320a90-4e1f-4d39-9091-30d4668c0fb7','52b5215e-88ee-4bc0-810d-395d719895cb','85c6c451-8443-4087-aecf-3d4029059904','773c429c-68f2-46c9-8101-93879db6ab82'];
  for (const goalId of olderFormGoalIds.slice(0, 3)) {
    const goalDoc = goalsSnap.docs.find(d => d.id === goalId);
    if (!goalDoc) { console.log('  Goal', goalId, '-> NOT FOUND'); continue; }
    const g = goalDoc.data();
    const libDoc = await db.collection('goalsLibrary').doc(g.libraryItemId).get();
    const lib = libDoc.exists ? libDoc.data() : null;
    const hasDc = lib && lib.dataCollectionTemplate && (
      Array.isArray(lib.dataCollectionTemplate) ? lib.dataCollectionTemplate.length > 0 :
      lib.dataCollectionTemplate.tables && lib.dataCollectionTemplate.tables.length > 0
    );
    console.log('  Goal:', goalId, '- title:', g.title, '- libId:', g.libraryItemId, '- hasDcTemplate:', hasDc);
  }

  process.exit(0);
})();
