const express = require('express');
const router = express.Router();
const multer = require('multer');
const therapyService = require('../services/therapy');
const emailService = require('../services/email');
const { requireAdmin, requireSuperAdmin } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ==================== AI CHAT ====================

const { handleChat } = require('../services/chat-center');
const chatHistory = require('../services/chat-history');

// Saves the turn to history; never fails the chat itself.
async function saveChatTurn(req, conversationId, kidId, messages, result) {
  try {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    const turn = [];
    if (lastUser) turn.push({ role: 'user', content: lastUser.content });
    turn.push({ role: 'assistant', content: result.reply || '', toolsUsed: result.toolsUsed, boardUpdated: result.boardUpdated, summaryCreated: result.summaryCreated });
    return await chatHistory.appendTurn(req, conversationId, kidId, turn);
  } catch (err) {
    console.error('[chat-history] save failed:', err.message);
    return conversationId || null;
  }
}

router.get('/chat/conversations', asyncHandler(async (req, res) => {
  res.json(await chatHistory.listConversations(req, { scope: req.query.scope }));
}));

router.get('/chat/conversations/:id', asyncHandler(async (req, res) => {
  const conv = await chatHistory.getConversation(req, req.params.id);
  if (!conv) return res.status(404).json({ error: 'השיחה לא נמצאה' });
  res.json(conv);
}));

router.delete('/chat/conversations/:id', asyncHandler(async (req, res) => {
  const ok = await chatHistory.deleteConversation(req, req.params.id);
  if (!ok) return res.status(404).json({ error: 'השיחה לא נמצאה' });
  res.json({ success: true });
}));

router.post('/chat', asyncHandler(async (req, res) => {
  const { messages, kidId, stream, summaryDetail, conversationId } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  let source = 'admin';
  if (req.authType === 'therapist') source = 'therapist';
  else if (req.authType === 'parent') source = 'parent';

  const practitionerId = req.practitionerId || null;
  const parentKidId = req.authType === 'parent' ? req.kidViewId : null;

  // Parents are locked to their own kid
  const effectiveKidId = parentKidId || kidId || null;

  // Therapists MUST provide a kidId — prevents data leaks across kids
  if (req.authType === 'therapist' && !effectiveKidId) {
    return res.status(400).json({ error: 'Therapists must select a kid before chatting' });
  }

  // Verify therapist has access to the selected kid
  if (req.authType === 'therapist' && effectiveKidId && practitionerId) {
    const myKids = await therapyService.getKidsForPractitioner(practitionerId);
    if (!myKids.some(k => k.id === effectiveKidId)) {
      return res.status(403).json({ error: 'No access to this kid' });
    }
  }

  try {
    await chatHistory.assertWritable(req, conversationId);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }

  if (stream) {
    // SSE streaming mode — send tool status updates in real time
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const onToolStatus = (status) => {
      res.write(`data: ${JSON.stringify(status)}\n\n`);
    };

    try {
      const result = await handleChat(req.adminId, messages, effectiveKidId, onToolStatus, source, practitionerId, parentKidId, { summaryDetail });
      const savedId = await saveChatTurn(req, conversationId, effectiveKidId, messages, result);
      res.write(`data: ${JSON.stringify({ type: 'done', ...result, conversationId: savedId })}\n\n`);
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
    }
    res.end();
  } else {
    // Regular JSON response (backwards compatible)
    const result = await handleChat(req.adminId, messages, effectiveKidId, null, source, practitionerId, parentKidId, { summaryDetail });
    const savedId = await saveChatTurn(req, conversationId, effectiveKidId, messages, result);
    res.json({ ...result, conversationId: savedId });
  }
}));

// ==================== AI IMAGE GENERATION (Leonardo) ====================

const { generateImages } = require('../services/leonardo');

// Image generation is restricted to the super admin (מיכל) only
router.post('/generate-image', requireSuperAdmin, asyncHandler(async (req, res) => {
  const { prompt, model, conversationId, kidId } = req.body || {};
  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: 'חובה לספק תיאור לתמונה' });
  }

  try {
    const result = await generateImages({ prompt, model });
    let savedId = conversationId || null;
    try {
      await chatHistory.assertWritable(req, conversationId);
      savedId = await chatHistory.appendTurn(req, conversationId, kidId, [
        { role: 'user', content: `🎨 ${prompt}` },
        { role: 'assistant', content: '', images: result.images, imageModelLabel: result.modelLabel },
      ]);
    } catch (err) {
      console.error('[chat-history] image save failed:', err.message);
    }
    res.json({ ...result, conversationId: savedId });
  } catch (err) {
    console.error('Image generation error:', err);
    res.status(500).json({ error: err.message || 'יצירת התמונה נכשלה' });
  }
}));

// ==================== KIDS ====================

router.get('/kids/all-grouped', requireSuperAdmin, asyncHandler(async (req, res) => {
  const result = await therapyService.getAllKidsForSuperAdmin(req.adminId);
  res.json(result);
}));

router.get('/kids', asyncHandler(async (req, res) => {
  const kids = await therapyService.getAllKids(req.adminId);
  res.json(kids);
}));

router.get('/kids/:kidId', asyncHandler(async (req, res) => {
  const kid = await therapyService.getKidById(req.params.kidId);
  if (!kid) {
    return res.status(404).json({ error: 'Kid not found' });
  }
  res.json(kid);
}));

router.post('/kids', asyncHandler(async (req, res) => {
  const kid = await therapyService.createKid(req.body, req.adminId);
  res.status(201).json(kid);
}));

router.put('/kids/:kidId', asyncHandler(async (req, res) => {
  const kid = await therapyService.updateKid(req.params.kidId, req.body);
  res.json(kid);
}));

router.delete('/kids/:kidId', asyncHandler(async (req, res) => {
  await therapyService.deleteKid(req.params.kidId);
  res.status(204).send();
}));

router.post('/kids/:kidId/detach', requireSuperAdmin, asyncHandler(async (req, res) => {
  await therapyService.detachKid(req.params.kidId, req.adminId);
  res.json({ success: true });
}));

router.post('/kids/:kidId/attach', requireSuperAdmin, asyncHandler(async (req, res) => {
  await therapyService.attachKid(req.params.kidId, req.adminId);
  res.json({ success: true });
}));

// Mini-games (therapy-center/src/games). Config lives on the kid document
// and is saved through PUT /kids/:kidId; only play state is served here.
router.get('/kids/:kidId/game-state', asyncHandler(async (req, res) => {
  const state = await therapyService.getKidGameState(req.params.kidId);
  res.json(state);
}));

router.put('/kids/:kidId/game-state/:gameId', asyncHandler(async (req, res) => {
  const state = await therapyService.saveKidGameState(
    req.params.kidId, req.params.gameId, req.body
  );
  res.json(state);
}));

router.post('/kids/:kidId/game-state/:gameId/reset', asyncHandler(async (req, res) => {
  const state = await therapyService.resetKidGameState(req.params.kidId, req.params.gameId);
  res.json(state);
}));

// Daily agenda (סדר יום) — its own page, independent of the board.
// Parents edit it too: planning tomorrow together is the whole point.
const agendaHandler = (fn) => async (req, res) => {
  try {
    await assertAgendaAccess(req);
    await fn(req, res);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error('Agenda error:', err);
    res.status(status).json({ error: err.message || 'Request failed' });
  }
};

async function assertAgendaAccess(req) {
  const { kidId } = req.params;
  const deny = () => {
    const err = new Error('אין הרשאה לילד זה');
    err.status = 403;
    throw err;
  };
  if (req.authType === 'parent') {
    if (req.kidViewId !== kidId) deny();
    return;
  }
  if (req.authType === 'therapist') {
    const myKids = await therapyService.getKidsForPractitioner(req.practitionerId);
    if (!myKids.some((k) => k.id === kidId)) deny();
    return;
  }
  const kid = await therapyService.getKidById(kidId);
  if (!kid) {
    const err = new Error('Kid not found');
    err.status = 404;
    throw err;
  }
  if (!req.isSuperAdmin && kid.adminId && kid.adminId !== req.adminId) deny();
}

router.get('/kids/:kidId/agenda', agendaHandler(async (req, res) => {
  const { from, to } = req.query;
  res.json(await therapyService.getKidAgenda(req.params.kidId, String(from), String(to)));
}));

router.put('/kids/:kidId/agenda/routine', agendaHandler(async (req, res) => {
  res.json(await therapyService.saveKidAgendaRoutine(req.params.kidId, req.body && req.body.routine));
}));

router.put('/kids/:kidId/agenda/days/:date', agendaHandler(async (req, res) => {
  const items = req.body ? req.body.items : null;
  res.json(await therapyService.saveKidAgendaDay(req.params.kidId, req.params.date, items || null));
}));

router.put('/kids/:kidId/agenda/days/:date/done', agendaHandler(async (req, res) => {
  const { itemId, done } = req.body || {};
  res.json(await therapyService.setKidAgendaItemDone(req.params.kidId, req.params.date, itemId, !!done));
}));

// Daily report (דיווח יומי). Staff write; parents may read their own kid's.
const reportHandler = (fn, { write = false } = {}) => agendaHandler(async (req, res) => {
  if (write && req.authType === 'parent') {
    return res.status(403).json({ error: 'צפייה בלבד' });
  }
  await fn(req, res);
});

router.get('/kids/:kidId/daily-reports', reportHandler(async (req, res) => {
  res.json(await therapyService.listDailyReports(req.params.kidId));
}));

router.get('/kids/:kidId/daily-reports/:date', reportHandler(async (req, res) => {
  res.json(await therapyService.getDailyReport(req.params.kidId, req.params.date));
}));

/**
 * Mail the centre's manager once per kid per day, when that day's report is
 * first created. Best-effort, like the form mail: never fails the save.
 */
async function notifyDailyReportOpened(kidId, date) {
  try {
    const kid = await therapyService.getKidById(kidId);
    if (!kid) return;
    const to = emailService.formNotifyRecipient(kid.adminId);
    if (!to) {
      console.log('[email] daily report notification skipped: no recipient for centre', kid.adminId || '(none)');
      return;
    }
    const report = await therapyService.claimDailyReportNotification(kidId, date);
    if (!report) return; // already sent for this day
    const sent = await emailService.sendMail({
      to,
      ...emailService.buildDailyReportNotification({ kidId, kidName: kid.name, reporter: report.reporter, date }),
    });
    if (!sent) await therapyService.releaseDailyReportNotification(kidId, date);
  } catch (err) {
    console.error('[email] daily report notification failed:', err.message);
  }
}

router.put('/kids/:kidId/daily-reports/:date', reportHandler(async (req, res) => {
  const report = await therapyService.saveDailyReportMeta(req.params.kidId, req.params.date, req.body);
  await notifyDailyReportOpened(req.params.kidId, req.params.date);
  res.json(report);
}, { write: true }));

router.delete('/kids/:kidId/daily-reports/:date', reportHandler(async (req, res) => {
  await therapyService.deleteDailyReport(req.params.kidId, req.params.date);
  res.json({ deleted: true }); // a body, not 204: the client always parses JSON
}, { write: true }));

router.put('/kids/:kidId/daily-reports/:date/:section/:itemId', reportHandler(async (req, res) => {
  const body = { ...(req.body || {}), id: req.params.itemId };
  const report = await therapyService.saveDailyReportItem(req.params.kidId, req.params.date, req.params.section, body);
  await notifyDailyReportOpened(req.params.kidId, req.params.date);
  res.json(report);
}, { write: true }));

router.delete('/kids/:kidId/daily-reports/:date/:section/:itemId', reportHandler(async (req, res) => {
  res.json(await therapyService.deleteDailyReportItem(
    req.params.kidId, req.params.date, req.params.section, req.params.itemId
  ));
}, { write: true }));

// Form Template
router.get('/kids/:kidId/form-template', asyncHandler(async (req, res) => {
  const template = await therapyService.getFormTemplate(req.params.kidId);
  res.json(template);
}));

router.put('/kids/:kidId/form-template', asyncHandler(async (req, res) => {
  const template = await therapyService.updateFormTemplate(req.params.kidId, req.body);
  res.json(template);
}));

// ==================== PRACTITIONERS ====================

router.get('/kids/:kidId/practitioners', asyncHandler(async (req, res) => {
  const practitioners = await therapyService.getPractitionersForKid(req.params.kidId);
  res.json(practitioners);
}));

router.post('/kids/:kidId/practitioners', asyncHandler(async (req, res) => {
  const practitioner = await therapyService.addPractitionerToKid(
    req.params.kidId,
    req.body,
    req.adminId
  );
  res.status(201).json(practitioner);
}));

router.post('/kids/:kidId/practitioners/link', asyncHandler(async (req, res) => {
  await therapyService.linkExistingPractitionerToKid(
    req.params.kidId,
    req.body.practitionerId,
    req.adminId
  );
  res.status(204).send();
}));

router.delete('/kids/:kidId/practitioners/:practitionerId', asyncHandler(async (req, res) => {
  await therapyService.unlinkPractitioner(req.params.kidId, req.params.practitionerId);
  res.status(204).send();
}));

router.post('/practitioners', asyncHandler(async (req, res) => {
  const practitioner = await therapyService.createPractitioner(req.body, req.adminId);
  res.status(201).json(practitioner);
}));

router.put('/practitioners/:id', asyncHandler(async (req, res) => {
  const practitioner = await therapyService.updatePractitioner(req.params.id, req.body);
  res.json(practitioner);
}));

router.delete('/practitioners/:id', asyncHandler(async (req, res) => {
  await therapyService.deletePractitioner(req.params.id);
  res.status(204).send();
}));

router.get('/practitioners/:practitionerId/kids', asyncHandler(async (req, res) => {
  const kids = await therapyService.getKidsForPractitioner(req.params.practitionerId);
  res.json(kids);
}));

router.get('/practitioners/my-therapists', asyncHandler(async (req, res) => {
  const therapists = await therapyService.getMyTherapists(req.adminId);
  res.json(therapists);
}));

router.get('/practitioners/:id/info', asyncHandler(async (req, res) => {
  const practitioner = await therapyService.getPractitionerById(req.params.id);
  if (!practitioner) return res.status(404).json({ error: 'Practitioner not found' });
  res.json(practitioner);
}));

// ==================== PARENTS ====================

router.get('/kids/:kidId/parents', asyncHandler(async (req, res) => {
  const parents = await therapyService.getParentsForKid(req.params.kidId);
  res.json(parents);
}));

router.post('/kids/:kidId/parents', asyncHandler(async (req, res) => {
  const parent = await therapyService.addParentToKid(req.params.kidId, req.body);
  res.status(201).json(parent);
}));

router.put('/parents/:id', asyncHandler(async (req, res) => {
  const parent = await therapyService.updateParent(req.params.id, req.body);
  res.json(parent);
}));

router.delete('/parents/:id', asyncHandler(async (req, res) => {
  await therapyService.deleteParent(req.params.id);
  res.status(204).send();
}));

// ==================== TREATMENT AGREEMENT ====================
// One agreement per kid. Both the centre admin and each parent sign it.
// Signing is deliberately one-way: a signature can be re-drawn by the signer
// who made it, but there is no route that removes one.

// The app has no global error middleware, so these routes translate the
// service's `err.status` into a JSON response themselves.
const agreementHandler = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error('Agreement error:', err);
    res.status(status).json({ error: err.message || 'Request failed' });
  }
};

/**
 * The agreement is between the behaviour analyst and the parents, and nobody
 * else. Therapists around the child are not party to it and must not see it,
 * even though they can see the rest of the kid's record.
 */
function assertAgreementAccess(req) {
  if (req.authType === 'therapist') {
    const err = new Error('ההסכם חסוי וזמין להורים ולמנתח/ת ההתנהגות בלבד');
    err.status = 403;
    throw err;
  }
  // Parents reach the app through /p/:kidId — lock them to that kid.
  if (req.authType === 'parent' && req.kidViewId !== req.params.kidId) {
    const err = new Error('אין הרשאה להסכם של ילד אחר');
    err.status = 403;
    throw err;
  }
}

router.get('/kids/:kidId/agreement', agreementHandler(async (req, res) => {
  assertAgreementAccess(req);
  const agreement = await therapyService.getAgreement(req.params.kidId);
  // Parents should not see a draft the admin is still writing.
  if (agreement && req.authType === 'parent' && agreement.status !== 'active') {
    return res.json(null);
  }
  res.json(agreement);
}));

router.put('/kids/:kidId/agreement', requireAdmin, agreementHandler(async (req, res) => {
  const agreement = await therapyService.saveAgreement(req.params.kidId, req.body, req.adminId);
  res.json(agreement);
}));

router.delete('/kids/:kidId/agreement', requireAdmin, agreementHandler(async (req, res) => {
  await therapyService.deleteAgreement(req.params.kidId);
  res.json({ deleted: true }); // a body, not 204: the client always parses JSON
}));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email the agreement to the kid's parents: each one with an email on record
 * who hasn't signed yet gets their family's link to read and sign. Admin only,
 * and only for an agreement already sent for signing.
 */
router.post('/kids/:kidId/agreement/email-parents', requireAdmin, agreementHandler(async (req, res) => {
  const { kidId } = req.params;
  const fail = (status, message) => { const err = new Error(message); err.status = status; throw err; };

  const kid = await therapyService.getKidById(kidId);
  if (!kid) fail(404, 'הילד לא נמצא');
  if (!req.isSuperAdmin && kid.adminId && kid.adminId !== req.adminId) fail(403, 'אין הרשאה לילד זה');
  const agreement = await therapyService.getAgreement(kidId);
  if (!agreement) fail(404, 'לא נמצא הסכם');
  if (agreement.status !== 'active') fail(409, 'יש לשלוח את ההסכם לחתימה לפני השליחה במייל');
  if (!emailService.isConfigured()) fail(503, 'שליחת מיילים אינה מוגדרת בשרת');

  const parents = await therapyService.getParentsForKid(kidId);
  const only = Array.isArray(req.body && req.body.parentIds) ? new Set(req.body.parentIds) : null;
  // Replies go to the manager, not to the sending mailbox
  const manager = await therapyService.getPractitionerById(req.adminId).catch(() => null);
  const replyTo = manager && EMAIL_RE.test(manager.email || '') ? manager.email : undefined;
  const senderName = req.adminName || (manager && manager.name) || '';

  const results = [];
  const sentIds = [];
  for (const p of parents) {
    if (only && !only.has(p.id)) continue;
    const base = { parentId: p.id, name: p.name || '' };
    if ((agreement.signatures || {})[`parent:${p.id}`]) { results.push({ ...base, status: 'signed' }); continue; }
    const email = (p.email || '').trim();
    if (!EMAIL_RE.test(email)) { results.push({ ...base, status: 'no-email' }); continue; }
    const mail = emailService.buildAgreementInvite({ kidId, kidName: kid.name, parentName: p.name, senderName });
    const ok = await emailService.sendMail({ to: email, subject: mail.subject, text: mail.text, html: mail.html, replyTo });
    results.push({ ...base, status: ok ? 'sent' : 'failed' });
    if (ok) sentIds.push(p.id);
  }
  await therapyService.markAgreementEmailed(kidId, sentIds);
  res.json({ results, agreement: await therapyService.getAgreement(kidId) });
}));

router.post('/kids/:kidId/agreement/sign', agreementHandler(async (req, res) => {
  assertAgreementAccess(req);
  const { kidId } = req.params;
  const { signatureImage, parentId, newParentName } = req.body || {};

  let signer;
  if (req.authType === 'admin') {
    // The role is filled in by the service from the agreement itself.
    signer = { type: 'admin', id: req.adminId, name: req.adminName || '' };
  } else if (req.authType === 'parent') {
    const fail = (status, message) => { const err = new Error(message); err.status = status; throw err; };
    // The parent must be one of this kid's registered parents — that is what
    // ties a signature slot to a real person in the centre's records.
    const parents = await therapyService.getParentsForKid(kidId);
    let parent;
    if (parentId) {
      parent = parents.find(p => p.id === parentId);
      if (!parent) fail(403, 'ההורה לא רשום אצל הילד');
    } else if (typeof newParentName === 'string') {
      // A parent reached through a shared link who isn't on record yet: they
      // become a registered parent by signing with their full name. Capped, so
      // a forwarded link can't be used to pile up parents.
      const name = newParentName.trim().replace(/\s+/g, ' ').slice(0, 60);
      if (name.length < 2) fail(400, 'יש להקליד שם מלא');
      if (parents.length >= 4) fail(400, 'לא ניתן להוסיף הורים נוספים — פנו למרכז');
      const existing = parents.find(p => (p.name || '').trim() === name);
      parent = existing || await therapyService.addParentToKid(kidId, { name });
    } else {
      fail(400, 'יש לבחור מי מההורים חותם');
    }
    signer = { type: 'parent', id: parent.id, name: parent.name, role: 'הורה' };
  } else {
    const err = new Error('רק הורה או מנתח/ת ההתנהגות יכולים לחתום');
    err.status = 403;
    throw err;
  }

  const agreement = await therapyService.signAgreement(kidId, signer, signatureImage);
  if (signer.type === 'parent') await notifyAgreementSigned(kidId, signer.name, agreement);
  res.json(agreement);
}));

/** Mail the centre's manager when a parent signs. Best-effort: never fails the signature. */
async function notifyAgreementSigned(kidId, signerName, agreement) {
  try {
    const kid = await therapyService.getKidById(kidId);
    if (!kid) return;
    const to = emailService.formNotifyRecipient(kid.adminId);
    if (!to) {
      console.log('[email] agreement-signed notification skipped: no recipient for centre', kid.adminId || '(none)');
      return;
    }
    const parents = await therapyService.getParentsForKid(kidId);
    const signed = Object.keys((agreement && agreement.signatures) || {});
    const fullySigned = signed.length >= 1 + parents.length;
    await emailService.sendMail({
      to,
      ...emailService.buildAgreementSignedNotification({ kidId, kidName: kid.name, signerName, fullySigned }),
    });
  } catch (err) {
    console.error('[email] agreement-signed notification failed:', err.message);
  }
}

// ==================== GOALS ====================

router.get('/kids/:kidId/goals', asyncHandler(async (req, res) => {
  const goals = await therapyService.getGoalsForKid(req.params.kidId);
  res.json(goals);
}));

router.post('/kids/:kidId/goals', asyncHandler(async (req, res) => {
  const goal = await therapyService.addGoalToKid(req.params.kidId, req.body);
  res.status(201).json(goal);
}));

router.put('/goals/:id', asyncHandler(async (req, res) => {
  const goal = await therapyService.updateGoal(req.params.id, req.body);
  res.json(goal);
}));

router.delete('/goals/:id', asyncHandler(async (req, res) => {
  await therapyService.deleteGoal(req.params.id);
  res.status(204).send();
}));

router.get('/goals/library/all', requireSuperAdmin, asyncHandler(async (req, res) => {
  const items = await therapyService.getAllGoalsLibrary();
  res.json(items);
}));

router.delete('/goals/library/:id', requireSuperAdmin, asyncHandler(async (req, res) => {
  await therapyService.deleteGoalLibraryItem(req.params.id);
  res.status(204).send();
}));

router.post('/goals/library', requireSuperAdmin, asyncHandler(async (req, res) => {
  const item = await therapyService.addGoalLibraryItem(req.body);
  res.status(201).json(item);
}));

router.get('/goals/library', asyncHandler(async (req, res) => {
  const search = req.query.search || '';
  if (search.length < 3) {
    return res.json([]);
  }
  const results = await therapyService.searchGoalsLibrary(search);
  res.json(results);
}));

// Goal library template editor (admin only)
router.put('/goals/library/:id/templates', requireAdmin, asyncHandler(async (req, res) => {
  const item = await therapyService.updateGoalLibraryTemplates(req.params.id, req.body);
  res.json(item);
}));

// Bulk apply template to multiple goals (admin only)
router.post('/goals/library/:id/apply-template', requireAdmin, asyncHandler(async (req, res) => {
  const { targetIds, formType, replaceTitle } = req.body;
  const result = await therapyService.bulkApplyTemplate(req.params.id, targetIds, formType, { replaceTitle });
  res.json(result);
}));

// ==================== GOAL LEARNING PLANS ====================

router.get('/kids/:kidId/goal-plans/:goalLibraryId', asyncHandler(async (req, res) => {
  const plan = await therapyService.getGoalLearningPlan(req.params.kidId, req.params.goalLibraryId);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  res.json(plan);
}));

router.put('/kids/:kidId/goal-plans/:goalLibraryId', asyncHandler(async (req, res) => {
  const updatedBy = req.practitionerId || req.adminId || 'unknown';
  const plan = await therapyService.saveGoalLearningPlan(
    req.params.kidId,
    req.params.goalLibraryId,
    req.body,
    updatedBy
  );
  res.json(plan);
}));

// ==================== GOAL LEARNING PLAN VERSIONS ====================

router.get('/kids/:kidId/goal-plans/:goalLibraryId/versions', asyncHandler(async (req, res) => {
  const versions = await therapyService.getLearningPlanVersions(req.params.kidId, req.params.goalLibraryId);
  res.json(versions);
}));

router.post('/kids/:kidId/goal-plans/:goalLibraryId/versions', asyncHandler(async (req, res) => {
  const createdBy = req.practitionerId || req.adminId || 'unknown';
  const version = await therapyService.saveLearningPlanVersion(
    req.params.kidId,
    req.params.goalLibraryId,
    req.body,
    createdBy
  );
  res.json(version);
}));

router.get('/kids/:kidId/goal-plans/:goalLibraryId/versions/:versionId', asyncHandler(async (req, res) => {
  const version = await therapyService.getLearningPlanVersion(
    req.params.kidId, req.params.goalLibraryId, req.params.versionId
  );
  if (!version) return res.status(404).json({ error: 'Version not found' });
  res.json(version);
}));

router.delete('/kids/:kidId/goal-plans/:goalLibraryId/versions/:versionId', asyncHandler(async (req, res) => {
  await therapyService.deleteLearningPlanVersion(
    req.params.kidId, req.params.goalLibraryId, req.params.versionId
  );
  res.json({ success: true });
}));

router.post('/kids/:kidId/goal-plans/:goalLibraryId/versions/:versionId/restore', asyncHandler(async (req, res) => {
  const restoredBy = req.practitionerId || req.adminId || 'unknown';
  const plan = await therapyService.restoreLearningPlanVersion(
    req.params.kidId, req.params.goalLibraryId, req.params.versionId, restoredBy
  );
  res.json(plan);
}));

// ==================== CATEGORY LP TEMPLATES ====================

router.get('/category-lp-templates', asyncHandler(async (req, res) => {
  const templates = await therapyService.getAllCategoryLpTemplates();
  res.json(templates);
}));

router.get('/category-lp-templates/:categoryId', asyncHandler(async (req, res) => {
  const template = await therapyService.getCategoryLpTemplate(req.params.categoryId);
  res.json(template);
}));

router.put('/category-lp-templates/:categoryId', requireAdmin, asyncHandler(async (req, res) => {
  const result = await therapyService.saveCategoryLpTemplate(req.params.categoryId, req.body);
  res.json(result);
}));

router.delete('/category-lp-templates/:categoryId', requireSuperAdmin, asyncHandler(async (req, res) => {
  await therapyService.deleteCategoryLpTemplate(req.params.categoryId);
  res.json({ success: true });
}));

// ==================== GOAL DATA COLLECTION ====================

router.get('/kids/:kidId/goal-data/:goalLibraryId', asyncHandler(async (req, res) => {
  const entries = await therapyService.getGoalDataEntries(req.params.kidId, req.params.goalLibraryId);
  res.json(entries);
}));

router.post('/kids/:kidId/goal-data/:goalLibraryId', asyncHandler(async (req, res) => {
  const entry = await therapyService.addGoalDataEntry(
    req.params.kidId,
    req.params.goalLibraryId,
    req.body
  );
  res.status(201).json(entry);
}));

router.put('/kids/:kidId/goal-data/:goalLibraryId/:entryId', asyncHandler(async (req, res) => {
  const requesterId = req.practitionerId || req.adminId || null;
  const entry = await therapyService.updateGoalDataEntry(
    req.params.kidId,
    req.params.goalLibraryId,
    req.params.entryId,
    req.body,
    requesterId
  );
  res.json(entry);
}));

router.delete('/kids/:kidId/goal-data/:goalLibraryId/:entryId', asyncHandler(async (req, res) => {
  await therapyService.deleteGoalDataEntry(
    req.params.kidId,
    req.params.goalLibraryId,
    req.params.entryId
  );
  res.status(204).send();
}));

router.get('/kids/:kidId/pending-dc', asyncHandler(async (req, res) => {
  const entries = await therapyService.getPendingDcForms(req.params.kidId);
  res.json(entries);
}));

router.get('/kids/:kidId/all-dc', asyncHandler(async (req, res) => {
  const entries = await therapyService.getAllDcEntries(req.params.kidId);
  res.json(entries);
}));

// Migrate orphaned goals → match by title to library, write only libraryItemId (admin only)
router.post('/kids/:kidId/goals/migrate-library-links', requireAdmin, asyncHandler(async (req, res) => {
  const result = await therapyService.migrateGoalLibraryLinks(req.params.kidId);
  res.json(result);
}));

// Bulk-add DC entries (used after file upload confirmation)
router.post('/kids/:kidId/goal-data/:goalLibraryId/bulk', requireAdmin, asyncHandler(async (req, res) => {
  const entries = (req.body.entries || []).map(e => ({ ...e, goalTitle: e.goalTitle || '' }));
  const saved = await therapyService.bulkAddGoalDataEntries(req.params.kidId, req.params.goalLibraryId, entries);
  res.status(201).json(saved);
}));

// Upload a .doc/.docx file → Claude extracts structured form data (preview only, does not save)
// Admin can extract data only; super-admin can also extract + suggest new column structure
router.post('/kids/:kidId/goal-forms/:goalLibraryId/upload', requireAdmin, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'לא נבחר קובץ' });

  // Only .docx is supported (mammoth doesn't handle .doc binary format)
  const fileName = req.file.originalname || '';
  if (fileName.toLowerCase().endsWith('.doc') && !fileName.toLowerCase().endsWith('.docx')) {
    return res.status(400).json({ error: 'פורמט .doc אינו נתמך — נא להמיר את הקובץ ל-.docx (Word 2007+)' });
  }

  const formType = req.body.formType; // 'lp' | 'dc'
  if (!formType || !['lp', 'dc'].includes(formType)) {
    return res.status(400).json({ error: 'formType חייב להיות lp או dc' });
  }

  // updateStructure: super-admins can always update; regular admins can update only if no template exists yet
  const updateStructure = req.body.updateStructure === 'true' && (req.isSuperAdmin || req.body.formType === 'lp');

  console.log('[upload route] kidId:', req.params.kidId, 'goalLibraryId:', req.params.goalLibraryId, 'formType:', formType, 'fileSize:', req.file.size, 'updateStructure:', updateStructure);

  const result = await therapyService.extractGoalFormFromFile(
    req.params.goalLibraryId,
    req.file.buffer,
    { formType, updateStructure }
  );

  res.json(result);
}));

// ==================== MEETING VISIBILITY HELPERS ====================
// A meeting (type פגישה) can be restricted by the center admin to parents and/or
// therapists. Absent visibility = visible to all (backward compatible). Admins always
// see everything; therapists/parents only see meetings flagged for their role.

function meetingVisibleTo(visibility, authType) {
  if (authType !== 'therapist' && authType !== 'parent') return true; // admin / other
  if (!visibility) return true; // default: visible to all
  return authType === 'parent' ? visibility.parents !== false : visibility.therapists !== false;
}

// Drop meeting-type sessions that the requesting role isn't allowed to see.
async function filterSessionsByMeetingVisibility(sessions, kidId, authType) {
  if (authType !== 'therapist' && authType !== 'parent') return sessions;
  if (!sessions.some(s => s.type === 'meeting')) return sessions;

  const forms = await therapyService.getMeetingFormsForKid(kidId);
  const visBySessionId = {};
  const visByFormId = {};
  for (const f of forms) {
    if (f.sessionId) visBySessionId[f.sessionId] = f.visibility;
    visByFormId[f.id] = f.visibility;
  }
  return sessions.filter(s => {
    if (s.type !== 'meeting') return true;
    const vis = visBySessionId[s.id] ?? (s.formId ? visByFormId[s.formId] : undefined);
    return meetingVisibleTo(vis, authType);
  });
}

// ==================== SESSIONS ====================

router.get('/kids/:kidId/sessions', asyncHandler(async (req, res) => {
  const filters = {
    from: req.query.from,
    to: req.query.to,
    status: req.query.status,
  };
  let sessions = await therapyService.getSessionsForKid(req.params.kidId, filters);
  sessions = await filterSessionsByMeetingVisibility(sessions, req.params.kidId, req.authType);
  res.json(sessions);
}));

router.post('/kids/:kidId/sessions', asyncHandler(async (req, res) => {
  const session = await therapyService.scheduleSession(req.params.kidId, req.body, req.adminId);
  res.status(201).json(session);
}));

router.post('/kids/:kidId/sessions/recurring', asyncHandler(async (req, res) => {
  const sessions = await therapyService.scheduleRecurringSessions(req.params.kidId, req.body);
  res.status(201).json(sessions);
}));

router.put('/sessions/:id', asyncHandler(async (req, res) => {
  const session = await therapyService.updateSession(req.params.id, req.body);
  res.json(session);
}));

router.delete('/sessions/:id', asyncHandler(async (req, res) => {
  await therapyService.deleteSession(req.params.id);
  res.status(204).send();
}));

router.get('/sessions/alerts', asyncHandler(async (req, res) => {
  const alerts = await therapyService.getSessionAlerts(req.adminId);
  res.json(alerts);
}));

router.get('/sessions', asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const sessions = await therapyService.getAllSessionsForAdmin(req.adminId, { from, to });
  res.json(sessions);
}));

router.post('/sessions', asyncHandler(async (req, res) => {
  const session = await therapyService.scheduleCustomSession(req.adminId, req.body);
  res.status(201).json(session);
}));

// ==================== FORMS ====================

router.get('/kids/:kidId/forms', asyncHandler(async (req, res) => {
  const filters = { weekOf: req.query.weekOf };
  const forms = await therapyService.getFormsForKid(req.params.kidId, filters);
  res.json(forms);
}));

router.get('/forms/:id', asyncHandler(async (req, res) => {
  const form = await therapyService.getFormById(req.params.id);
  if (!form) {
    return res.status(404).json({ error: 'Form not found' });
  }
  res.json(form);
}));

router.get('/sessions/:sessionId/form', asyncHandler(async (req, res) => {
  const form = await therapyService.getFormForSession(req.params.sessionId);
  if (!form) {
    return res.status(404).json({ error: 'Form not found' });
  }
  res.json(form);
}));

/**
 * Mail the centre's manager that a session form was filed. Best-effort: any
 * failure is logged and swallowed, so it can never cost a therapist their form.
 */
async function notifyFormSubmitted(form) {
  try {
    const kid = await therapyService.getKidById(form.kidId);
    if (!kid) return;
    // Go by whose form it is, not who is logged in: the manager often files a
    // form on a therapist's behalf, and that is still news. Only a form recorded
    // as the manager's own session is skipped.
    if (form.practitionerId && form.practitionerId === kid.adminId) {
      console.log('[email] form notification skipped: own form of the manager');
      return;
    }
    const to = emailService.formNotifyRecipient(kid.adminId);
    if (!to) {
      console.log('[email] form notification skipped: no recipient for centre', kid.adminId || '(none)');
      return;
    }
    const practitioner = form.practitionerId
      ? await therapyService.getPractitionerById(form.practitionerId)
      : null;
    await emailService.sendMail({
      to,
      ...emailService.buildFormNotification({
        kidId: form.kidId,
        kidName: kid.name,
        practitionerName: practitioner && practitioner.name,
        sessionDate: form.sessionDate,
        formId: form.id,
      }),
    });
  } catch (err) {
    console.error('[email] form notification failed:', err.message);
  }
}

router.post('/forms', asyncHandler(async (req, res) => {
  const form = await therapyService.submitForm(req.body);
  await notifyFormSubmitted(form);
  res.status(201).json(form);
}));

router.put('/forms/:id', asyncHandler(async (req, res) => {
  const form = await therapyService.updateForm(req.params.id, req.body);
  res.json(form);
}));

router.delete('/forms/:id', asyncHandler(async (req, res) => {
  await therapyService.deleteForm(req.params.id);
  res.status(204).send();
}));

router.post('/forms/create-link', asyncHandler(async (req, res) => {
  const { kidId, sessionId } = req.body;
  const link = await therapyService.createFormLink(kidId, sessionId);
  res.json(link);
}));

// ==================== MEETING FORMS ====================

router.get('/kids/:kidId/meeting-forms', asyncHandler(async (req, res) => {
  let forms = await therapyService.getMeetingFormsForKid(req.params.kidId);
  forms = forms.filter(f => meetingVisibleTo(f.visibility, req.authType));
  res.json(forms);
}));

router.get('/meeting-forms/:id', asyncHandler(async (req, res) => {
  const form = await therapyService.getMeetingFormById(req.params.id);
  if (!form) return res.status(404).json({ error: 'Meeting form not found' });
  if (!meetingVisibleTo(form.visibility, req.authType)) {
    return res.status(403).json({ error: 'אין הרשאה לצפות בישיבה זו' });
  }
  res.json(form);
}));

router.post('/meeting-forms', asyncHandler(async (req, res) => {
  const form = await therapyService.submitMeetingForm(req.body);
  res.status(201).json(form);
}));

router.post('/meeting-forms/autosave', requireAdmin, asyncHandler(async (req, res) => {
  const form = await therapyService.autosaveMeetingForm(req.body);
  res.json(form);
}));

router.put('/meeting-forms/:id/finalize', requireAdmin, asyncHandler(async (req, res) => {
  const form = await therapyService.finalizeMeetingForm(req.params.id, req.body);
  res.json(form);
}));

router.put('/meeting-forms/:id', asyncHandler(async (req, res) => {
  const form = await therapyService.updateMeetingForm(req.params.id, req.body);
  res.json(form);
}));

router.delete('/meeting-forms/:id', asyncHandler(async (req, res) => {
  await therapyService.deleteMeetingForm(req.params.id);
  res.status(204).send();
}));

// ==================== MEETING DRAFTS ====================

router.get('/meeting-drafts', requireAdmin, asyncHandler(async (req, res) => {
  const { kidId, sessionId, formId, sessionDate } = req.query;
  if (!kidId && !sessionId && !formId) {
    return res.status(400).json({ error: 'kidId, sessionId, or formId is required' });
  }
  const draft = await therapyService.getMeetingDraft(req.adminId, {
    kidId, sessionId, formId, sessionDate,
  });
  res.json(draft);
}));

router.put('/meeting-drafts', requireAdmin, asyncHandler(async (req, res) => {
  const { kidId, sessionId, formId, sessionDate, content } = req.body;
  if (!kidId && !sessionId && !formId) {
    return res.status(400).json({ error: 'kidId, sessionId, or formId is required' });
  }
  const draft = await therapyService.upsertMeetingDraft(
    req.adminId,
    { kidId, sessionId, formId, sessionDate },
    content || ''
  );
  res.json(draft);
}));

router.get('/kids/:kidId/meeting-drafts', requireAdmin, asyncHandler(async (req, res) => {
  const drafts = await therapyService.getMeetingDraftsForKid(req.adminId, req.params.kidId);
  res.json(drafts);
}));

router.delete('/meeting-drafts/:id', requireAdmin, asyncHandler(async (req, res) => {
  await therapyService.deleteMeetingDraft(req.adminId, req.params.id);
  res.status(204).send();
}));

// ==================== NOTIFICATIONS ====================

router.post('/notifications', requireAdmin, asyncHandler(async (req, res) => {
  const { kidId, message, targets } = req.body;
  await therapyService.createNotifications(kidId, req.adminId, message, targets);
  res.json({ success: true });
}));

router.get('/notifications/mine', asyncHandler(async (req, res) => {
  let recipientType, recipientId;
  if (req.authType === 'therapist') {
    recipientType = 'practitioner';
    recipientId = req.practitionerId;
  } else if (req.authType === 'parent') {
    recipientType = 'parent';
    recipientId = req.kidViewId;
  } else {
    // Admin has no incoming notifications — return empty rather than 403
    return res.json([]);
  }
  const notifications = await therapyService.getMyNotifications(recipientType, recipientId);
  res.json(notifications);
}));

router.get('/notifications/all-sent', requireAdmin, asyncHandler(async (req, res) => {
  const includeHidden = req.query.includeHidden === 'true';
  const notifications = await therapyService.getAllSentNotifications(req.adminId, { includeHidden });
  res.json(notifications);
}));

router.get('/notifications/sent', requireAdmin, asyncHandler(async (req, res) => {
  const { kidId } = req.query;
  const notifications = await therapyService.getSentNotifications(kidId, req.adminId);
  res.json(notifications);
}));

router.put('/notifications/mine/read-all', asyncHandler(async (req, res) => {
  let recipientType, recipientId;
  if (req.authType === 'therapist') {
    recipientType = 'practitioner'; recipientId = req.practitionerId;
  } else if (req.authType === 'parent') {
    recipientType = 'parent'; recipientId = req.kidViewId;
  } else {
    return res.json({ success: true }); // admin has no incoming notifications
  }
  await therapyService.markAllNotificationsRead(recipientType, recipientId);
  res.json({ success: true });
}));

router.put('/notifications/:id/read', asyncHandler(async (req, res) => {
  // Accept any auth type — notification IDs are unguessable random Firestore IDs
  await therapyService.markNotificationRead(req.params.id);
  res.json({ success: true });
}));

router.put('/notifications/:id/dismiss', asyncHandler(async (req, res) => {
  await therapyService.dismissNotification(req.params.id);
  res.json({ success: true });
}));

router.put('/notifications/:id/admin-dismiss', requireAdmin, asyncHandler(async (req, res) => {
  await therapyService.dismissNotificationByAdmin(req.params.id, req.adminId);
  res.json({ success: true });
}));

router.delete('/notifications/all', requireAdmin, asyncHandler(async (req, res) => {
  const count = await therapyService.deleteAllNotifications(req.adminId);
  res.json({ deleted: count });
}));

router.delete('/notifications/:id', requireAdmin, asyncHandler(async (req, res) => {
  await therapyService.deleteNotification(req.params.id, req.adminId);
  res.status(204).send();
}));

// ==================== SUMMARIES ====================

router.get('/kids/:kidId/summaries', asyncHandler(async (req, res) => {
  const summaries = await therapyService.getSummariesForKid(req.params.kidId);
  res.json(summaries);
}));

router.get('/summaries/:id', asyncHandler(async (req, res) => {
  const summary = await therapyService.getSummaryById(req.params.id);
  if (!summary) return res.status(404).json({ error: 'Summary not found' });
  res.json(summary);
}));

router.post('/summaries', requireAdmin, asyncHandler(async (req, res) => {
  const summary = await therapyService.createSummary({ ...req.body, adminId: req.adminId });
  res.status(201).json(summary);
}));

router.put('/summaries/:id', requireAdmin, asyncHandler(async (req, res) => {
  const summary = await therapyService.updateSummary(req.params.id, req.body);
  res.json(summary);
}));

router.delete('/summaries/:id', requireAdmin, asyncHandler(async (req, res) => {
  await therapyService.deleteSummary(req.params.id);
  res.status(204).send();
}));

// ==================== DOCUMENTS (per kid / general) ====================
// Visibility + role rules live in services/docs.js; req carries authType/adminId/isSuperAdmin/practitionerId/kidViewId.

const docsService = require('../services/docs');
const docsHandler = (fn) => asyncHandler(async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err instanceof docsService.DocError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

router.get('/kids/:kidId/docs', docsHandler(async (req, res) => {
  res.json(await docsService.listForKid(req, req.params.kidId));
}));

router.get('/docs', docsHandler(async (req, res) => {
  if (req.query.scope !== 'general') return res.status(400).json({ error: 'scope=general is required' });
  res.json(await docsService.listGeneral(req));
}));

router.get('/docs/:id', docsHandler(async (req, res) => {
  res.json(await docsService.getDoc(req, req.params.id));
}));

router.post('/docs', requireAdmin, docsHandler(async (req, res) => {
  res.status(201).json(await docsService.createDoc(req, req.body || {}, { source: 'app' }));
}));

router.put('/docs/:id', requireAdmin, docsHandler(async (req, res) => {
  res.json(await docsService.updateDoc(req, req.params.id, req.body || {}));
}));

router.delete('/docs/:id', requireAdmin, docsHandler(async (req, res) => {
  await docsService.deleteDoc(req, req.params.id);
  res.status(204).send();
}));

// ==================== CREW HOURS ====================

router.get('/crew-hours', asyncHandler(async (req, res) => {
  const { from, to, kidId } = req.query;
  // Therapists see only their own hours
  const filterPractitionerId = req.authType === 'therapist' ? req.practitionerId : null;
  const hours = await therapyService.getCrewHours(req.adminId, { from, to, kidId, filterPractitionerId });
  res.json(hours);
}));

// ==================== BOARD REQUESTS ====================

const { createBoardFromRequest } = require('../services/board-generator');

router.get('/board-requests', requireSuperAdmin, asyncHandler(async (req, res) => {
  const requests = await therapyService.getBoardRequests();
  res.json(requests);
}));

router.post('/board-requests/:id/generate', requireSuperAdmin, asyncHandler(async (req, res) => {
  const result = await createBoardFromRequest(req.params.id);
  res.json(result);
}));

router.put('/board-requests/:id', requireSuperAdmin, asyncHandler(async (req, res) => {
  const updated = await therapyService.updateBoardRequest(req.params.id, req.body);
  res.json(updated);
}));

router.delete('/board-requests/:id', requireSuperAdmin, asyncHandler(async (req, res) => {
  await therapyService.deleteBoardRequest(req.params.id);
  res.status(204).send();
}));

// ==================== MEETING VOTES ====================
router.post('/meeting-vote', asyncHandler(async (req, res) => {
  const { name, contact, dates } = req.body || {};
  if (!name || !Array.isArray(dates) || dates.length === 0) {
    return res.status(400).json({ error: 'name and dates are required' });
  }
  const vote = await therapyService.recordMeetingVote({ name, contact, dates });
  res.status(201).json(vote);
}));

router.get('/meeting-votes', requireAdmin, asyncHandler(async (req, res) => {
  const votes = await therapyService.getMeetingVotes();
  res.json(votes);
}));

router.delete('/meeting-votes', requireAdmin, asyncHandler(async (req, res) => {
  const result = await therapyService.clearMeetingVotes();
  res.json(result);
}));

router.delete('/meeting-votes/:id', requireAdmin, asyncHandler(async (req, res) => {
  const result = await therapyService.deleteMeetingVote(req.params.id);
  res.json(result);
}));

// ==================== STUDIO (pictures / videos via Piko, super admin only) ====================

const studio = require('../services/studio');
const piko = require('../services/piko');
const studioHandler = (fn) => asyncHandler(async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err instanceof studio.StudioError) return res.status(err.status).json({ error: err.message });
    if (err instanceof piko.PikoError) {
      console.error('[studio] piko:', err.message);
      return res.status(err.status >= 400 && err.status < 600 ? err.status : 502).json({ error: piko.friendly(err.code), code: err.code });
    }
    console.error('[studio]', err);
    res.status(500).json({ error: 'משהו השתבש. אפשר לנסות שוב.' });
  }
});

router.post('/studio/understand', requireSuperAdmin, studioHandler(async (req, res) => {
  res.json(await studio.understand(req.body?.image));
}));

router.post('/studio/transcribe', requireSuperAdmin, studioHandler(async (req, res) => {
  const { audio, mime, mode } = req.body || {};
  res.json(await studio.transcribe({ audio: String(audio || '').replace(/^data:[^,]*,/, ''), mime, mode }));
}));

router.get('/studio/creations', requireSuperAdmin, studioHandler(async (req, res) => {
  res.json(await studio.list(req));
}));

router.post('/studio/creations', requireSuperAdmin, studioHandler(async (req, res) => {
  res.status(201).json(await studio.create(req, req.body || {}));
}));

router.get('/studio/creations/:id', requireSuperAdmin, studioHandler(async (req, res) => {
  res.json(await studio.get(req, req.params.id));
}));

router.delete('/studio/creations/:id', requireSuperAdmin, studioHandler(async (req, res) => {
  await studio.remove(req, req.params.id);
  res.status(204).send();
}));

router.get('/studio/options', requireSuperAdmin, studioHandler(async (req, res) => {
  res.json(await studio.options());
}));

router.get('/studio/balance', requireSuperAdmin, studioHandler(async (req, res) => {
  res.json(await studio.balance());
}));

// Error handling middleware
router.use((err, req, res, next) => {
  console.error('Therapy API Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

module.exports = router;
