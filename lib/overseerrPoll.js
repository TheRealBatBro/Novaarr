const db = require('../db');
const { sendPushToAll } = require('./pushNotify');
const notify = require('./notify');

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 8000;

// Overseerr/Jellyseerr's own count endpoint — cheap, purpose-built for exactly this ("how many
// requests are waiting on me"), rather than paging through the full request list.
async function fetchPendingCount(instance) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const base = instance.local_url.endsWith('/') ? instance.local_url : instance.local_url + '/';
    const url = new URL('api/v1/request/count', base);
    const res = await fetch(url, { headers: { 'X-Api-Key': instance.credentials?.apiKey || '' }, signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.pending === 'number' ? data.pending : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Notifies once whenever a configured Overseerr/Jellyseerr instance's pending-request count goes
// up since the last check — a real, automatic trigger rather than a manual test button only. Only
// fires on an increase (never on a decrease, which just means someone approved/declined requests)
// so it can't spam on every poll while a backlog sits unresolved.
async function pollOnce() {
  const instances = db.listServiceInstances().filter((i) => i.enabled && i.service_id === 'overseerr' && i.local_url);
  if (!instances.length) return;

  const seen = db.getOverseerrPendingSeen();
  let changed = false;

  for (const instance of instances) {
    const count = await fetchPendingCount(instance);
    if (count === null) continue;
    const previous = seen[instance.id] ?? count;
    if (count > previous) {
      const body = `${count} request${count === 1 ? '' : 's'} pending approval in ${instance.display_name}.`;
      await sendPushToAll({ title: 'New media request', body, tag: `overseerr-pending-${instance.id}`, url: 'service/' + instance.id });
      await notify.dispatch('overseerr.pending_requests', { title: 'New media request', body }).catch(() => {});
    }
    seen[instance.id] = count;
    changed = true;
  }

  if (changed) db.setOverseerrPendingSeen(seen);
}

function startOverseerrPoller() {
  pollOnce().catch(() => {});
  setInterval(() => pollOnce().catch(() => {}), POLL_INTERVAL_MS);
}

module.exports = { startOverseerrPoller };
