const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/widgets', (_req, res) => {
  res.json(db.getDashboardWidgets());
});

router.put('/widgets', (req, res) => {
  const widgets = Array.isArray(req.body) ? req.body : [];
  res.json(db.setDashboardWidgets(widgets));
});

module.exports = router;
