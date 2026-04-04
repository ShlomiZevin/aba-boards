const { getDb } = require('./services/firebase');

async function diagnose() {
  const db = getDb();

  // Get all sessionForms
  const snap = await db.collection('sessionForms').get();
  const forms = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log(`\nTotal sessionForms: ${forms.length}\n`);

  // Find forms with missing practitionerId
  const missingPractitioner = forms.filter(f => !f.practitionerId);
  console.log(`Forms with NO practitionerId: ${missingPractitioner.length}`);
  for (const f of missingPractitioner) {
    const date = f.sessionDate?.seconds
      ? new Date(f.sessionDate.seconds * 1000).toISOString().slice(0, 10)
      : f.sessionDate || 'no date';
    console.log(`  - Form ${f.id} | kidId: ${f.kidId} | date: ${date} | duration: ${f.sessionDuration || 'none'}`);
    // Check if there's a therapist name stored inline
    const nameFields = Object.keys(f).filter(k => /name|therapist|practitioner/i.test(k));
    if (nameFields.length) {
      for (const k of nameFields) console.log(`    ${k}: ${JSON.stringify(f[k])}`);
    }
  }

  // Find forms with missing sessionDuration
  const missingDuration = forms.filter(f => !f.sessionDuration);
  console.log(`\nForms with NO sessionDuration: ${missingDuration.length}`);
  for (const f of missingDuration) {
    const date = f.sessionDate?.seconds
      ? new Date(f.sessionDate.seconds * 1000).toISOString().slice(0, 10)
      : f.sessionDate || 'no date';
    console.log(`  - Form ${f.id} | kidId: ${f.kidId} | date: ${date} | practitionerId: ${f.practitionerId || 'none'}`);
  }

  // Check all practitionerIds against practitioners collection
  const practIds = [...new Set(forms.filter(f => f.practitionerId).map(f => f.practitionerId))];
  console.log(`\nUnique practitionerIds in forms: ${practIds.length}`);

  const practSnap = await db.collection('practitioners').get();
  const practMap = {};
  practSnap.docs.forEach(d => { practMap[d.id] = d.data().name || '(no name)'; });
  console.log(`Practitioners in DB: ${Object.keys(practMap).length}`);

  const orphanIds = practIds.filter(id => !practMap[id]);
  if (orphanIds.length) {
    console.log(`\nPractitioner IDs in forms that DON'T match any practitioner doc:`);
    for (const id of orphanIds) {
      const count = forms.filter(f => f.practitionerId === id).length;
      console.log(`  - "${id}" (${count} forms)`);
    }
  }

  // Specifically look at Feb 2026 forms
  console.log(`\n--- February 2026 forms ---`);
  const feb = forms.filter(f => {
    const d = f.sessionDate?.seconds
      ? new Date(f.sessionDate.seconds * 1000)
      : new Date(f.sessionDate);
    return d.getFullYear() === 2026 && d.getMonth() === 1; // month 1 = Feb
  });
  console.log(`Total Feb 2026 forms: ${feb.length}`);
  for (const f of feb) {
    const d = f.sessionDate?.seconds
      ? new Date(f.sessionDate.seconds * 1000)
      : new Date(f.sessionDate);
    const dateStr = d.toISOString().slice(0, 10);
    const practName = f.practitionerId ? (practMap[f.practitionerId] || `UNKNOWN(${f.practitionerId})`) : 'NO_ID';
    console.log(`  ${dateStr} | Form ${f.id} | kid: ${f.kidId} | practitioner: ${practName} | duration: ${f.sessionDuration || 'none'}`);
    if (!f.practitionerId || !f.sessionDuration) {
      // Show all fields for problematic forms
      const relevant = {};
      for (const [k, v] of Object.entries(f)) {
        if (typeof v !== 'object' || v?.seconds) relevant[k] = v?.seconds ? new Date(v.seconds * 1000).toISOString() : v;
      }
      console.log(`    All fields: ${JSON.stringify(relevant, null, 2)}`);
    }
  }

  process.exit(0);
}

diagnose().catch(e => { console.error(e); process.exit(1); });
