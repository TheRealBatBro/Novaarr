const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function serialize(instance) {
  return {
    id: instance.id,
    serviceId: instance.service_id,
    displayName: instance.display_name,
    authType: instance.auth_type,
    localUrl: instance.local_url,
    remoteUrl: instance.remote_url,
    preferredMode: instance.preferred_mode,
    credentials: instance.credentials,
    customHeaders: instance.custom_headers,
    wolMac: instance.wol_mac,
    wolBroadcast: instance.wol_broadcast,
    favorite: !!instance.favorite,
    sortOrder: instance.sort_order,
    enabled: !!instance.enabled,
    refreshIntervalMinutes: instance.refresh_interval_minutes,
  };
}

// A member restricted to an access role only sees/reaches the services that role includes —
// every screen that lists services (nav, dashboard widgets, menu, calendar, command palette)
// derives entirely from this one response, so filtering here is what actually hides them.
// requireServiceAccess (middleware/auth.js) is the matching enforcement on the per-instance
// proxy/image routes, so a restricted member can't just call one of those directly either.
function isRestrictedMember(req) {
  if (!db.isMultiUser() || !req.user?.userId) return null;
  const user = db.getUserById(req.user.userId);
  if (!user || user.role === 'admin' || !user.access_role_id) return null;
  return user;
}

router.get('/', (req, res) => {
  let instances = db.listServiceInstances();
  const restricted = isRestrictedMember(req);
  if (restricted) {
    const allowed = db.getAccessRoleServiceIds(restricted.access_role_id);
    instances = instances.filter((i) => allowed.has(i.id));
  }
  const serialized = instances.map(serialize);
  // Credentials/API keys are only needed by the admin-only edit form — stripped for everyone else.
  if (restricted) serialized.forEach((s) => (s.credentials = {}));
  res.json(serialized);
});

router.post('/', requireAdmin, (req, res) => {
  const { serviceId, displayName, authType } = req.body || {};
  if (!serviceId || !displayName || !authType) {
    return res.status(400).json({ error: 'serviceId, displayName, and authType are required' });
  }
  const created = db.createServiceInstance(req.body);
  res.status(201).json(serialize(created));
});

router.put('/:id', requireAdmin, (req, res) => {
  const updated = db.updateServiceInstance(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(serialize(updated));
});

router.delete('/:id', requireAdmin, (req, res) => {
  db.deleteServiceInstance(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
