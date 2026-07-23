const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'remotarr.db');

let _db = null;

function getDb() {
  if (!_db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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

    CREATE TABLE IF NOT EXISTS service_instances (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id     TEXT    NOT NULL,
      display_name   TEXT    NOT NULL,
      auth_type      TEXT    NOT NULL,
      local_url      TEXT,
      remote_url     TEXT,
      preferred_mode TEXT    NOT NULL DEFAULT 'auto',
      credentials    TEXT    NOT NULL DEFAULT '{}',
      wol_mac        TEXT,
      wol_broadcast  TEXT,
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
  ensureColumn('service_instances', 'refresh_interval_minutes', 'refresh_interval_minutes INTEGER NOT NULL DEFAULT 15');

  const row = db.prepare('SELECT id FROM settings WHERE id = 1').get();
  if (!row) {
    const jwtSecret = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO settings (id, pin_hash, jwt_secret) VALUES (1, NULL, ?)').run(jwtSecret);
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

// Brute-force lockout on the shared credential (login and change-credential's "current"
// check both call this) — no lockout for the first few tries so a typo doesn't lock anyone
// out, then an exponential cooldown that keeps climbing (capped at 15 min) for as long as
// wrong attempts keep coming in.
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_CAP_SECONDS = 15 * 60;

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

// Trakt is a shared cloud API with its own rate limits, worth protecting with a higher floor
// than a self-hosted service on the local network — everything else just needs *some* bound so
// a typo doesn't turn into either a dead-slow dashboard or an accidental hammering loop.
const REFRESH_INTERVAL_LIMITS = {
  trakt: { min: 60, max: 1440 },
  default: { min: 5, max: 1440 },
};

function clampRefreshInterval(serviceId, minutes) {
  const { min, max } = REFRESH_INTERVAL_LIMITS[serviceId] ?? REFRESH_INTERVAL_LIMITS.default;
  const n = Number(minutes);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function parseInstance(row) {
  if (!row) return row;
  return { ...row, credentials: JSON.parse(row.credentials || '{}') };
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
      (service_id, display_name, auth_type, local_url, remote_url, preferred_mode, credentials, wol_mac, wol_broadcast, favorite, sort_order, enabled, refresh_interval_minutes)
    VALUES (@service_id, @display_name, @auth_type, @local_url, @remote_url, @preferred_mode, @credentials, @wol_mac, @wol_broadcast, @favorite, @sort_order, @enabled, @refresh_interval_minutes)
  `);
  const result = stmt.run({
    service_id: data.serviceId,
    display_name: data.displayName,
    auth_type: data.authType,
    local_url: data.localUrl || null,
    remote_url: data.remoteUrl || null,
    preferred_mode: data.preferredMode || 'auto',
    credentials: JSON.stringify(data.credentials || {}),
    wol_mac: data.wolMac || null,
    wol_broadcast: data.wolBroadcast || null,
    favorite: data.favorite ? 1 : 0,
    sort_order: data.sortOrder || 0,
    enabled: data.enabled === false ? 0 : 1,
    refresh_interval_minutes: clampRefreshInterval(data.serviceId, data.refreshIntervalMinutes ?? 15),
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
    credentials: JSON.stringify(data.credentials ?? existing.credentials),
    wol_mac: data.wolMac ?? existing.wol_mac,
    wol_broadcast: data.wolBroadcast ?? existing.wol_broadcast,
    favorite: data.favorite !== undefined ? (data.favorite ? 1 : 0) : existing.favorite,
    sort_order: data.sortOrder ?? existing.sort_order,
    enabled: data.enabled !== undefined ? (data.enabled ? 1 : 0) : existing.enabled,
    refresh_interval_minutes:
      data.refreshIntervalMinutes !== undefined
        ? clampRefreshInterval(existing.service_id, data.refreshIntervalMinutes)
        : existing.refresh_interval_minutes,
  };
  getDb().prepare(`
    UPDATE service_instances SET
      display_name = @display_name, auth_type = @auth_type, local_url = @local_url, remote_url = @remote_url,
      preferred_mode = @preferred_mode, credentials = @credentials, wol_mac = @wol_mac,
      wol_broadcast = @wol_broadcast, favorite = @favorite, sort_order = @sort_order,
      enabled = @enabled, refresh_interval_minutes = @refresh_interval_minutes, updated_at = unixepoch()
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

function getDashboardWidgets() {
  const raw = getSettings().dashboard_widgets;
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function setDashboardWidgets(widgets) {
  getDb().prepare('UPDATE settings SET dashboard_widgets = ? WHERE id = 1').run(JSON.stringify(widgets));
  return widgets;
}

module.exports = {
  initDb, getDb, getSettings, setCredential, getJwtSecret,
  recordFailedLogin, resetFailedLogins, getLockoutSeconds,
  closeDb, backupTo, restoreFrom, DB_PATH,
  listServiceInstances, getServiceInstance, createServiceInstance, updateServiceInstance, deleteServiceInstance,
  setServiceSessionToken, getDashboardWidgets, setDashboardWidgets,
};
