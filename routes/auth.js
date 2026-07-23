const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { setAuthCookie, clearAuthCookie, requireAuth, COOKIE } = require('../middleware/auth');

const router = express.Router();

// Shared by setup (new credential) and change-credential (its new-credential half) — login
// only ever compares against a hash, so it doesn't need this.
function validateCredential(mode, value) {
  if (mode === 'pin') {
    if (!/^\d{4,8}$/.test(value || '')) return 'PIN must be 4-8 digits';
  } else if (mode === 'password') {
    if (!value || value.length < 6 || value.length > 128) return 'Password must be 6-128 characters';
  } else {
    return 'mode must be "pin" or "password"';
  }
  return null;
}

router.get('/status', (req, res) => {
  const settings = db.getSettings();
  const hasCredential = !!settings.pin_hash;
  let authenticated = false;
  const token = req.cookies[COOKIE];
  if (token) {
    try {
      jwt.verify(token, settings.jwt_secret);
      authenticated = true;
    } catch {}
  }
  res.json({ hasCredential, authMode: hasCredential ? settings.auth_mode : null, authenticated });
});

router.post('/setup', async (req, res) => {
  const settings = db.getSettings();
  if (settings.pin_hash) return res.status(409).json({ error: 'A PIN or password is already configured' });
  const { mode, credential } = req.body || {};
  const validationError = validateCredential(mode, credential);
  if (validationError) return res.status(400).json({ error: validationError });
  const hash = await bcrypt.hash(credential, 12);
  db.setCredential(hash, mode);
  setAuthCookie(res, req);
  res.status(201).json({ ok: true });
});

router.post('/login', async (req, res) => {
  const settings = db.getSettings();
  if (!settings.pin_hash) return res.status(409).json({ error: 'Not set up yet' });
  const { credential } = req.body || {};
  if (!credential) return res.status(400).json({ error: 'Credential required' });
  const ok = await bcrypt.compare(credential, settings.pin_hash);
  if (!ok) return res.status(401).json({ error: settings.auth_mode === 'pin' ? 'Incorrect PIN' : 'Incorrect password' });
  setAuthCookie(res, req);
  res.json({ ok: true });
});

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// Changes the credential and/or switches between PIN and password — always requires the
// current credential, regardless of whether the mode is also changing.
router.post('/change-credential', requireAuth, async (req, res) => {
  const settings = db.getSettings();
  const { current, newMode, newCredential } = req.body || {};
  if (!current || !newCredential) return res.status(400).json({ error: 'current and newCredential are required' });
  const ok = await bcrypt.compare(current, settings.pin_hash);
  if (!ok) return res.status(401).json({ error: settings.auth_mode === 'pin' ? 'Incorrect current PIN' : 'Incorrect current password' });
  const validationError = validateCredential(newMode, newCredential);
  if (validationError) return res.status(400).json({ error: validationError });
  const hash = await bcrypt.hash(newCredential, 12);
  db.setCredential(hash, newMode);
  res.json({ ok: true });
});

module.exports = router;
