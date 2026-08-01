const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { logAction } = require('../lib/audit');

const router = express.Router();
router.use(requireAuth);
router.use(requireAdmin);

// An admin links each household member to their account on Plex/Emby/Jellyfin (and Overseerr/Ombi,
// usually auto-matched from that by username) — not a per-user self-service flow, since the admin
// is the one who already knows which Plex account is whose.
router.get('/:id/links', (req, res) => {
  const id = Number(req.params.id);
  if (!db.getUserById(id)) return res.status(404).json({ error: 'Not found' });
  res.json(db.listUserLinks(id));
});

router.put('/:id/links/:instanceId', (req, res) => {
  const id = Number(req.params.id);
  if (!db.getUserById(id)) return res.status(404).json({ error: 'Not found' });
  const instanceId = Number(req.params.instanceId);
  if (!db.getServiceInstance(instanceId)) return res.status(404).json({ error: 'Service instance not found' });
  const { externalId, externalName, auto } = req.body || {};
  if (!externalId) return res.status(400).json({ error: 'externalId is required' });
  res.json(db.upsertUserLink(id, instanceId, { externalId: String(externalId), externalName, auto: !!auto }));
});

router.delete('/:id/links/:instanceId', (req, res) => {
  const id = Number(req.params.id);
  if (!db.getUserById(id)) return res.status(404).json({ error: 'Not found' });
  db.deleteUserLink(id, Number(req.params.instanceId));
  res.json({ ok: true });
});

function serializeUserOut(u) {
  if (!u) return u;
  return { id: u.id, username: u.username, role: u.role, accessRoleId: u.access_role_id ?? null, createdAt: u.created_at };
}

function validateUsername(username, excludeId) {
  if (!username || typeof username !== 'string' || username.length < 2 || username.length > 64) {
    return 'Username must be 2-64 characters';
  }
  const existing = db.getUserByUsername(username);
  if (existing && existing.id !== excludeId) return 'Username already taken';
  return null;
}

function validatePassword(password) {
  if (!password || password.length < 6 || password.length > 128) return 'Password must be 6-128 characters';
  return null;
}

router.get('/', (_req, res) => {
  res.json(db.listUsers().map(serializeUserOut));
});

router.post('/', async (req, res) => {
  const { username, password, role } = req.body || {};
  const usernameError = validateUsername(username);
  if (usernameError) return res.status(400).json({ error: usernameError });
  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ error: passwordError });
  if (role && role !== 'admin' && role !== 'member') return res.status(400).json({ error: 'role must be "admin" or "member"' });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = db.createUser({ username, passwordHash, role: role || 'member' });
  logAction(req, 'user.created', { target: `user:${user.id}`, detail: `${user.username} (${user.role})` });
  res.status(201).json(serializeUserOut(user));
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = db.getUserById(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { username, password, role, accessRoleId } = req.body || {};
  if (username !== undefined) {
    const usernameError = validateUsername(username, id);
    if (usernameError) return res.status(400).json({ error: usernameError });
  }
  let passwordHash;
  if (password !== undefined) {
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ error: passwordError });
    passwordHash = await bcrypt.hash(password, 12);
  }
  if (role !== undefined && role !== 'admin' && role !== 'member') {
    return res.status(400).json({ error: 'role must be "admin" or "member"' });
  }
  if (accessRoleId !== undefined && accessRoleId !== null && !db.getAccessRoleById(accessRoleId)) {
    return res.status(400).json({ error: 'Access role not found' });
  }
  // A deployment with zero admins would lock everyone out of user management for good — refuse
  // to demote the last one, same protection deleteUser below applies to removal.
  if (existing.role === 'admin' && role === 'member' && db.countAdmins() <= 1) {
    return res.status(409).json({ error: 'Cannot demote the last remaining admin' });
  }
  const updated = db.updateUser(id, { username, passwordHash, role, accessRoleId });
  // A password reset should kill that user's existing sessions — otherwise a leaked/stolen
  // cookie signed under the old password keeps working right through the reset.
  if (passwordHash) db.bumpUserTokenValidAfter(id);
  const changes = [
    username !== undefined && `username → ${username}`,
    passwordHash && 'password reset',
    role !== undefined && `role → ${role}`,
    accessRoleId !== undefined && `access role → ${accessRoleId ?? 'none'}`,
  ].filter(Boolean);
  logAction(req, 'user.updated', { target: `user:${id}`, detail: changes.join(', ') || undefined });
  res.json(serializeUserOut(updated));
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.getUserById(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.role === 'admin' && db.countAdmins() <= 1) {
    return res.status(409).json({ error: 'Cannot delete the last remaining admin' });
  }
  db.deleteUser(id);
  logAction(req, 'user.deleted', { target: `user:${id}`, detail: existing.username });
  res.json({ ok: true });
});

module.exports = router;
