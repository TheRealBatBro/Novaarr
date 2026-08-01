const db = require('../db');

// Thin wrapper around db.logAudit that resolves "who" from the request instead of making every
// call site repeat the multi-user/simple-mode branch. In simple mode there's no per-person
// identity at all, so the actor is just labeled "admin" (the one shared credential).
function logAction(req, action, { target, detail } = {}) {
  let actorUserId = null;
  let actorLabel = 'admin';
  if (db.isMultiUser() && req.user?.userId) {
    const user = db.getUserById(req.user.userId);
    actorUserId = user?.id ?? null;
    actorLabel = user?.username ?? `user:${req.user.userId}`;
  }
  db.logAudit({ actorUserId, actorLabel, action, target, detail, ip: req.ip });
}

module.exports = { logAction };
