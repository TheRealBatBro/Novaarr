const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);
router.use(requireAdmin);

// Unlike the cloudflared sidecar (which exposes a plain --metrics HTTP endpoint by design), the
// Tailscale sidecar shares this container's network namespace (docker-compose.yml's commented
// `network_mode: service:novaarr`) rather than talking over the Compose network by name — that's
// what actually makes novaarr itself reachable on the tailnet, and as a side effect it also means
// tailscaled's LocalAPI is reachable at localhost, IF the sidecar sets TS_LOCAL_ADDR_PORT to
// expose it. The LocalAPI requires the `Sec-Tailscale: localapi` header on every request (an
// undocumented-but-stable CSRF-style guard against arbitrary localhost callers) — without it,
// tailscaled just refuses the request outright, which looks identical to "not running" from here.
// Not confirmed against a live Tailscale sidecar in this session; if this never reports
// "connected" on a real setup, the LocalAPI's exact port/path/header requirement is the first
// thing to double check against Tailscale's current docs.
const LOCAL_API_URL = 'http://localhost:41112/localapi/v0/status';
const TIMEOUT_MS = 2000;

router.get('/status', async (_req, res) => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(LOCAL_API_URL, { headers: { 'Sec-Tailscale': 'localapi' }, signal: controller.signal });
    if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`);
    const body = await upstream.json();
    const self = body?.Self;
    res.json({
      configured: true,
      connected: body?.BackendState === 'Running' && !!self?.Online,
      hostname: self?.DNSName ? self.DNSName.replace(/\.$/, '') : process.env.TAILSCALE_HOSTNAME || null,
      tailscaleIp: self?.TailscaleIPs?.[0] || null,
    });
  } catch {
    // Sidecar never started, LocalAPI not exposed on this port, or the header requirement
    // changed — any of these look the same from here: just not set up.
    res.json({ configured: false, connected: false, hostname: process.env.TAILSCALE_HOSTNAME || null, tailscaleIp: null });
  } finally {
    clearTimeout(t);
  }
});

module.exports = router;
