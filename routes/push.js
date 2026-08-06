const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { ensureVapidKeys, sendPushToAll } = require('../lib/pushNotify');

const router = express.Router();
router.use(requireAuth);

router.get('/vapid-public-key', (_req, res) => {
  res.json({ publicKey: ensureVapidKeys().publicKey });
});

router.post('/subscribe', (req, res) => {
  const { endpoint, keys } = req.body?.subscription || req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }
  db.upsertPushSubscription({ endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: req.user?.userId });
  res.json({ ok: true });
});

router.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body || {};
  if (endpoint) db.removePushSubscription(endpoint);
  res.json({ ok: true });
});

router.post('/test', async (req, res) => {
  await sendPushToAll({ title: 'Novaarr', body: 'Test notification — push is working.', tag: 'test' });
  res.json({ ok: true });
});

module.exports = router;
