const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);
router.use(requireAdmin);

// The cloudflared sidecar (see docker-compose.yml) is reachable by its Compose service name —
// "cloudflared" resolves over the shared Compose network regardless of the deployment's own
// container/project name, same as how service instances reach each other by container name
// rather than a fixed IP. Its --metrics flag is bound to 0.0.0.0 there specifically so this
// cross-container request works; it's still never exposed outside the Compose network.
const METRICS_URL = 'http://cloudflared:2000/ready';
const TIMEOUT_MS = 2000;

router.get('/status', async (_req, res) => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(METRICS_URL, { signal: controller.signal });
    const body = await upstream.json().catch(() => null);
    res.json({
      // Reachable at all means the sidecar container exists and is running — distinct from
      // "connected", which additionally means it has an active connection to Cloudflare's edge.
      configured: true,
      connected: upstream.ok,
      hostname: process.env.CLOUDFLARE_TUNNEL_HOSTNAME || null,
      detail: body,
    });
  } catch {
    // Connection refused/timeout — almost always just means the optional sidecar was never
    // uncommented, not a real error worth logging.
    res.json({ configured: false, connected: false, hostname: process.env.CLOUDFLARE_TUNNEL_HOSTNAME || null });
  } finally {
    clearTimeout(t);
  }
});

module.exports = router;
