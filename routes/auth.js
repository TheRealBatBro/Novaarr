const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { setAuthCookie, clearAuthCookie, requireAuth, COOKIE } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();

// Caps raw request volume per IP; db.js's account-wide lockout (checked inside each handler
// below) is the actual brute-force defense, since it can't be dodged by spreading requests
// across many source IPs the way an IP-scoped limit can.
const credentialLimiter = rateLimit({ windowMs: 60_000, max: 20 });

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
  const multiUser = db.isMultiUser();
  let authenticated = false;
  let user;
  const token = req.cookies[COOKIE];
  if (token) {
    try {
      const payload = jwt.verify(token, settings.jwt_secret);
      authenticated = true;
      if (multiUser && payload.userId) {
        const u = db.getUserById(payload.userId);
        if (u) {
          // Non-null only when the assigned role actually curated a widget list — an empty/no
          // list means "no widget-level restriction," so the dashboard falls back to whatever
          // service-level access already allows (unchanged from before this existed).
          const widgets = u.role !== 'admin' && u.access_role_id ? db.getAccessRoleWidgets(u.access_role_id) : [];
          user = {
            id: u.id,
            username: u.username,
            role: u.role,
            links: db.listUserLinks(u.id),
            widgetKeys: widgets.length > 0 ? widgets.map((w) => w.widgetKey) : null,
          };
        }
      }
    } catch {}
  }
  res.json({ hasCredential, authMode: hasCredential ? settings.auth_mode : null, authenticated, multiUser, user });
});

router.post('/setup', async (req, res) => {
  const settings = db.getSettings();
  if (db.isMultiUser()) return res.status(409).json({ error: 'This deployment uses multi-user sign-in' });
  if (settings.pin_hash) return res.status(409).json({ error: 'A PIN or password is already configured' });
  const { mode, credential } = req.body || {};
  const validationError = validateCredential(mode, credential);
  if (validationError) return res.status(400).json({ error: validationError });
  const hash = await bcrypt.hash(credential, 12);
  db.setCredential(hash, mode);
  setAuthCookie(res, req);
  res.status(201).json({ ok: true });
});

router.post('/login', credentialLimiter, async (req, res) => {
  const settings = db.getSettings();

  const lockedSeconds = db.getLockoutSeconds();
  if (lockedSeconds > 0) {
    res.set('Retry-After', String(lockedSeconds));
    return res.status(429).json({ error: `Too many failed attempts. Try again in ${lockedSeconds}s.`, retryAfter: lockedSeconds });
  }

  if (db.isMultiUser()) {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const user = db.getUserByUsername(username);
    const ok = user && (await bcrypt.compare(password, user.password_hash));
    if (!ok) {
      db.recordFailedLogin();
      return res.status(401).json({ error: 'Incorrect username or password' });
    }
    db.resetFailedLogins();
    setAuthCookie(res, req, { userId: user.id, role: user.role });
    return res.json({ ok: true, user: { id: user.id, username: user.username, role: user.role } });
  }

  if (!settings.pin_hash) return res.status(409).json({ error: 'Not set up yet' });
  const { credential } = req.body || {};
  if (!credential) return res.status(400).json({ error: 'Credential required' });
  const ok = await bcrypt.compare(credential, settings.pin_hash);
  if (!ok) {
    db.recordFailedLogin();
    return res.status(401).json({ error: settings.auth_mode === 'pin' ? 'Incorrect PIN' : 'Incorrect password' });
  }
  db.resetFailedLogins();
  setAuthCookie(res, req);
  res.json({ ok: true });
});

// Opt-in switch from simple mode's single shared PIN/password to per-person accounts — requires
// an authenticated simple-mode session (not multi-user already) and creates the first Admin.
// The caller's own session is immediately re-signed with that admin's identity so they don't get
// logged out by their own request.
router.post('/enable-multi-user', requireAuth, async (req, res) => {
  if (db.isMultiUser()) return res.status(409).json({ error: 'Multi-user mode is already enabled' });
  const { username, password } = req.body || {};
  if (!username || typeof username !== 'string' || username.length < 2 || username.length > 64) {
    return res.status(400).json({ error: 'Username must be 2-64 characters' });
  }
  if (!password || password.length < 6 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be 6-128 characters' });
  }
  if (db.getUserByUsername(username)) return res.status(409).json({ error: 'Username already taken' });
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = db.createUser({ username, passwordHash, role: 'admin' });
  db.setMultiUser(true);
  setAuthCookie(res, req, { userId: admin.id, role: admin.role });
  res.status(201).json({ ok: true, user: admin });
});

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// Changes the credential and/or switches between PIN and password — always requires the
// current credential, regardless of whether the mode is also changing.
router.post('/change-credential', requireAuth, credentialLimiter, async (req, res) => {
  if (db.isMultiUser()) return res.status(409).json({ error: 'Use user management in multi-user mode' });
  const settings = db.getSettings();

  const lockedSeconds = db.getLockoutSeconds();
  if (lockedSeconds > 0) {
    res.set('Retry-After', String(lockedSeconds));
    return res.status(429).json({ error: `Too many failed attempts. Try again in ${lockedSeconds}s.`, retryAfter: lockedSeconds });
  }

  const { current, newMode, newCredential } = req.body || {};
  if (!current || !newCredential) return res.status(400).json({ error: 'current and newCredential are required' });
  const ok = await bcrypt.compare(current, settings.pin_hash);
  if (!ok) {
    db.recordFailedLogin();
    return res.status(401).json({ error: settings.auth_mode === 'pin' ? 'Incorrect current PIN' : 'Incorrect current password' });
  }
  db.resetFailedLogins();
  const validationError = validateCredential(newMode, newCredential);
  if (validationError) return res.status(400).json({ error: validationError });
  const hash = await bcrypt.hash(newCredential, 12);
  db.setCredential(hash, newMode);
  res.json({ ok: true });
});

module.exports = router;
