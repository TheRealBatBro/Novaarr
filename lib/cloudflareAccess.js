const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Opt-in: unset by default, so a deployment that hasn't configured Cloudflare Access behaves
// exactly as before. When both are set, Cloudflare Access becomes an additional way in — SSO
// through Cloudflare's own login (which can carry its own 2FA/identity provider), verified
// against Cloudflare's public keys rather than trusted blindly from a header. Never REQUIRED:
// the app's own PIN/password/TOTP still works too, e.g. for LAN access that bypasses the tunnel.
const TEAM_DOMAIN = process.env.CF_ACCESS_TEAM_DOMAIN; // e.g. "myteam.cloudflareaccess.com"
const AUD = process.env.CF_ACCESS_AUD; // the Access application's Audience (AUD) tag
const enabled = !!(TEAM_DOMAIN && AUD);

let cachedKeys = null;
let cachedAt = 0;
const CACHE_MS = 60 * 60 * 1000;

async function getKeys(forceRefresh) {
  if (!forceRefresh && cachedKeys && Date.now() - cachedAt < CACHE_MS) return cachedKeys;
  const res = await fetch(`https://${TEAM_DOMAIN}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`Failed to fetch Cloudflare Access certs (HTTP ${res.status})`);
  const data = await res.json();
  cachedKeys = data.keys || [];
  cachedAt = Date.now();
  return cachedKeys;
}

// Verifies the signature, audience, and issuer of a Cf-Access-Jwt-Assertion header value.
// Returns the decoded payload (has .email) on success, throws on any failure — a malformed
// token, an unknown/rotated signing key, or a mismatched audience/issuer are all treated the
// same way by the caller: not authenticated via Access, fall back to the app's own sign-in.
async function verifyAccessToken(token) {
  if (!enabled) throw new Error('Cloudflare Access is not configured');
  const decoded = jwt.decode(token, { complete: true });
  const kid = decoded?.header?.kid;
  if (!kid) throw new Error('Malformed Access token');

  let keys = await getKeys();
  let jwk = keys.find((k) => k.kid === kid);
  if (!jwk) {
    // Cloudflare rotated its signing keys since our last fetch — refresh once before giving up.
    keys = await getKeys(true);
    jwk = keys.find((k) => k.kid === kid);
  }
  if (!jwk) throw new Error('Unknown Access signing key');

  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  return jwt.verify(token, publicKey, { algorithms: ['RS256'], audience: AUD, issuer: `https://${TEAM_DOMAIN}` });
}

module.exports = { enabled, verifyAccessToken };
