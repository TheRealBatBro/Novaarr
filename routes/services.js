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

router.get('/', (_req, res) => {
  res.json(db.listServiceInstances().map(serialize));
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
