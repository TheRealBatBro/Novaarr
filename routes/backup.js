const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const multer = require('multer');
const Database = require('better-sqlite3');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);
router.use(requireAdmin);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });
const scrypt = promisify(crypto.scrypt);

// Backups hold service credentials/API keys in the clear inside the SQLite file, so the file
// itself is encrypted at rest with a password chosen at export time (independent of the app's
// own sign-in credential) — anyone who gets the file without that password gets nothing.
const MAGIC = Buffer.from('RMTRENC1', 'ascii');
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;
const HEADER_LEN = MAGIC.length + SALT_LEN + IV_LEN + TAG_LEN;

function tempPath(prefix) {
  return path.join(os.tmpdir(), `${prefix}-${crypto.randomBytes(6).toString('hex')}.tmp`);
}

async function encrypt(plaintext, password) {
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = await scrypt(password, salt, KEY_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), ciphertext]);
}

// Throws 'NOT_ENCRYPTED_BACKUP' for anything that isn't our container format, or
// 'WRONG_PASSWORD' when the GCM auth tag doesn't verify — which is also what a corrupted file
// looks like; authenticated encryption can't (and shouldn't) tell those two apart.
async function decrypt(blob, password) {
  if (blob.length < HEADER_LEN || !blob.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('NOT_ENCRYPTED_BACKUP');
  }
  let offset = MAGIC.length;
  const salt = blob.subarray(offset, (offset += SALT_LEN));
  const iv = blob.subarray(offset, (offset += IV_LEN));
  const authTag = blob.subarray(offset, (offset += TAG_LEN));
  const ciphertext = blob.subarray(offset);
  const key = await scrypt(password, salt, KEY_LEN);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error('WRONG_PASSWORD');
  }
}

router.post('/export', async (req, res) => {
  const { password } = req.body || {};
  if (!password || password.length < 6) return res.status(400).json({ error: 'Backup password must be at least 6 characters' });

  const snapshot = tempPath('novaarr-export');
  try {
    db.backupTo(snapshot);
    const plaintext = fs.readFileSync(snapshot);
    const encrypted = await encrypt(plaintext, password);
    const filename = `novaarr-backup-${new Date().toISOString().slice(0, 10)}.rtbackup`;
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.set('Content-Type', 'application/octet-stream');
    res.send(encrypted);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Backup failed' });
  } finally {
    fs.unlink(snapshot, () => {});
  }
});

router.post('/import', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'Backup password is required' });

  let plaintext;
  try {
    plaintext = await decrypt(req.file.buffer, password);
  } catch (e) {
    if (e.message === 'NOT_ENCRYPTED_BACKUP') {
      return res.status(400).json({ error: "This doesn't look like an encrypted Novaarr backup" });
    }
    return res.status(400).json({ error: 'Incorrect password, or the backup file is corrupted' });
  }

  if (plaintext.length < 16 || plaintext.toString('latin1', 0, 16) !== 'SQLite format 3\0') {
    return res.status(400).json({ error: 'Decrypted file is not a valid database' });
  }

  const staged = tempPath('novaarr-import');
  try {
    fs.writeFileSync(staged, plaintext);

    const check = new Database(staged, { readonly: true });
    const cols = check.prepare('PRAGMA table_info(settings)').all();
    check.close();
    if (!cols.some((c) => c.name === 'pin_hash')) {
      return res.status(400).json({ error: "This file doesn't look like a Novaarr backup" });
    }

    const { credentialPreserved } = db.restoreFrom(staged);
    res.json({ ok: true, credentialPreserved });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Restore failed' });
  } finally {
    fs.unlink(staged, () => {});
  }
});

module.exports = router;
