const express = require('express');
const db = require('../db');
const notify = require('../lib/notify');
const servarr = require('../lib/webhookParsers/servarr');
const overseerr = require('../lib/webhookParsers/overseerr');
const tautulli = require('../lib/webhookParsers/tautulli');

// Deliberately NOT behind requireAuth — the whole point is that Sonarr/Radarr/Prowlarr/Overseerr/
// Tautulli call this directly from their own webhook settings, with no way to complete our own
// login. The per-instance random token in the URL (db.js's getOrCreateWebhookToken) is what
// stops anyone else from posting fake events — same security model as a Discord/Slack webhook
// URL, whoever has the URL can post as it.
const router = express.Router();

const PARSERS = {
  sonarr: (body) => servarr.parse('sonarr', body),
  radarr: (body) => servarr.parse('radarr', body),
  prowlarr: (body) => servarr.parse('prowlarr', body),
  overseerr: (body) => overseerr.parse(body),
  tautulli: (body) => tautulli.parse(body),
};

router.post('/:instanceId/:token', async (req, res) => {
  const instance = db.getServiceInstanceByWebhookToken(Number(req.params.instanceId), req.params.token);
  if (!instance) return res.status(404).json({ error: 'Not found' });

  const parser = PARSERS[instance.service_id];
  if (!parser) return res.status(400).json({ error: `Webhooks aren't supported for ${instance.service_id}` });

  try {
    const result = parser(req.body || {});
    if (result) await notify.dispatch(result.eventKey, { title: result.title, body: result.body });
  } catch {
    // Malformed/unexpected payload from the calling service — still 200, so it doesn't treat
    // its notification connection as broken and start retrying/erroring in its own UI.
  }
  res.json({ ok: true });
});

module.exports = router;
