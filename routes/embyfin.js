const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { isBlockedTarget } = require('./proxy');

const router = express.Router();
router.use(requireAuth);

const TIMEOUT_MS = 10_000;

// Emby and Jellyfin's /Items/{Id}/Images/{Type} endpoints return raw binary, not JSON, so — like
// Plex's own image route — this can't go through the generic /api/proxy envelope. Shared between
// both services since the endpoint shape and legacy api_key query auth are identical.
router.get('/:instanceId/image/:itemId/:imageType', async (req, res) => {
  const instance = db.getServiceInstance(req.params.instanceId);
  if (!instance) return res.status(404).end();
  if (instance.service_id !== 'emby' && instance.service_id !== 'jellyfin') return res.status(400).end();

  const baseUrl = instance.preferred_mode === 'remote' && instance.remote_url ? instance.remote_url : instance.local_url;
  if (!baseUrl) return res.status(400).end();

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  const url = new URL(`Items/${req.params.itemId}/Images/${req.params.imageType}`, normalizedBase);
  url.searchParams.set('api_key', instance.credentials.apiKey || '');
  if (req.query.maxWidth) url.searchParams.set('maxWidth', String(req.query.maxWidth));

  if (isBlockedTarget(url.toString())) return res.status(400).end();

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(url, { signal: controller.signal, headers: { Accept: 'image/*' } });
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
