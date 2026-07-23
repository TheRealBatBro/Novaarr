const jwt = require('jsonwebtoken');
const db = require('../db');

const COOKIE = 'mediaremote_session';
const MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

// SHOW_ALL_SERVICES=true marks this deployment as a dev/testing instance (see docker-compose.yml
// and web/src/lib/visibility.ts's useIsDevEnvironment) — in that mode the PIN/password lock is
// skipped entirely, both here and in AppLockGate, so it never blocks whoever is actively building
// or testing the app. A real deployment (SHOW_ALL_SERVICES unset/false) always requires it.
const DEV_BYPASS = process.env.SHOW_ALL_SERVICES === 'true';

function signToken() {
  return jwt.sign({ ok: true }, db.getJwtSecret(), { expiresIn: '30d' });
}

function setAuthCookie(res, req) {
  const token = signToken();
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });
  return token;
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

function requireAuth(req, res, next) {
  if (DEV_BYPASS) return next();
  const token = req.cookies[COOKIE];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    jwt.verify(token, db.getJwtSecret());
    next();
  } catch {
    clearAuthCookie(res);
    res.status(401).json({ error: 'Session expired' });
  }
}

module.exports = { setAuthCookie, clearAuthCookie, requireAuth, COOKIE };
