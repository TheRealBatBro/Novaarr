const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

function generateSecret() {
  return authenticator.generateSecret();
}

function keyUri(secret, label) {
  return authenticator.keyuri(label, 'Remotarr', secret);
}

function qrDataUrl(uri) {
  return QRCode.toDataURL(uri);
}

// `window: 1` tolerates the previous/next 30s step either side of the server's clock, so a
// device that's a few seconds out of sync with the server still works.
function verifyCode(secret, code) {
  if (!secret || !code) return false;
  try {
    return authenticator.verify({ token: String(code).trim(), secret });
  } catch {
    return false;
  }
}

// Single-use recovery codes for "lost the authenticator app/device" — without these, losing
// the TOTP device on a self-hosted app with no email recovery flow means being locked out for
// good short of direct database access.
function generateBackupCodes(count = 8) {
  return Array.from({ length: count }, () => crypto.randomBytes(5).toString('hex'));
}

async function hashBackupCodes(codes) {
  return Promise.all(codes.map((c) => bcrypt.hash(c, 10)));
}

// Returns the remaining hashed codes (with the matched one removed) on success, or null if the
// code didn't match any — the caller persists the returned array either way to consume the
// code exactly once.
async function consumeBackupCode(hashedCodes, code) {
  if (!Array.isArray(hashedCodes) || !code) return null;
  for (let i = 0; i < hashedCodes.length; i++) {
    if (await bcrypt.compare(String(code).trim(), hashedCodes[i])) {
      return [...hashedCodes.slice(0, i), ...hashedCodes.slice(i + 1)];
    }
  }
  return null;
}

module.exports = { generateSecret, keyUri, qrDataUrl, verifyCode, generateBackupCodes, hashBackupCodes, consumeBackupCode };
