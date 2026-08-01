const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);
router.use(requireAdmin);

function serialize(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    actorUserId: row.actor_user_id,
    actorLabel: row.actor_label,
    action: row.action,
    target: row.target,
    detail: row.detail,
    ip: row.ip,
  };
}

router.get('/', (req, res) => {
  const { limit, action } = req.query;
  res.json(db.listAuditLog({ limit: limit ? Number(limit) : undefined, action }).map(serialize));
});

module.exports = router;
