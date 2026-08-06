const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'novaarr.db');

// One-time migration for the Remotarr -> Novaarr rename: an existing deployment's data volume
// still has the database at the old filename. If DB_PATH's target doesn't exist yet but the old
// name does (same directory), move it over instead of silently initializing an empty database —
// otherwise the app would look like it forgot every configured service.
function migrateLegacyDbPath() {
  if (fs.existsSync(DB_PATH)) return;
  const dir = path.dirname(DB_PATH);
  const legacyPath = path.join(dir, 'remotarr.db');
  if (!fs.existsSync(legacyPath)) return;
  for (const suffix of ['', '-wal', '-shm']) {
    const from = legacyPath + suffix;
    const to = DB_PATH + suffix;
    if (fs.existsSync(from)) fs.renameSync(from, to);
  }
  console.log('Migrated database from', legacyPath, 'to', DB_PATH);
}

let _db = null;

function getDb() {
  if (!_db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    migrateLegacyDbPath();
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
  }
  return _db;
}

function initDb() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id         INTEGER PRIMARY KEY CHECK (id = 1),
      pin_hash   TEXT,
      jwt_secret TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'member',
      created_at    INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS user_dashboard_widgets (
      user_id INTEGER PRIMARY KEY,
      widgets TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS access_roles (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS access_role_services (
      role_id     INTEGER NOT NULL,
      instance_id INTEGER NOT NULL,
      PRIMARY KEY (role_id, instance_id)
    );

    -- instance_id is the specific instance a widget key resolves to at the time an admin picks
    -- it (the frontend, which owns the widget catalog, resolves this — see
    -- web/src/lib/dashboardWidgets.ts's resolveWidgetInstanceId) — stored alongside the key so
    -- granting a widget can also unlock proxy access to its backing instance without the
    -- backend needing to know anything about the widget catalog itself.
    CREATE TABLE IF NOT EXISTS access_role_widgets (
      role_id     INTEGER NOT NULL,
      widget_key  TEXT    NOT NULL,
      instance_id INTEGER NOT NULL,
      PRIMARY KEY (role_id, widget_key)
    );

    -- Calendar aggregates across every configured Sonarr/Radarr instance, independent of full
    -- page access to any of them — a role can grant "show this instance's episodes/releases on
    -- Calendar" per instance without granting that instance's own page, same relationship
    -- widgets have to services.
    CREATE TABLE IF NOT EXISTS access_role_calendar_sources (
      role_id     INTEGER NOT NULL,
      instance_id INTEGER NOT NULL,
      PRIMARY KEY (role_id, instance_id)
    );

    CREATE TABLE IF NOT EXISTS user_service_links (
      user_id       INTEGER NOT NULL,
      instance_id   INTEGER NOT NULL,
      external_id   TEXT    NOT NULL,
      external_name TEXT,
      auto          INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, instance_id)
    );

    -- Append-only: nothing ever updates or deletes a row here except the retention prune in
    -- logAudit. actor_label snapshots the username at the time of the action (rather than a
    -- live join to users) so a since-deleted or renamed user still reads correctly in old
    -- entries.
    CREATE TABLE IF NOT EXISTS audit_log (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
      actor_user_id  INTEGER,
      actor_label    TEXT    NOT NULL,
      action         TEXT    NOT NULL,
      target         TEXT,
      detail         TEXT,
      ip             TEXT
    );

    -- One row per subscribed browser/device (endpoint is the browser push service's unique URL
    -- for that registration, so it's the natural primary key — re-subscribing the same device
    -- just replaces its keys rather than piling up duplicates).
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint   TEXT PRIMARY KEY,
      p256dh     TEXT NOT NULL,
      auth       TEXT NOT NULL,
      user_id    INTEGER,
      created_at INTEGER DEFAULT (unixepoch())
    );

    -- Passkey/WebAuthn credentials, additive alongside the PIN/password (and TOTP) login —
    -- user_id is NULL for simple mode's single shared identity, or a users.id row in multi-user
    -- mode, mirroring the same settings-vs-users split already used for TOTP throughout this file.
    CREATE TABLE IF NOT EXISTS webauthn_credentials (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      credential_id TEXT    NOT NULL UNIQUE,
      public_key    TEXT    NOT NULL,
      counter       INTEGER NOT NULL DEFAULT 0,
      transports    TEXT    NOT NULL DEFAULT '[]',
      user_id       INTEGER,
      name          TEXT    NOT NULL DEFAULT 'Passkey',
      created_at    INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS service_instances (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id     TEXT    NOT NULL,
      display_name   TEXT    NOT NULL,
      auth_type      TEXT    NOT NULL,
      local_url      TEXT,
      remote_url     TEXT,
      preferred_mode TEXT    NOT NULL DEFAULT 'auto',
      credentials    TEXT    NOT NULL DEFAULT '{}',
      favorite       INTEGER NOT NULL DEFAULT 0,
      sort_order     INTEGER NOT NULL DEFAULT 0,
      session_token  TEXT,
      enabled        INTEGER NOT NULL DEFAULT 1,
      created_at     INTEGER DEFAULT (unixepoch()),
      updated_at     INTEGER DEFAULT (unixepoch())
    );
  `);

  ensureColumn('settings', 'dashboard_widgets', 'dashboard_widgets TEXT');
  ensureColumn('settings', 'auth_mode', "auth_mode TEXT NOT NULL DEFAULT 'pin'");
  ensureColumn('settings', 'failed_attempts', 'failed_attempts INTEGER NOT NULL DEFAULT 0');
  ensureColumn('settings', 'locked_until', 'locked_until INTEGER');
  ensureColumn('settings', 'multi_user', 'multi_user INTEGER NOT NULL DEFAULT 0');
  ensureColumn('users', 'access_role_id', 'access_role_id INTEGER');
  ensureColumn('service_instances', 'refresh_interval_minutes', 'refresh_interval_minutes INTEGER NOT NULL DEFAULT 5');
  ensureColumn('service_instances', 'custom_headers', "custom_headers TEXT NOT NULL DEFAULT '{}'");
  ensureColumn('service_instances', 'ignore_cert_errors', 'ignore_cert_errors INTEGER NOT NULL DEFAULT 0');
  ensureColumn('settings', 'credentials_key', 'credentials_key TEXT');
  ensureColumn('settings', 'token_valid_after', 'token_valid_after INTEGER NOT NULL DEFAULT 0');
  ensureColumn('users', 'token_valid_after', 'token_valid_after INTEGER NOT NULL DEFAULT 0');
  ensureColumn('users', 'cf_access_email', 'cf_access_email TEXT');
  ensureColumn('settings', 'totp_secret', 'totp_secret TEXT');
  ensureColumn('settings', 'totp_enabled', 'totp_enabled INTEGER NOT NULL DEFAULT 0');
  ensureColumn('settings', 'totp_backup_codes', 'totp_backup_codes TEXT');
  ensureColumn('users', 'totp_secret', 'totp_secret TEXT');
  ensureColumn('users', 'totp_enabled', 'totp_enabled INTEGER NOT NULL DEFAULT 0');
  ensureColumn('users', 'totp_backup_codes', 'totp_backup_codes TEXT');
  ensureColumn('settings', 'vapid_public_key', 'vapid_public_key TEXT');
  ensureColumn('settings', 'vapid_private_key', 'vapid_private_key TEXT');
  ensureColumn('settings', 'overseerr_pending_seen', 'overseerr_pending_seen TEXT');

  const row = db.prepare('SELECT id FROM settings WHERE id = 1').get();
  if (!row) {
    const jwtSecret = crypto.randomBytes(32).toString('hex');
    const credentialsKey = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO settings (id, pin_hash, jwt_secret, credentials_key) VALUES (1, NULL, ?, ?)').run(jwtSecret, credentialsKey);
  } else if (!db.prepare('SELECT credentials_key FROM settings WHERE id = 1').get().credentials_key) {
    // Upgrading a pre-encryption install — generate the key now. Any credentials already
    // stored in plaintext stay readable (decryptJson falls back to plain JSON) and get
    // encrypted the next time their instance is saved.
    db.prepare('UPDATE settings SET credentials_key = ? WHERE id = 1').run(crypto.randomBytes(32).toString('hex'));
  }

  // One-time correction for instances that got the old blanket default of 15 minutes before the
  // per-service default (5 min, 60 min for Trakt) existed — PRAGMA user_version tracks whether
  // this has already run so it can never clobber a real, deliberate later choice of "15".
  if (db.pragma('user_version', { simple: true }) < 1) {
    db.exec("UPDATE service_instances SET refresh_interval_minutes = 60 WHERE service_id = 'trakt' AND refresh_interval_minutes = 15");
    db.exec("UPDATE service_instances SET refresh_interval_minutes = 5 WHERE service_id != 'trakt' AND refresh_interval_minutes = 15");
    db.pragma('user_version = 1');
  }

  console.log('Database ready:', DB_PATH);
}

// Additive migration helper — safe to call on both fresh and already-populated databases,
// since real service configs (Sonarr/Overseerr) live in this same DB file across redeploys.
function ensureColumn(table, column, ddl) {
  const db = getDb();
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

function getSettings() {
  return getDb().prepare('SELECT * FROM settings WHERE id = 1').get();
}

// `pin_hash` holds the bcrypt hash of whichever credential is active — a PIN or a password;
// `auth_mode` says which, so /api/auth can pick the right validation rules and login UI.
function setCredential(hash, mode) {
  getDb().prepare('UPDATE settings SET pin_hash = ?, auth_mode = ? WHERE id = 1').run(hash, mode);
}

function getJwtSecret() {
  return getSettings().jwt_secret;
}

// Encrypts service_instances.credentials at rest (AES-256-GCM, random IV + auth tag per write)
// with a key generated once per install and never derived from the JWT secret, so rotating
// sessions (e.g. token revocation) never breaks stored credentials.
const ENC_PREFIX = 'enc:v1:';

function encryptJson(obj) {
  const key = Buffer.from(getSettings().credentials_key, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(obj ?? {}), 'utf8'), cipher.final()]);
  return ENC_PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}

// Pre-encryption installs have plaintext JSON in this column — read it as-is (it gets
// encrypted the next time its instance is saved) instead of failing to decrypt.
function decryptJson(value) {
  if (typeof value !== 'string' || !value.startsWith(ENC_PREFIX)) {
    try { return JSON.parse(value || '{}'); } catch { return {}; }
  }
  try {
    const raw = Buffer.from(value.slice(ENC_PREFIX.length), 'base64');
    const key = Buffer.from(getSettings().credentials_key, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const plaintext = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8'));
  } catch {
    return {};
  }
}

// JWTs are otherwise valid for their full 30-day life with no way to invalidate a leaked/stolen
// one short of rotating the signing secret (which logs out every session at once). Instead, a
// token is rejected once its `iat` (issued-at, in seconds) predates either the global or the
// per-user revocation floor — so "sign out everywhere" or a password change can kill just the
// sessions that existed before it, without touching sessions issued after.
function bumpTokenValidAfter() {
  getDb().prepare('UPDATE settings SET token_valid_after = ? WHERE id = 1').run(Math.floor(Date.now() / 1000));
}

function bumpUserTokenValidAfter(userId) {
  getDb().prepare('UPDATE users SET token_valid_after = ? WHERE id = ?').run(Math.floor(Date.now() / 1000), userId);
}

function isTokenRevoked(payload) {
  const iat = payload?.iat || 0;
  if (iat < (getSettings().token_valid_after || 0)) return true;
  if (payload?.userId) {
    const user = getUserById(payload.userId);
    if (user && iat < (user.token_valid_after || 0)) return true;
  }
  return false;
}

// TOTP two-factor auth. `totp_secret` is written on setup but `totp_enabled` only flips to true
// once the user proves they actually scanned it (routes/totp.js's /enable), so an abandoned
// setup just leaves an unused secret sitting there — harmless, the next /setup call overwrites
// it. Mirrored on both `settings` (simple mode's single shared identity) and `users` (per-account
// in multi-user mode) rather than unified, since the two modes already store every other
// credential-adjacent field the same way.
function setSettingsTotpPending(secret) {
  getDb().prepare('UPDATE settings SET totp_secret = ? WHERE id = 1').run(secret);
}

function enableSettingsTotp(hashedBackupCodes) {
  getDb().prepare('UPDATE settings SET totp_enabled = 1, totp_backup_codes = ? WHERE id = 1').run(JSON.stringify(hashedBackupCodes));
}

function disableSettingsTotp() {
  getDb().prepare('UPDATE settings SET totp_enabled = 0, totp_secret = NULL, totp_backup_codes = NULL WHERE id = 1').run();
}

function consumeSettingsBackupCode(remainingHashedCodes) {
  getDb().prepare('UPDATE settings SET totp_backup_codes = ? WHERE id = 1').run(JSON.stringify(remainingHashedCodes));
}

function setUserTotpPending(userId, secret) {
  getDb().prepare('UPDATE users SET totp_secret = ? WHERE id = ?').run(secret, userId);
}

function enableUserTotp(userId, hashedBackupCodes) {
  getDb().prepare('UPDATE users SET totp_enabled = 1, totp_backup_codes = ? WHERE id = ?').run(JSON.stringify(hashedBackupCodes), userId);
}

function disableUserTotp(userId) {
  getDb().prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_backup_codes = NULL WHERE id = ?').run(userId);
}

function consumeUserBackupCode(userId, remainingHashedCodes) {
  getDb().prepare('UPDATE users SET totp_backup_codes = ? WHERE id = ?').run(JSON.stringify(remainingHashedCodes), userId);
}

// Retention cap — an unbounded audit log is its own low-grade liability. Whichever limit
// bites first: row count or age. Pruned opportunistically on write rather than on a timer,
// since there's no background scheduler in this app to hang it off of.
const AUDIT_LOG_MAX_ROWS = 5000;
const AUDIT_LOG_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

function logAudit({ actorUserId, actorLabel, action, target, detail, ip }) {
  const db = getDb();
  db.prepare(
    'INSERT INTO audit_log (actor_user_id, actor_label, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(actorUserId ?? null, actorLabel, action, target ?? null, detail ?? null, ip ?? null);
  db.prepare('DELETE FROM audit_log WHERE created_at < ?').run(Math.floor(Date.now() / 1000) - AUDIT_LOG_MAX_AGE_SECONDS);
  db.prepare(
    'DELETE FROM audit_log WHERE id NOT IN (SELECT id FROM audit_log ORDER BY id DESC LIMIT ?)',
  ).run(AUDIT_LOG_MAX_ROWS);
}

function listAuditLog({ limit = 200, action } = {}) {
  const capped = Math.min(Math.max(Number(limit) || 200, 1), AUDIT_LOG_MAX_ROWS);
  if (action) {
    return getDb().prepare('SELECT * FROM audit_log WHERE action = ? ORDER BY id DESC LIMIT ?').all(action, capped);
  }
  return getDb().prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?').all(capped);
}

// Brute-force lockout on the shared credential (login and change-credential's "current"
// check both call this) — no lockout for the first few tries so a typo doesn't lock anyone
// out, then an exponential cooldown that keeps climbing for as long as wrong attempts keep
// coming in. Capped at 24h rather than the old 15min: for an internet-exposed deployment, 15min
// only throttled a sustained script to ~96 guesses/day forever — still enough to exhaust a
// short PIN over weeks. A day-long cap makes that impractical while still self-resolving
// without needing an admin to intervene.
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_CAP_SECONDS = 24 * 60 * 60;

function recordFailedLogin() {
  const settings = getSettings();
  const attempts = (settings.failed_attempts || 0) + 1;
  let lockedUntil = settings.locked_until;
  if (attempts >= LOCKOUT_THRESHOLD) {
    const seconds = Math.min(5 * 2 ** (attempts - LOCKOUT_THRESHOLD), LOCKOUT_CAP_SECONDS);
    lockedUntil = Date.now() + seconds * 1000;
  }
  getDb().prepare('UPDATE settings SET failed_attempts = ?, locked_until = ? WHERE id = 1').run(attempts, lockedUntil);
}

function resetFailedLogins() {
  getDb().prepare('UPDATE settings SET failed_attempts = 0, locked_until = NULL WHERE id = 1').run();
}

// Seconds remaining in the current lockout, or 0 if not locked — callers should refuse the
// credential check entirely while this is positive, rather than running bcrypt.compare again.
function getLockoutSeconds() {
  const { locked_until } = getSettings();
  if (!locked_until || locked_until <= Date.now()) return 0;
  return Math.ceil((locked_until - Date.now()) / 1000);
}

function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// Consistent point-in-time snapshot for backup download — VACUUM INTO folds the WAL back into
// a single file, so the export is never mid-write like a raw filesystem copy of the live
// .db/-wal/-shm trio could be.
function backupTo(destPath) {
  getDb().prepare('VACUUM INTO ?').run(destPath);
}

// Swaps the live database file for `sourcePath` (already validated by the caller) and
// re-runs migrations, so a backup taken from an older schema version still ends up with any
// columns added since. Closing first drops the in-process handle (and its WAL/SHM) before the
// old base file is overwritten; initDb() lazily reopens on the next getDb() call.
//
// Returns { credentialPreserved }: a backup taken from a different deployment (e.g. a dev
// instance) carries THAT deployment's own sign-in credential — almost never what you want
// landing on a device that already has its own configured, so this device's existing
// credential (and the JWT secret that signs its sessions, so anyone already signed in stays
// signed in) wins whenever one was already set up before the restore. A fresh install with no
// credential yet has nothing of its own to keep, so it adopts whatever the backup brings.
function restoreFrom(sourcePath) {
  const before = getSettings();
  const hadCredential = !!(before && before.pin_hash);

  closeDb();
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = DB_PATH + suffix;
    if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
  }
  fs.copyFileSync(sourcePath, DB_PATH);
  initDb();

  if (hadCredential) {
    getDb()
      .prepare('UPDATE settings SET pin_hash = ?, auth_mode = ?, jwt_secret = ? WHERE id = 1')
      .run(before.pin_hash, before.auth_mode, before.jwt_secret);
  }
  return { credentialPreserved: hadCredential };
}

// Trakt and MDBList are shared cloud APIs with their own rate limits (MDBList's free tier is
// hard-capped at 1,000 requests/day), worth protecting with a higher floor than a self-hosted
// service on the local network — everything else just needs *some* bound so a typo doesn't turn
// into either a dead-slow dashboard or an accidental hammering loop.
const REFRESH_INTERVAL_LIMITS = {
  trakt: { min: 60, max: 1440 },
  mdblist: { min: 60, max: 1440 },
  default: { min: 5, max: 1440 },
};

function defaultRefreshInterval(serviceId) {
  return serviceId === 'trakt' || serviceId === 'mdblist' ? 60 : 5;
}

function clampRefreshInterval(serviceId, minutes) {
  const { min, max } = REFRESH_INTERVAL_LIMITS[serviceId] ?? REFRESH_INTERVAL_LIMITS.default;
  const n = Number(minutes);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function parseInstance(row) {
  if (!row) return row;
  return {
    ...row,
    credentials: decryptJson(row.credentials),
    custom_headers: JSON.parse(row.custom_headers || '{}'),
  };
}

function listServiceInstances() {
  return getDb().prepare('SELECT * FROM service_instances ORDER BY sort_order, id').all().map(parseInstance);
}

function getServiceInstance(id) {
  return parseInstance(getDb().prepare('SELECT * FROM service_instances WHERE id = ?').get(id));
}

function createServiceInstance(data) {
  const stmt = getDb().prepare(`
    INSERT INTO service_instances
      (service_id, display_name, auth_type, local_url, remote_url, preferred_mode, credentials, custom_headers, favorite, sort_order, enabled, refresh_interval_minutes, ignore_cert_errors)
    VALUES (@service_id, @display_name, @auth_type, @local_url, @remote_url, @preferred_mode, @credentials, @custom_headers, @favorite, @sort_order, @enabled, @refresh_interval_minutes, @ignore_cert_errors)
  `);
  const result = stmt.run({
    service_id: data.serviceId,
    display_name: data.displayName,
    auth_type: data.authType,
    local_url: data.localUrl || null,
    remote_url: data.remoteUrl || null,
    preferred_mode: data.preferredMode || 'auto',
    credentials: encryptJson(data.credentials || {}),
    custom_headers: JSON.stringify(data.customHeaders || {}),
    favorite: data.favorite ? 1 : 0,
    sort_order: data.sortOrder || 0,
    enabled: data.enabled === false ? 0 : 1,
    refresh_interval_minutes: clampRefreshInterval(data.serviceId, data.refreshIntervalMinutes ?? defaultRefreshInterval(data.serviceId)),
    ignore_cert_errors: data.ignoreCertErrors ? 1 : 0,
  });
  return getServiceInstance(result.lastInsertRowid);
}

function updateServiceInstance(id, data) {
  const existing = getServiceInstance(id);
  if (!existing) return null;
  const merged = {
    display_name: data.displayName ?? existing.display_name,
    auth_type: data.authType ?? existing.auth_type,
    local_url: data.localUrl ?? existing.local_url,
    remote_url: data.remoteUrl ?? existing.remote_url,
    preferred_mode: data.preferredMode ?? existing.preferred_mode,
    credentials: data.credentials !== undefined ? encryptJson(data.credentials) : encryptJson(existing.credentials),
    custom_headers: JSON.stringify(data.customHeaders ?? existing.custom_headers),
    favorite: data.favorite !== undefined ? (data.favorite ? 1 : 0) : existing.favorite,
    sort_order: data.sortOrder ?? existing.sort_order,
    enabled: data.enabled !== undefined ? (data.enabled ? 1 : 0) : existing.enabled,
    refresh_interval_minutes:
      data.refreshIntervalMinutes !== undefined
        ? clampRefreshInterval(existing.service_id, data.refreshIntervalMinutes)
        : existing.refresh_interval_minutes,
    ignore_cert_errors: data.ignoreCertErrors !== undefined ? (data.ignoreCertErrors ? 1 : 0) : existing.ignore_cert_errors,
  };
  getDb().prepare(`
    UPDATE service_instances SET
      display_name = @display_name, auth_type = @auth_type, local_url = @local_url, remote_url = @remote_url,
      preferred_mode = @preferred_mode, credentials = @credentials, custom_headers = @custom_headers,
      favorite = @favorite, sort_order = @sort_order,
      enabled = @enabled, refresh_interval_minutes = @refresh_interval_minutes, ignore_cert_errors = @ignore_cert_errors,
      updated_at = unixepoch()
    WHERE id = @id
  `).run({ ...merged, id });
  return getServiceInstance(id);
}

function deleteServiceInstance(id) {
  getDb().prepare('DELETE FROM service_instances WHERE id = ?').run(id);
}

function setServiceSessionToken(id, token) {
  getDb().prepare('UPDATE service_instances SET session_token = ? WHERE id = ?').run(token, id);
}

// `userId` is undefined/null in simple mode (the only mode that existed before multi-user), which
// keeps reading/writing the original single global column completely unchanged. Multi-user mode
// scopes to a per-user row in user_dashboard_widgets instead, added purely additively — simple
// mode never touches that table.
function getDashboardWidgets(userId) {
  if (userId) {
    const row = getDb().prepare('SELECT widgets FROM user_dashboard_widgets WHERE user_id = ?').get(userId);
    if (!row) return [];
    try {
      return JSON.parse(row.widgets);
    } catch {
      return [];
    }
  }
  const raw = getSettings().dashboard_widgets;
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function setDashboardWidgets(widgets, userId) {
  if (userId) {
    getDb()
      .prepare('INSERT INTO user_dashboard_widgets (user_id, widgets) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET widgets = excluded.widgets')
      .run(userId, JSON.stringify(widgets));
    return widgets;
  }
  getDb().prepare('UPDATE settings SET dashboard_widgets = ? WHERE id = 1').run(JSON.stringify(widgets));
  return widgets;
}

function isMultiUser() {
  return !!getSettings().multi_user;
}

function setMultiUser(on) {
  getDb().prepare('UPDATE settings SET multi_user = ? WHERE id = 1').run(on ? 1 : 0);
}

function serializeUser(row) {
  if (!row) return row;
  const { password_hash, ...rest } = row;
  return rest;
}

function listUsers() {
  return getDb().prepare('SELECT * FROM users ORDER BY id').all().map(serializeUser);
}

function getUserById(id) {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function getUserByUsername(username) {
  return getDb().prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function getUserByCfAccessEmail(email) {
  if (!email) return null;
  return getDb().prepare('SELECT * FROM users WHERE cf_access_email = ? COLLATE NOCASE').get(email);
}

function countAdmins() {
  return getDb().prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;
}

function createUser({ username, passwordHash, role }) {
  const result = getDb()
    .prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .run(username, passwordHash, role || 'member');
  return serializeUser(getUserById(result.lastInsertRowid));
}

function updateUser(id, { username, passwordHash, role, accessRoleId, cfAccessEmail }) {
  const existing = getUserById(id);
  if (!existing) return null;
  getDb()
    .prepare('UPDATE users SET username = ?, password_hash = ?, role = ?, access_role_id = ?, cf_access_email = ? WHERE id = ?')
    .run(
      username ?? existing.username,
      passwordHash ?? existing.password_hash,
      role ?? existing.role,
      accessRoleId !== undefined ? accessRoleId : existing.access_role_id,
      cfAccessEmail !== undefined ? cfAccessEmail || null : existing.cf_access_email,
      id,
    );
  return serializeUser(getUserById(id));
}

function deleteUser(id) {
  getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
  getDb().prepare('DELETE FROM user_dashboard_widgets WHERE user_id = ?').run(id);
  getDb().prepare('DELETE FROM user_service_links WHERE user_id = ?').run(id);
}

// Per-user links to an account on another configured service (Plex/Emby/Jellyfin picked
// directly in the first-login wizard, Overseerr/Ombi derived automatically from a username
// match against whichever of those the user picked) — `auto` distinguishes the two so the UI
// can show which links were a guess versus a deliberate choice.
function listUserLinks(userId) {
  return getDb().prepare('SELECT instance_id AS instanceId, external_id AS externalId, external_name AS externalName, auto FROM user_service_links WHERE user_id = ?').all(userId)
    .map((r) => ({ ...r, auto: !!r.auto }));
}

function upsertUserLink(userId, instanceId, { externalId, externalName, auto }) {
  getDb()
    .prepare(`
      INSERT INTO user_service_links (user_id, instance_id, external_id, external_name, auto)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, instance_id) DO UPDATE SET external_id = excluded.external_id, external_name = excluded.external_name, auto = excluded.auto
    `)
    .run(userId, instanceId, externalId, externalName || null, auto ? 1 : 0);
  return listUserLinks(userId);
}

function deleteUserLink(userId, instanceId) {
  getDb().prepare('DELETE FROM user_service_links WHERE user_id = ? AND instance_id = ?').run(userId, instanceId);
}

// Access roles let an admin restrict a member to a subset of configured services (which
// pages show up in nav, and which service instances that member's requests may actually reach —
// middleware/auth.js's requireServiceAccess) and/or a subset of dashboard widgets. The two are
// independent but overlapping: granting a widget also unlocks proxy access to its backing
// instance (getAccessRoleAllowedInstanceIds below) — there's no narrower "widget data but no
// other access to that instance" distinction possible once a role, i.e. any request, can reach
// an instance's proxy endpoint, it can make any call that endpoint supports, not just the one
// call a given widget happens to make. An empty widgets list means "no widget-level
// restriction" — exactly what every role had before this existed, so a role that only ever
// configured services keeps behaving exactly as before. A member with no access role assigned
// at all has full access, same as every member did before access roles existed.
function getAccessRoleServiceIds(roleId) {
  return new Set(getDb().prepare('SELECT instance_id FROM access_role_services WHERE role_id = ?').all(roleId).map((r) => r.instance_id));
}

function setAccessRoleServices(roleId, instanceIds) {
  const conn = getDb();
  conn.prepare('DELETE FROM access_role_services WHERE role_id = ?').run(roleId);
  const insert = conn.prepare('INSERT INTO access_role_services (role_id, instance_id) VALUES (?, ?)');
  for (const id of instanceIds || []) insert.run(roleId, id);
}

function getAccessRoleWidgets(roleId) {
  return getDb().prepare('SELECT widget_key AS widgetKey, instance_id AS instanceId FROM access_role_widgets WHERE role_id = ?').all(roleId);
}

function setAccessRoleWidgets(roleId, widgets) {
  const conn = getDb();
  conn.prepare('DELETE FROM access_role_widgets WHERE role_id = ?').run(roleId);
  const insert = conn.prepare('INSERT INTO access_role_widgets (role_id, widget_key, instance_id) VALUES (?, ?, ?)');
  for (const w of widgets || []) insert.run(roleId, w.widgetKey, w.instanceId);
}

function getAccessRoleCalendarSourceIds(roleId) {
  return new Set(getDb().prepare('SELECT instance_id FROM access_role_calendar_sources WHERE role_id = ?').all(roleId).map((r) => r.instance_id));
}

function setAccessRoleCalendarSources(roleId, instanceIds) {
  const conn = getDb();
  conn.prepare('DELETE FROM access_role_calendar_sources WHERE role_id = ?').run(roleId);
  const insert = conn.prepare('INSERT INTO access_role_calendar_sources (role_id, instance_id) VALUES (?, ?)');
  for (const id of instanceIds || []) insert.run(roleId, id);
}

// Union of every grant path — everything requireServiceAccess and routes/services.js's list
// filter need to allow through so a granted widget's or Calendar source's data can actually load.
function getAccessRoleAllowedInstanceIds(roleId) {
  const ids = getAccessRoleServiceIds(roleId);
  for (const w of getAccessRoleWidgets(roleId)) ids.add(w.instanceId);
  for (const id of getAccessRoleCalendarSourceIds(roleId)) ids.add(id);
  return ids;
}

function getAccessRoleById(id) {
  const row = getDb().prepare('SELECT * FROM access_roles WHERE id = ?').get(id);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    serviceInstanceIds: [...getAccessRoleServiceIds(id)],
    widgets: getAccessRoleWidgets(id),
    calendarSourceIds: [...getAccessRoleCalendarSourceIds(id)],
  };
}

function listAccessRoles() {
  return getDb().prepare('SELECT id FROM access_roles ORDER BY id').all().map((r) => getAccessRoleById(r.id));
}

function createAccessRole(name, instanceIds, widgets, calendarSourceIds) {
  const result = getDb().prepare('INSERT INTO access_roles (name) VALUES (?)').run(name);
  setAccessRoleServices(result.lastInsertRowid, instanceIds);
  setAccessRoleWidgets(result.lastInsertRowid, widgets);
  setAccessRoleCalendarSources(result.lastInsertRowid, calendarSourceIds);
  return getAccessRoleById(result.lastInsertRowid);
}

function updateAccessRole(id, { name, instanceIds, widgets, calendarSourceIds }) {
  if (!getAccessRoleById(id)) return null;
  if (name !== undefined) getDb().prepare('UPDATE access_roles SET name = ? WHERE id = ?').run(name, id);
  if (instanceIds !== undefined) setAccessRoleServices(id, instanceIds);
  if (widgets !== undefined) setAccessRoleWidgets(id, widgets);
  if (calendarSourceIds !== undefined) setAccessRoleCalendarSources(id, calendarSourceIds);
  return getAccessRoleById(id);
}

function deleteAccessRole(id) {
  getDb().prepare('DELETE FROM access_roles WHERE id = ?').run(id);
  getDb().prepare('DELETE FROM access_role_services WHERE role_id = ?').run(id);
  getDb().prepare('DELETE FROM access_role_widgets WHERE role_id = ?').run(id);
  getDb().prepare('DELETE FROM access_role_calendar_sources WHERE role_id = ?').run(id);
  getDb().prepare('UPDATE users SET access_role_id = NULL WHERE access_role_id = ?').run(id);
}

function getVapidKeys() {
  const { vapid_public_key, vapid_private_key } = getSettings();
  return vapid_public_key && vapid_private_key ? { publicKey: vapid_public_key, privateKey: vapid_private_key } : null;
}

function setVapidKeys(publicKey, privateKey) {
  getDb().prepare('UPDATE settings SET vapid_public_key = ?, vapid_private_key = ? WHERE id = 1').run(publicKey, privateKey);
}

function upsertPushSubscription({ endpoint, p256dh, auth, userId }) {
  getDb()
    .prepare(`
      INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_id) VALUES (?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, user_id = excluded.user_id
    `)
    .run(endpoint, p256dh, auth, userId ?? null);
}

function removePushSubscription(endpoint) {
  getDb().prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
}

function listPushSubscriptions() {
  return getDb().prepare('SELECT endpoint, p256dh, auth, user_id AS userId FROM push_subscriptions').all();
}

// Tracks the last-seen Overseerr pending-request count per instance, so the background poller
// (lib/overseerrPoll.js) can tell "count went up" (worth a notification) from "count is still 3"
// (nothing new) across restarts, without needing its own dedicated table for one number per instance.
function getOverseerrPendingSeen() {
  try { return JSON.parse(getSettings().overseerr_pending_seen || '{}'); } catch { return {}; }
}

function setOverseerrPendingSeen(map) {
  getDb().prepare('UPDATE settings SET overseerr_pending_seen = ? WHERE id = 1').run(JSON.stringify(map));
}

function listWebauthnCredentials(userId) {
  const rows = userId
    ? getDb().prepare('SELECT * FROM webauthn_credentials WHERE user_id = ? ORDER BY id').all(userId)
    : getDb().prepare('SELECT * FROM webauthn_credentials WHERE user_id IS NULL ORDER BY id').all();
  return rows.map((r) => ({ ...r, transports: JSON.parse(r.transports || '[]') }));
}

function getWebauthnCredentialByCredentialId(credentialId) {
  const row = getDb().prepare('SELECT * FROM webauthn_credentials WHERE credential_id = ?').get(credentialId);
  return row ? { ...row, transports: JSON.parse(row.transports || '[]') } : null;
}

function createWebauthnCredential({ credentialId, publicKey, counter, transports, userId, name }) {
  getDb()
    .prepare('INSERT INTO webauthn_credentials (credential_id, public_key, counter, transports, user_id, name) VALUES (?, ?, ?, ?, ?, ?)')
    .run(credentialId, publicKey, counter || 0, JSON.stringify(transports || []), userId ?? null, name || 'Passkey');
}

function updateWebauthnCredentialCounter(credentialId, counter) {
  getDb().prepare('UPDATE webauthn_credentials SET counter = ? WHERE credential_id = ?').run(counter, credentialId);
}

function deleteWebauthnCredential(id, userId) {
  if (userId) {
    getDb().prepare('DELETE FROM webauthn_credentials WHERE id = ? AND user_id = ?').run(id, userId);
  } else {
    getDb().prepare('DELETE FROM webauthn_credentials WHERE id = ? AND user_id IS NULL').run(id);
  }
}

module.exports = {
  initDb, getDb, getSettings, setCredential, getJwtSecret,
  getVapidKeys, setVapidKeys, upsertPushSubscription, removePushSubscription, listPushSubscriptions,
  getOverseerrPendingSeen, setOverseerrPendingSeen,
  listWebauthnCredentials, getWebauthnCredentialByCredentialId, createWebauthnCredential,
  updateWebauthnCredentialCounter, deleteWebauthnCredential,
  bumpTokenValidAfter, bumpUserTokenValidAfter, isTokenRevoked,
  setSettingsTotpPending, enableSettingsTotp, disableSettingsTotp, consumeSettingsBackupCode,
  setUserTotpPending, enableUserTotp, disableUserTotp, consumeUserBackupCode,
  logAudit, listAuditLog,
  recordFailedLogin, resetFailedLogins, getLockoutSeconds,
  closeDb, backupTo, restoreFrom, DB_PATH,
  listServiceInstances, getServiceInstance, createServiceInstance, updateServiceInstance, deleteServiceInstance,
  setServiceSessionToken, getDashboardWidgets, setDashboardWidgets,
  isMultiUser, setMultiUser, listUsers, getUserById, getUserByUsername, getUserByCfAccessEmail, countAdmins, createUser, updateUser, deleteUser,
  listUserLinks, upsertUserLink, deleteUserLink,
  getAccessRoleServiceIds, getAccessRoleWidgets, getAccessRoleCalendarSourceIds, getAccessRoleAllowedInstanceIds,
  listAccessRoles, getAccessRoleById, createAccessRole, updateAccessRole, deleteAccessRole,
};
