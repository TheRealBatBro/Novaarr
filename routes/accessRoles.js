const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { logAction } = require('../lib/audit');

const router = express.Router();
router.use(requireAuth);
router.use(requireAdmin);

function validateName(name, excludeId) {
  if (!name || typeof name !== 'string' || name.length < 1 || name.length > 64) return 'Name must be 1-64 characters';
  const existing = db.listAccessRoles().find((r) => r.name.toLowerCase() === name.toLowerCase());
  if (existing && existing.id !== excludeId) return 'A role with this name already exists';
  return null;
}

function validateInstanceIds(instanceIds) {
  if (instanceIds === undefined) return null;
  if (!Array.isArray(instanceIds)) return 'instanceIds must be an array';
  for (const id of instanceIds) {
    if (!db.getServiceInstance(id)) return `Service instance ${id} not found`;
  }
  return null;
}

function validateWidgets(widgets) {
  if (widgets === undefined) return null;
  if (!Array.isArray(widgets)) return 'widgets must be an array';
  for (const w of widgets) {
    if (!w || typeof w.widgetKey !== 'string' || !w.widgetKey) return 'Each widget needs a widgetKey';
    if (!db.getServiceInstance(w.instanceId)) return `Service instance ${w.instanceId} not found`;
  }
  return null;
}

router.get('/', (_req, res) => {
  res.json(db.listAccessRoles());
});

router.post('/', (req, res) => {
  const { name, instanceIds, widgets, calendarSourceIds } = req.body || {};
  const nameError = validateName(name);
  if (nameError) return res.status(400).json({ error: nameError });
  const instanceError = validateInstanceIds(instanceIds);
  if (instanceError) return res.status(400).json({ error: instanceError });
  const widgetError = validateWidgets(widgets);
  if (widgetError) return res.status(400).json({ error: widgetError });
  const calendarError = validateInstanceIds(calendarSourceIds);
  if (calendarError) return res.status(400).json({ error: calendarError });
  const created = db.createAccessRole(name, instanceIds || [], widgets || [], calendarSourceIds || []);
  logAction(req, 'access_role.created', { target: `access_role:${created.id}`, detail: created.name });
  res.status(201).json(created);
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!db.getAccessRoleById(id)) return res.status(404).json({ error: 'Not found' });
  const { name, instanceIds, widgets, calendarSourceIds } = req.body || {};
  if (name !== undefined) {
    const nameError = validateName(name, id);
    if (nameError) return res.status(400).json({ error: nameError });
  }
  const instanceError = validateInstanceIds(instanceIds);
  if (instanceError) return res.status(400).json({ error: instanceError });
  const widgetError = validateWidgets(widgets);
  if (widgetError) return res.status(400).json({ error: widgetError });
  const calendarError = validateInstanceIds(calendarSourceIds);
  if (calendarError) return res.status(400).json({ error: calendarError });
  const updated = db.updateAccessRole(id, { name, instanceIds, widgets, calendarSourceIds });
  logAction(req, 'access_role.updated', { target: `access_role:${id}`, detail: updated.name });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.getAccessRoleById(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.deleteAccessRole(id);
  logAction(req, 'access_role.deleted', { target: `access_role:${id}`, detail: existing.name });
  res.json({ ok: true });
});

module.exports = router;
