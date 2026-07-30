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
  ensureColumn('settings', 'multi_user', 'multi_user INTEGER NOT NULL DEFAULT 0');
  ensureColumn('users', 'access_role_id', 'access_role_id INTEGER');
  ensureColumn('service_instances', 'refresh_interval_minutes', 'refresh_interval_minutes INTEGER NOT NULL DEFAULT 5');
  ensureColumn('service_instances', 'custom_headers', "custom_headers TEXT NOT NULL DEFAULT '{}'");

  const row = db.prepare('SELECT id FROM settings WHERE id = 1').get();
  if (!row) {
    const jwtSecret = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO settings (id, pin_hash, jwt_secret) VALUES (1, NULL, ?)').run(jwtSecret);
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
    credentials: JSON.parse(row.credentials || '{}'),
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
      (service_id, display_name, auth_type, local_url, remote_url, preferred_mode, credentials, custom_headers, wol_mac, wol_broadcast, favorite, sort_order, enabled, refresh_interval_minutes)
    VALUES (@service_id, @display_name, @auth_type, @local_url, @remote_url, @preferred_mode, @credentials, @custom_headers, @wol_mac, @wol_broadcast, @favorite, @sort_order, @enabled, @refresh_interval_minutes)
  `);
  const result = stmt.run({
    service_id: data.serviceId,
    display_name: data.displayName,
    auth_type: data.authType,
    local_url: data.localUrl || null,
    remote_url: data.remoteUrl || null,
    preferred_mode: data.preferredMode || 'auto',
    credentials: JSON.stringify(data.credentials || {}),
    custom_headers: JSON.stringify(data.customHeaders || {}),
    wol_mac: data.wolMac || null,
    wol_broadcast: data.wolBroadcast || null,
    favorite: data.favorite ? 1 : 0,
    sort_order: data.sortOrder || 0,
    enabled: data.enabled === false ? 0 : 1,
    refresh_interval_minutes: clampRefreshInterval(data.serviceId, data.refreshIntervalMinutes ?? defaultRefreshInterval(data.serviceId)),
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
    custom_headers: JSON.stringify(data.customHeaders ?? existing.custom_headers),
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
      preferred_mode = @preferred_mode, credentials = @credentials, custom_headers = @custom_headers, wol_mac = @wol_mac,
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

function countAdmins() {
  return getDb().prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;
}

function createUser({ username, passwordHash, role }) {
  const result = getDb()
    .prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .run(username, passwordHash, role || 'member');
  return serializeUser(getUserById(result.lastInsertRowid));
}

function updateUser(id, { username, passwordHash, role, accessRoleId }) {
  const existing = getUserById(id);
  if (!existing) return null;
  getDb()
    .prepare('UPDATE users SET username = ?, password_hash = ?, role = ?, access_role_id = ? WHERE id = ?')
    .run(
      username ?? existing.username,
      passwordHash ?? existing.password_hash,
      role ?? existing.role,
      accessRoleId !== undefined ? accessRoleId : existing.access_role_id,
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

module.exports = {
  initDb, getDb, getSettings, setCredential, getJwtSecret,
  recordFailedLogin, resetFailedLogins, getLockoutSeconds,
  closeDb, backupTo, restoreFrom, DB_PATH,
  listServiceInstances, getServiceInstance, createServiceInstance, updateServiceInstance, deleteServiceInstance,
  setServiceSessionToken, getDashboardWidgets, setDashboardWidgets,
  isMultiUser, setMultiUser, listUsers, getUserById, getUserByUsername, countAdmins, createUser, updateUser, deleteUser,
  listUserLinks, upsertUserLink, deleteUserLink,
  getAccessRoleServiceIds, getAccessRoleWidgets, getAccessRoleCalendarSourceIds, getAccessRoleAllowedInstanceIds,
  listAccessRoles, getAccessRoleById, createAccessRole, updateAccessRole, deleteAccessRole,
};
