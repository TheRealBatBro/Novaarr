const jwt = require('jsonwebtoken');
const db = require('../db');
const cloudflareAccess = require('../lib/cloudflareAccess');

const COOKIE = 'novaarr_session';
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

// Resolves a verified Cloudflare Access email to a Novaarr identity. Simple mode has only one
// identity, so any verified Access login is that identity. Multi-user mode needs an explicit
// admin-configured link (users.cf_access_email) — there's no safe way to auto-provision a role
// from an email alone, so an unmatched email is refused rather than guessed at.
function resolveCloudflareAccessUser(email) {
  if (!db.isMultiUser()) return { ok: true };
  const user = db.getUserByCfAccessEmail(email);
  return user ? { userId: user.id, role: user.role } : null;
}

// Verifies a Cf-Access-Jwt-Assertion header (if Cloudflare Access is configured and the header
// is present) and resolves it to a Novaarr identity. Returns null — never throws — on any
// failure (not configured, no header, invalid/expired JWT, or no matching account), so callers
// can always fall back to the app's own cookie-based check without special-casing errors.
// `denied` distinguishes "a valid Access login with no linked Novaarr account" (worth a 403
// with a clear message) from "Access isn't in play for this request at all" (silently fall
// through) — both resolve to a falsy `user`, but only one should short-circuit with an error.
async function tryCloudflareAccess(req) {
  if (!cloudflareAccess.enabled) return { user: null, denied: false };
  const assertion = req.headers['cf-access-jwt-assertion'];
  if (!assertion) return { user: null, denied: false };
  try {
    const payload = await cloudflareAccess.verifyAccessToken(assertion);
    const user = resolveCloudflareAccessUser(payload.email);
    // Cloudflare Access issues its own JWT with its own lifetime, entirely outside this app's
    // cookie — without this check, "Sign out everywhere else" (and a credential change) would
    // have zero effect on anyone signed in via Access, since nothing here ever consulted the
    // revocation floor those actions move forward. Access's token still carries a standard `iat`,
    // so the same isTokenRevoked check applies here as it does to the app's own session cookie.
    if (user && db.isTokenRevoked({ ...user, iat: payload.iat })) {
      return { user: null, denied: false };
    }
    return { user, denied: !user, email: payload.email };
  } catch {
    return { user: null, denied: false };
  }
}

async function requireAuth(req, res, next) {
  if (DEV_BYPASS) return next();

  const access = await tryCloudflareAccess(req);
  if (access.denied) {
    return res.status(403).json({ error: `No Novaarr account is linked to ${access.email}. Ask an admin to link it in Settings > Users.` });
  }
  if (access.user) {
    req.user = access.user;
    req.cfAccessEmail = access.email;
    return next();
  }

  const token = req.cookies[COOKIE];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const decoded = jwt.verify(token, db.getJwtSecret());
    if (db.isTokenRevoked(decoded)) {
      clearAuthCookie(res);
      return res.status(401).json({ error: 'Session expired' });
    }
    req.user = decoded;
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
  const allowed = db.getAccessRoleAllowedInstanceIds(user.access_role_id);
  if (allowed.has(instanceId)) return next();
  res.status(403).json({ error: 'Not permitted to access this service' });
}

module.exports = { setAuthCookie, clearAuthCookie, requireAuth, requireAdmin, requireServiceAccess, signToken, tryCloudflareAccess, COOKIE };
