const express = require('express');
const multer = require('multer');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { isBlockedTarget } = require('./proxy');

const router = express.Router();
router.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// qBittorrent and µTorrent both need a genuine multipart/form-data POST to add a .torrent file
// (unlike Deluge/Transmission/ruTorrent, which accept base64-in-JSON over their normal RPC) — a
// poor fit for the generic JSON proxy, so they get their own route here, same pattern as
// routes/sabnzbd.js's addfile.

function baseUrlFor(instance) {
  return instance.preferred_mode === 'remote' && instance.remote_url ? instance.remote_url : instance.local_url;
}

function firstCookie(res) {
  if (typeof res.headers.getSetCookie === 'function') {
    const cookies = res.headers.getSetCookie();
    return cookies.length ? cookies.map((c) => c.split(';')[0]).join('; ') : null;
  }
  const raw = res.headers.get('set-cookie');
  return raw ? raw.split(';')[0] : null;
}

async function uploadQbittorrent(instance, file) {
  const normalizedBase = baseUrlFor(instance).endsWith('/') ? baseUrlFor(instance) : baseUrlFor(instance) + '/';
  const { username, password } = instance.credentials || {};

  const loginRes = await fetch(new URL('api/v2/auth/login', normalizedBase), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: username || '', password: password || '' }).toString(),
  });
  const cookie = firstCookie(loginRes);

  const form = new FormData();
  form.append('torrents', new Blob([file.buffer]), file.originalname);
  const upstream = await fetch(new URL('api/v2/torrents/add', normalizedBase), {
    method: 'POST',
    headers: cookie ? { Cookie: cookie } : {},
    body: form,
  });
  const text = await upstream.text();
  return { ok: upstream.ok, status: upstream.status, data: text };
}

async function uploadUtorrent(instance, file) {
  const normalizedBase = baseUrlFor(instance).endsWith('/') ? baseUrlFor(instance) : baseUrlFor(instance) + '/';
  const { username, password } = instance.credentials || {};
  const authHeader = { Authorization: 'Basic ' + Buffer.from(`${username || ''}:${password || ''}`).toString('base64') };

  const tokenRes = await fetch(new URL('gui/token.html', normalizedBase), { headers: authHeader });
  const tokenText = await tokenRes.text();
  const match = tokenText.match(/id=['"]token['"][^>]*>([^<]+)</);
  const token = match ? match[1] : '';
  const cookie = firstCookie(tokenRes);

  const addUrl = new URL('gui/', normalizedBase);
  addUrl.searchParams.set('action', 'add-file');
  addUrl.searchParams.set('token', token);

  const form = new FormData();
  form.append('torrent_file', new Blob([file.buffer]), file.originalname);
  const upstream = await fetch(addUrl, {
    method: 'POST',
    headers: { ...authHeader, ...(cookie ? { Cookie: cookie } : {}) },
    body: form,
  });
  const text = await upstream.text();
  return { ok: upstream.ok, status: upstream.status, data: text };
}

const UPLOADERS = { qbittorrent: uploadQbittorrent, utorrent: uploadUtorrent };

router.post('/:instanceId', upload.single('file'), async (req, res) => {
  const instance = db.getServiceInstance(req.params.instanceId);
  if (!instance) return res.status(404).json({ ok: false, error: 'Service instance not found' });
  if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded' });

  const uploader = UPLOADERS[instance.service_id];
  if (!uploader) return res.status(400).json({ ok: false, error: `File upload not supported for "${instance.service_id}"` });

  const baseUrl = baseUrlFor(instance);
  if (!baseUrl) return res.status(400).json({ ok: false, error: 'No URL configured for this service' });
  if (isBlockedTarget(baseUrl)) return res.status(400).json({ ok: false, error: 'Target not allowed' });

  try {
    res.json(await uploader(instance, req.file));
  } catch (e) {
    res.json({ ok: false, status: 0, error: e.message });
  }
});

module.exports = router;
