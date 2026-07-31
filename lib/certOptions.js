const { Agent } = require('undici');

// A per-instance opt-in for self-signed/expired certs (common on local IPs — e.g. Plex generates
// its own cert for plex.direct hostnames, which browsers accept via a pinned exception but
// Node's fetch rejects outright) — never a blanket process-wide bypass. One shared Agent instance
// is fine: `rejectUnauthorized: false` is the only thing it configures, so there's nothing
// per-instance to isolate between different services that opt in.
const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });

/** Spread into a fetch() options object: `fetch(url, { ...opts, ...certDispatcher(instance) })`.
 * Accepts either a raw DB row (snake_case `ignore_cert_errors`) or nothing. */
function certDispatcher(instance) {
  return instance?.ignore_cert_errors ? { dispatcher: insecureAgent } : {};
}

module.exports = { certDispatcher };
