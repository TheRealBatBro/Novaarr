const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const notify = require('../lib/notify');
const { EVENTS } = require('../lib/notificationEvents');

// Outbound alert channels are deployment-wide (a Telegram bot/Discord webhook belongs to
// whoever runs this deployment, not to any one signed-in person) — admin-only, same as
// Services/Backup, in multi-user mode; a no-op gate in simple mode same as everywhere else.
const router = express.Router();
router.use(requireAuth);
router.use(requireAdmin);

function serializeChannel(c) {
  const { config, ...rest } = c;
  return rest;
}

router.get('/channels', (_req, res) => {
  res.json(db.listNotificationChannels().map(serializeChannel));
});

router.get('/channel-types', (_req, res) => {
  res.json(notify.CHANNEL_TYPES);
});

router.post('/channels', (req, res) => {
  const { type, name, config, enabled } = req.body || {};
  if (!notify.CHANNEL_TYPES.includes(type)) return res.status(400).json({ error: `Unknown channel type "${type}"` });
  const channel = db.createNotificationChannel({ type, name, config, enabled });
  res.status(201).json(serializeChannel(channel));
});

router.put('/channels/:id', (req, res) => {
  const channel = db.updateNotificationChannel(Number(req.params.id), req.body || {});
  if (!channel) return res.status(404).json({ error: 'Not found' });
  res.json(serializeChannel(channel));
});

router.delete('/channels/:id', (req, res) => {
  db.deleteNotificationChannel(Number(req.params.id));
  res.json({ ok: true });
});

router.post('/channels/:id/test', async (req, res) => {
  const channel = db.getNotificationChannel(Number(req.params.id));
  if (!channel) return res.status(404).json({ error: 'Not found' });
  try {
    await notify.sendTest(channel);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message || 'Failed to send test notification' });
  }
});

router.get('/events', (_req, res) => {
  const disabled = new Set(db.getDisabledNotificationEvents());
  res.json(EVENTS.map((e) => ({ ...e, enabled: !disabled.has(e.key) })));
});

router.put('/events', (req, res) => {
  const { disabledKeys } = req.body || {};
  if (!Array.isArray(disabledKeys)) return res.status(400).json({ error: 'disabledKeys must be an array' });
  db.setDisabledNotificationEvents(disabledKeys.filter((k) => typeof k === 'string'));
  res.json({ ok: true });
});

module.exports = router;
