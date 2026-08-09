// Shared by Sonarr, Radarr, and Prowlarr — all three ship the same webhook notification
// connection type from the shared Servarr codebase. Field names are confirmed against each
// project's own C# source (NzbDrone.Core/Notifications/Webhook/*.cs), but the JSON casing that
// actually reaches this endpoint is genuinely ambiguous — Radarr's own source has a code comment
// saying camelCase is a planned v4 change, implying it isn't consistently camelCase yet — so
// every field is read defensively under both casings rather than picking one and hoping.
function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined) return obj[k];
  }
  return undefined;
}

function mediaTitle(body) {
  const movie = pick(body, 'movie', 'Movie');
  const series = pick(body, 'series', 'Series');
  if (movie) return `${pick(movie, 'title', 'Title')} (${pick(movie, 'year', 'Year') ?? ''})`.trim();
  if (series) return pick(series, 'title', 'Title');
  return null;
}

// Returns { eventKey, title, body } to dispatch, or null to acknowledge without notifying
// (Test — Sonarr/Radarr/Prowlarr just want a 200 back to confirm connectivity; and any event
// type not in the registry, e.g. Rename/ApplicationUpdate, which would just be noise today).
function parse(serviceId, body) {
  const eventType = pick(body, 'eventType', 'EventType');
  const label = serviceId === 'sonarr' ? 'Sonarr' : serviceId === 'radarr' ? 'Radarr' : 'Prowlarr';

  if (eventType === 'Grab') {
    const release = pick(body, 'release', 'Release') || {};
    const releaseTitle = pick(release, 'releaseTitle', 'ReleaseTitle') || pick(body, 'releaseTitle', 'ReleaseTitle');
    return {
      eventKey: `${serviceId}.grab`,
      title: `${label} grabbed a release`,
      body: [mediaTitle(body), releaseTitle].filter(Boolean).join(' — ') || 'A release was grabbed',
    };
  }

  if (eventType === 'Download') {
    const isUpgrade = pick(body, 'isUpgrade', 'IsUpgrade');
    return {
      eventKey: `${serviceId}.download`,
      title: `${label} ${isUpgrade ? 'upgraded' : 'imported'} media`,
      body: mediaTitle(body) || 'A download finished importing',
    };
  }

  if (eventType === 'Health' || eventType === 'HealthRestored') {
    const message = pick(body, 'message', 'Message') || pick(body, 'level', 'Level') || 'Health status changed';
    return {
      eventKey: `${serviceId}.health`,
      title: `${label} health ${eventType === 'HealthRestored' ? 'restored' : 'issue'}`,
      body: String(message),
    };
  }

  return null;
}

module.exports = { parse };
