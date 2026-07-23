const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { isBlockedTarget } = require('./proxy');

const router = express.Router();
router.use(requireAuth);

const TIMEOUT_MS = 10_000;

// Tautulli's poster/art thumbnails are relative Plex library paths that only resolve through
// Tautulli's own pms_image_proxy — and unlike every other integration here, the response is raw
// binary image data, not JSON, so it can't go through the generic /api/proxy envelope (which
// always reads the body as text/JSON). This route streams the image straight through instead.
router.get('/:instanceId/image', async (req, res) => {
  const instance = db.getServiceInstance(req.params.instanceId);
  if (!instance) return res.status(404).end();
  if (instance.service_id !== 'tautulli') return res.status(400).end();
  const img = req.query.img;
  if (!img) return res.status(400).end();

  const baseUrl = instance.preferred_mode === 'remote' && instance.remote_url ? instance.remote_url : instance.local_url;
  if (!baseUrl) return res.status(400).end();

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  const url = new URL('api/v2', normalizedBase);
  url.searchParams.set('apikey', instance.credentials.apiKey || '');
  url.searchParams.set('cmd', 'pms_image_proxy');
  url.searchParams.set('img', img);
  if (req.query.width) url.searchParams.set('width', req.query.width);
  if (req.query.height) url.searchParams.set('height', req.query.height);

  if (isBlockedTarget(url.toString())) return res.status(400).end();

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(url, { signal: controller.signal });
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
