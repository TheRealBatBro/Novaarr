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
      (service_id, display_name, auth_type, local_url, remote_url, preferred_mode, credentials, wol_mac, wol_broadcast, favorite, sort_order, enabled)
    VALUES (@service_id, @display_name, @auth_type, @local_url, @remote_url, @preferred_mode, @credentials, @wol_mac, @wol_broadcast, @favorite, @sort_order, @enabled)
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
  };
  getDb().prepare(`
    UPDATE service_instances SET
      display_name = @display_name, auth_type = @auth_type, local_url = @local_url, remote_url = @remote_url,
      preferred_mode = @preferred_mode, credentials = @credentials, wol_mac = @wol_mac,
      wol_broadcast = @wol_broadcast, favorite = @favorite, sort_order = @sort_order,
      enabled = @enabled, updated_at = unixepoch()
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
  listServiceInstances, getServiceInstance, createServiceInstance, updateServiceInstance, deleteServiceInstance,
  setServiceSessionToken, getDashboardWidgets, setDashboardWidgets,
};
