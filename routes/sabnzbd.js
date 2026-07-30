const express = require('express');
const multer = require('multer');
const db = require('../db');
const { requireAuth, requireServiceAccess } = require('../middleware/auth');
const { isBlockedTarget } = require('./proxy');

const router = express.Router();
router.use(requireAuth);
router.use('/:instanceId', requireServiceAccess);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Multipart file upload is a poor fit for the generic JSON proxy, so SABnzbd's addfile gets its
// own small route: receive the .nzb here, then re-post it as multipart to the real instance.
router.post('/:instanceId/upload', upload.single('file'), async (req, res) => {
  const instance = db.getServiceInstance(req.params.instanceId);
  if (!instance) return res.status(404).json({ ok: false, error: 'Service instance not found' });
  if (instance.service_id !== 'sabnzbd') return res.status(400).json({ ok: false, error: 'Not a SABnzbd instance' });
  if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded' });

  const baseUrl = instance.preferred_mode === 'remote' && instance.remote_url ? instance.remote_url : instance.local_url;
  if (!baseUrl) return res.status(400).json({ ok: false, error: 'No URL configured for this service' });
  if (isBlockedTarget(baseUrl)) return res.status(400).json({ ok: false, error: 'Target not allowed' });

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  const url = new URL('api', normalizedBase);
  url.searchParams.set('mode', 'addfile');
  url.searchParams.set('apikey', instance.credentials.apiKey || '');
  url.searchParams.set('output', 'json');

  const form = new FormData();
  form.append('name', new Blob([req.file.buffer]), req.file.originalname);

  try {
    const upstream = await fetch(url, { method: 'POST', body: form });
    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    res.json({ ok: upstream.ok, status: upstream.status, data });
  } catch (e) {
    res.json({ ok: false, status: 0, error: e.message });
  }
});

module.exports = router;
