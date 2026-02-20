const express = require('express');
const router = express.Router();
const therapyService = require('../services/therapy');

// Error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ==================== KIDS ====================

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

router.get('/goals/library', asyncHandler(async (req, res) => {
  const search = req.query.search || '';
  if (search.length < 3) {
    return res.json([]);
  }
  const results = await therapyService.searchGoalsLibrary(search);
  res.json(results);
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

// Error handling middleware
router.use((err, req, res, next) => {
  console.error('Therapy API Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

module.exports = router;
