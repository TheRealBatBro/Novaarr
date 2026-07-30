const express = require('express');
const db = require('../db');
const { requireAuth, requireServiceAccess } = require('../middleware/auth');
const { isBlockedTarget } = require('./proxy');

const router = express.Router();
router.use(requireAuth);
router.use('/:instanceId', requireServiceAccess);

const TIMEOUT_MS = 10_000;

// Tracearr's `posterUrl` fields are relative paths into its own authenticated image proxy
// (`/api/v1/images/proxy?server=...&url=...`) — binary image data, so (like Tautulli) it can't
// go through the generic /api/proxy envelope. `path` here is that relative path+query verbatim.
router.get('/:instanceId/image', async (req, res) => {
  const instance = db.getServiceInstance(req.params.instanceId);
  if (!instance) return res.status(404).end();
  if (instance.service_id !== 'tracearr') return res.status(400).end();
  const path = req.query.path;
  if (!path || !path.startsWith('/')) return res.status(400).end();

  const baseUrl = instance.preferred_mode === 'remote' && instance.remote_url ? instance.remote_url : instance.local_url;
  if (!baseUrl) return res.status(400).end();

  const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : baseUrl + '/');
  if (isBlockedTarget(url.toString())) return res.status(400).end();

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(url, { headers: { Authorization: `Bearer ${instance.credentials.apiKey || ''}` }, signal: controller.signal });
    if (!upstream.ok) return res.status(upstream.status).end();
    res.set('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'private, max-age=3600');
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.status(502).end();
  } finally {
    clearTimeout(t);
  }
});

module.exports = router;
