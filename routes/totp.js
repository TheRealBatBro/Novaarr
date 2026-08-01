const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const totp = require('../lib/totp');
const { logAction } = require('../lib/audit');

const router = express.Router();
router.use(requireAuth);

const codeLimiter = rateLimit({ windowMs: 60_000, max: 20 });

// Operates on the caller's own identity — simple mode's single shared settings row, or the
// signed-in user's row in multi-user mode. There's no admin-manages-someone-else's-2FA flow;
// like a password, this is something each identity controls for itself.
function currentRecord(req) {
  if (db.isMultiUser()) {
    if (!req.user?.userId) return null;
    const row = db.getUserById(req.user.userId);
    return row ? { kind: 'user', id: row.id, row } : null;
  }
  return { kind: 'settings', id: null, row: db.getSettings() };
}

function freshRow(ctx) {
  return ctx.kind === 'user' ? db.getUserById(ctx.id) : db.getSettings();
}

router.get('/', (req, res) => {
  const ctx = currentRecord(req);
  if (!ctx) return res.status(404).json({ error: 'Not found' });
  const backupCodes = ctx.row.totp_backup_codes ? JSON.parse(ctx.row.totp_backup_codes) : [];
  res.json({ enabled: !!ctx.row.totp_enabled, backupCodesRemaining: backupCodes.length });
});

router.post('/setup', async (req, res) => {
  const ctx = currentRecord(req);
  if (!ctx) return res.status(404).json({ error: 'Not found' });
  const secret = totp.generateSecret();
  const label = ctx.kind === 'user' ? ctx.row.username : 'Remotarr';
  const uri = totp.keyUri(secret, label);
  const qr = await totp.qrDataUrl(uri);
  if (ctx.kind === 'user') db.setUserTotpPending(ctx.id, secret);
  else db.setSettingsTotpPending(secret);
  res.json({ secret, uri, qr });
});

router.post('/enable', codeLimiter, async (req, res) => {
  const { code } = req.body || {};
  const ctx = currentRecord(req);
  if (!ctx) return res.status(404).json({ error: 'Not found' });
  const fresh = freshRow(ctx);
  if (!fresh.totp_secret) return res.status(400).json({ error: 'Start setup first' });
  if (!totp.verifyCode(fresh.totp_secret, code)) return res.status(401).json({ error: 'Incorrect code' });

  const backupCodes = totp.generateBackupCodes();
  const hashed = await totp.hashBackupCodes(backupCodes);
  if (ctx.kind === 'user') db.enableUserTotp(ctx.id, hashed);
  else db.enableSettingsTotp(hashed);
  logAction(req, 'auth.2fa_enabled');
  res.json({ ok: true, backupCodes });
});

router.post('/disable', codeLimiter, async (req, res) => {
  const { code } = req.body || {};
  const ctx = currentRecord(req);
  if (!ctx) return res.status(404).json({ error: 'Not found' });
  const fresh = freshRow(ctx);
  if (!fresh.totp_enabled) return res.status(409).json({ error: 'Two-factor authentication is not enabled' });

  const validCode = totp.verifyCode(fresh.totp_secret, code);
  const remaining = !validCode && fresh.totp_backup_codes ? await totp.consumeBackupCode(JSON.parse(fresh.totp_backup_codes), code) : null;
  if (!validCode && !remaining) return res.status(401).json({ error: 'Incorrect code' });

  if (ctx.kind === 'user') db.disableUserTotp(ctx.id);
  else db.disableSettingsTotp();
  logAction(req, 'auth.2fa_disabled');
  res.json({ ok: true });
});

module.exports = router;
