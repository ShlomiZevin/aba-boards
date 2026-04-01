const express = require('express');
const router = express.Router();
const multer = require('multer');
const therapyService = require('../services/therapy');
const { requireAdmin, requireSuperAdmin } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ==================== AI CHAT ====================

const { handleChat } = require('../services/chat-center');

router.post('/chat', asyncHandler(async (req, res) => {
  const { messages, kidId, stream, saveSummaryOnly } = req.body;
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
      const result = await handleChat(req.adminId, messages, effectiveKidId, onToolStatus, source, practitionerId, parentKidId, { saveSummaryOnly });
      res.write(`data: ${JSON.stringify({ type: 'done', ...result })}\n\n`);
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
    }
    res.end();
  } else {
    // Regular JSON response (backwards compatible)
    const result = await handleChat(req.adminId, messages, effectiveKidId, null, source, practitionerId, parentKidId, { saveSummaryOnly });
    res.json(result);
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
  const entry = await therapyService.updateGoalDataEntry(
    req.params.kidId,
    req.params.goalLibraryId,
    req.params.entryId,
    req.body
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

// ==================== SESSIONS ====================

router.get('/kids/:kidId/sessions', asyncHandler(async (req, res) => {
  const filters = {
    from: req.query.from,
    to: req.query.to,
    status: req.query.status,
  };
  const sessions = await therapyService.getSessionsForKid(req.params.kidId, filters);
  res.json(sessions);
}));

router.post('/kids/:kidId/sessions', asyncHandler(async (req, res) => {
  const session = await therapyService.scheduleSession(req.params.kidId, req.body);
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

router.post('/forms', asyncHandler(async (req, res) => {
  const form = await therapyService.submitForm(req.body);
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
  const forms = await therapyService.getMeetingFormsForKid(req.params.kidId);
  res.json(forms);
}));

router.get('/meeting-forms/:id', asyncHandler(async (req, res) => {
  const form = await therapyService.getMeetingFormById(req.params.id);
  if (!form) return res.status(404).json({ error: 'Meeting form not found' });
  res.json(form);
}));

router.post('/meeting-forms', asyncHandler(async (req, res) => {
  const form = await therapyService.submitMeetingForm(req.body);
  res.status(201).json(form);
}));

router.put('/meeting-forms/:id', asyncHandler(async (req, res) => {
  const form = await therapyService.updateMeetingForm(req.params.id, req.body);
  res.json(form);
}));

router.delete('/meeting-forms/:id', asyncHandler(async (req, res) => {
  await therapyService.deleteMeetingForm(req.params.id);
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

// ==================== CREW HOURS ====================

router.get('/crew-hours', asyncHandler(async (req, res) => {
  const { from, to, kidId } = req.query;
  const hours = await therapyService.getCrewHours(req.adminId, { from, to, kidId });
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

// Error handling middleware
router.use((err, req, res, next) => {
  console.error('Therapy API Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

module.exports = router;
