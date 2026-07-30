const jwt = require('jsonwebtoken');
const db = require('../db');

const COOKIE = 'remotarr_session';
const MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

// DISABLE_AUTH=true skips the sign-in lock entirely, both here and in AppLockGate — for local
// `vite dev`/backend hacking only. This is intentionally its own flag, separate from
// SHOW_ALL_SERVICES (which only controls whether unconfigured services show in the nav menu):
// the two used to be the same flag, which meant every real deployment shipped with auth
// completely disabled by default, since docker-compose.yml ships SHOW_ALL_SERVICES=true out of
// the box. DISABLE_AUTH is unset/false by default — a real deployment always requires sign-in.
const DEV_BYPASS = process.env.DISABLE_AUTH === 'true';

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

// Gates a route whose path starts with an `:instanceId` segment (proxy.js, sabnzbd.js,
// tautulli.js, tracearr.js, plex.js, embyfin.js, torrentUpload.js) against the signed-in
// member's assigned access role, if any. No-ops for admins, in simple mode, and for a member
// with no access role assigned — that last case means "full access", the default every existing
// member effectively already had before access roles existed, so assigning nobody a role changes
// nothing. See db.js's access_roles/access_role_services tables.
function requireServiceAccess(req, res, next) {
  if (DEV_BYPASS || !db.isMultiUser() || !req.user?.userId) return next();
  const user = db.getUserById(req.user.userId);
  if (!user || user.role === 'admin' || !user.access_role_id) return next();
  const instanceId = Number(req.params.instanceId);
  const allowed = db.getAccessRoleServiceIds(user.access_role_id);
  if (allowed.has(instanceId)) return next();
  res.status(403).json({ error: 'Not permitted to access this service' });
}

module.exports = { setAuthCookie, clearAuthCookie, requireAuth, requireAdmin, requireServiceAccess, signToken, COOKIE };
