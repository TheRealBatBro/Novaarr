const { Agent } = require('undici');
const { safeLookup } = require('./ssrf');

// Every outbound proxy fetch goes through one of these two shared Agents — never the bare
// global fetch dispatcher — so `connect.lookup: safeLookup` (DNS-rebinding-safe SSRF
// protection, see lib/ssrf.js) applies unconditionally, on every request, not just ones opting
// into the cert bypass below.
const safeAgent = new Agent({ connect: { lookup: safeLookup } });

// A per-instance opt-in for self-signed/expired certs (common on local IPs — e.g. Plex generates
// its own cert for plex.direct hostnames, which browsers accept via a pinned exception but
// Node's fetch rejects outright) — never a blanket process-wide bypass. One shared Agent instance
// is fine: these two options are the only things it configures, so there's nothing per-instance
// to isolate between different services that opt in.
const safeInsecureAgent = new Agent({ connect: { lookup: safeLookup, rejectUnauthorized: false } });

/** Spread into a fetch() options object: `fetch(url, { ...opts, ...certDispatcher(instance) })`.
 * Accepts either a raw DB row (snake_case `ignore_cert_errors`) or nothing. */
function certDispatcher(instance) {
  return { dispatcher: instance?.ignore_cert_errors ? safeInsecureAgent : safeAgent };
}

module.exports = { certDispatcher };
