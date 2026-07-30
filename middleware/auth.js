const jwt = require('jsonwebtoken');
const db = require('../db');

const COOKIE = 'remotarr_session';
const MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

// SHOW_ALL_SERVICES=true marks this deployment as a dev/testing instance (see docker-compose.yml
// and web/src/lib/visibility.ts's useIsDevEnvironment) — in that mode the PIN/password lock is
// skipped entirely, both here and in AppLockGate, so it never blocks whoever is actively building
// or testing the app. A real deployment (SHOW_ALL_SERVICES unset/false) always requires it.
const DEV_BYPASS = process.env.SHOW_ALL_SERVICES === 'true';

// Simple mode (the only mode that existed before multi-user) keeps signing {ok: true} — no user
// identity at all. Multi-user mode instead carries {userId, role}, so requireAuth/requireAdmin
// below can tell who's signed in and what they're allowed to do.
function signToken(payload = { ok: true }) {
  return jwt.sign(payload, db.getJwtSecret(), { expiresIn: '30d' });
}

function setAuthCookie(res, req, payload) {
  const token = signToken(payload);
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
    req.user = jwt.verify(token, db.getJwtSecret());
    next();
  } catch {
    clearAuthCookie(res);
    res.status(401).json({ error: 'Session expired' });
  }
}

// No-ops in simple mode (and under the dev bypass) — there's no "admin" concept until a
// deployment opts into multi-user mode, at which point only an admin-role session passes.
function requireAdmin(req, res, next) {
  if (DEV_BYPASS || !db.isMultiUser()) return next();
  if (req.user?.role === 'admin') return next();
  res.status(403).json({ error: 'Admin access required' });
}

module.exports = { setAuthCookie, clearAuthCookie, requireAuth, requireAdmin, signToken, COOKIE };
