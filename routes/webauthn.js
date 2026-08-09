const express = require('express');
const jwt = require('jsonwebtoken');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const db = require('../db');
const { setAuthCookie, requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const { logAction } = require('../lib/audit');

const router = express.Router();
const limiter = rateLimit({ windowMs: 60_000, max: 20 });

// Deployments run at whatever hostname the person put in their browser (local IP, .local
// hostname, a real domain, a Tailscale name) — there's no fixed value to hardcode, so the RP ID
// and origin are derived per-request instead, same spirit as this app's dynamic CSP nonce. WebAuthn
// requires the RP ID to be the hostname exactly (no port, no scheme) and the origin to be the
// full scheme+host+port the browser actually sees.
function rpID(req) {
  return req.hostname;
}
function origin(req) {
  return `${req.protocol}://${req.get('host')}`;
}

// The registration/authentication challenge is round-tripped through a short-lived signed JWT
// instead of server-side session storage — this app has no server-side session store beyond the
// auth cookie itself, and a login-time challenge specifically has no session to hang off of yet
// (the whole point is proving identity to create one). Mirrors auth.js's own pendingToken pattern.
function signChallenge(payload) {
  return jwt.sign(payload, db.getJwtSecret(), { expiresIn: '5m' });
}
function verifyChallenge(token) {
  try {
    return jwt.verify(token, db.getJwtSecret());
  } catch {
    return null;
  }
}

// Resolves "who is registering a passkey right now" the same way TOTP setup does — the shared
// settings identity in simple mode, or the signed-in user's row in multi-user mode.
function currentIdentity(req) {
  if (db.isMultiUser()) {
    if (!req.user?.userId) return null;
    const u = db.getUserById(req.user.userId);
    return u ? { userId: u.id, label: u.username, role: u.role } : null;
  }
  return { userId: null, label: 'admin', role: undefined };
}

router.post('/register/options', requireAuth, async (req, res) => {
  const identity = currentIdentity(req);
  if (!identity) return res.status(404).json({ error: 'Not found' });

  const existing = db.listWebauthnCredentials(identity.userId);
  // @simplewebauthn/server (v9+) needs an explicit userID (the WebAuthn "user handle") — without
  // it, options.user.id comes back undefined and the browser-side library throws trying to
  // base64url-decode it. Derived deterministically per identity rather than randomly generated,
  // so re-registering doesn't need any server-side session state beyond the identity itself.
  const userID = new TextEncoder().encode(identity.userId ? `user-${identity.userId}` : 'simple-mode');
  const options = await generateRegistrationOptions({
    rpName: 'Novaarr',
    rpID: rpID(req),
    userID,
    userName: identity.label,
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({ id: c.credential_id, transports: c.transports })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  });

  res.json({ options, challengeToken: signChallenge({ purpose: 'register', userId: identity.userId, challenge: options.challenge }) });
});

router.post('/register/verify', requireAuth, limiter, async (req, res) => {
  const identity = currentIdentity(req);
  if (!identity) return res.status(404).json({ error: 'Not found' });

  const { response, challengeToken, name } = req.body || {};
  const pending = verifyChallenge(challengeToken);
  if (!pending || pending.purpose !== 'register' || pending.userId !== identity.userId) {
    return res.status(400).json({ error: 'Registration session expired — try again' });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: origin(req),
      expectedRPID: rpID(req),
    });
    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Could not verify passkey' });
    }
    // This installed @simplewebauthn/server version returns a flat registrationInfo
    // (credentialID/credentialPublicKey/counter), not the nested `.credential` shape some other
    // versions/docs use — confirmed by reading the installed package's own source directly.
    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
    db.createWebauthnCredential({
      credentialId: credentialID,
      publicKey: Buffer.from(credentialPublicKey).toString('base64url'),
      counter,
      transports: response.response?.transports || [],
      userId: identity.userId,
      name: (name || 'Passkey').slice(0, 60),
    });
    logAction(req, 'auth.passkey_added');
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message || 'Could not verify passkey' });
  }
});

router.get('/', requireAuth, (req, res) => {
  const identity = currentIdentity(req);
  if (!identity) return res.status(404).json({ error: 'Not found' });
  const creds = db.listWebauthnCredentials(identity.userId);
  res.json(creds.map((c) => ({ id: c.id, name: c.name, createdAt: c.created_at })));
});

router.delete('/:id', requireAuth, (req, res) => {
  const identity = currentIdentity(req);
  if (!identity) return res.status(404).json({ error: 'Not found' });
  db.deleteWebauthnCredential(Number(req.params.id), identity.userId);
  logAction(req, 'auth.passkey_removed');
  res.json({ ok: true });
});

// Login-time endpoints run BEFORE requireAuth — there's no session yet, that's the point.
// allowCredentials is left empty so the browser/OS offers whichever discoverable passkey(s) it
// has for this site, rather than needing a username typed first.
router.post('/login/options', limiter, async (req, res) => {
  const options = await generateAuthenticationOptions({ rpID: rpID(req), userVerification: 'preferred' });
  res.json({ options, challengeToken: signChallenge({ purpose: 'login', challenge: options.challenge }) });
});

router.post('/login/verify', limiter, async (req, res) => {
  const { response, challengeToken } = req.body || {};
  const pending = verifyChallenge(challengeToken);
  if (!pending || pending.purpose !== 'login') {
    return res.status(400).json({ error: 'Login session expired — try again' });
  }

  const stored = db.getWebauthnCredentialByCredentialId(response?.id);
  if (!stored) return res.status(401).json({ error: 'Passkey not recognized' });

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: origin(req),
      expectedRPID: rpID(req),
      // Same flat shape as verifyRegistrationResponse's registrationInfo — the param is called
      // `authenticator` in this version, not `credential`.
      authenticator: {
        credentialID: stored.credential_id,
        credentialPublicKey: Buffer.from(stored.public_key, 'base64url'),
        counter: stored.counter,
        transports: stored.transports,
      },
    });
    if (!verification.verified) return res.status(401).json({ error: 'Could not verify passkey' });
    db.updateWebauthnCredentialCounter(stored.credential_id, verification.authenticationInfo.newCounter);

    db.resetFailedLogins();
    if (stored.user_id) {
      const user = db.getUserById(stored.user_id);
      if (!user) return res.status(401).json({ error: 'Account no longer exists' });
      setAuthCookie(res, req, { userId: user.id, role: user.role });
      db.logAudit({ actorUserId: user.id, actorLabel: user.username, action: 'auth.login', detail: 'passkey', ip: req.ip });
      return res.json({ ok: true, user: { id: user.id, username: user.username, role: user.role } });
    }
    setAuthCookie(res, req);
    db.logAudit({ actorLabel: 'admin', action: 'auth.login', detail: 'passkey', ip: req.ip });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message || 'Could not verify passkey' });
  }
});

module.exports = router;
