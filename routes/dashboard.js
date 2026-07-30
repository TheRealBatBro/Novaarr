const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Simple mode (req.user is {ok: true}, no userId) keeps reading/writing the single global
// layout exactly as before; multi-user mode scopes to the signed-in user's own layout.
function scopeUserId(req) {
  return db.isMultiUser() ? req.user?.userId : undefined;
}

router.get('/widgets', (req, res) => {
  res.json(db.getDashboardWidgets(scopeUserId(req)));
});

router.put('/widgets', (req, res) => {
  const widgets = Array.isArray(req.body) ? req.body : [];
  res.json(db.setDashboardWidgets(widgets, scopeUserId(req)));
});

module.exports = router;
