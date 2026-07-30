const express = require('express');
const db = require('../db');
const { requireAuth, requireServiceAccess } = require('../middleware/auth');
const { isBlockedTarget } = require('./proxy');

const router = express.Router();
router.use(requireAuth);
router.use('/:instanceId', requireServiceAccess);

const TIMEOUT_MS = 10_000;

// Plex serves thumb/art images directly at a relative library path (e.g.
// /library/metadata/12345/thumb/167234) once given a valid token — unlike Tautulli there's no
// separate "image proxy" command, but the response is still raw binary, not JSON, so (like
// Tautulli's own image route) it can't go through the generic /api/proxy envelope.
router.get('/:instanceId/image', async (req, res) => {
  const instance = db.getServiceInstance(req.params.instanceId);
  if (!instance) return res.status(404).end();
  if (instance.service_id !== 'plex') return res.status(400).end();
  const path = req.query.path;
  if (!path) return res.status(400).end();

  const baseUrl = instance.preferred_mode === 'remote' && instance.remote_url ? instance.remote_url : instance.local_url;
  if (!baseUrl) return res.status(400).end();

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  const url = new URL(String(path).replace(/^\//, ''), normalizedBase);
  url.searchParams.set('X-Plex-Token', instance.credentials.apiKey || '');

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
