// Same situation as Overseerr — Tautulli's webhook agent has no fixed schema, the admin authors
// the JSON body themselves per-trigger (Notification Agents > Webhook > Data tab, using Tautulli's
// single-{brace} template variables: https://docs.tautulli.com/using-tautulli/notification-agents-guide).
// Only works once that JSON is set to what Settings > Services documents:
//   { "action": "{action}", "title": "{title}", "user": "{user}" }
// `action` is Tautulli's own name for which trigger fired — used here to route to the right
// event rather than needing a separate JSON template per trigger.
const ACTION_MAP = {
  play: 'tautulli.playback_started',
  created: 'tautulli.recently_added',
};

function parse(body) {
  const eventKey = ACTION_MAP[body.action];
  if (!eventKey) return null;
  return {
    eventKey,
    title: eventKey === 'tautulli.recently_added' ? 'New media added to Plex' : 'Playback started',
    body: [body.title, body.user ? `by ${body.user}` : null].filter(Boolean).join(' '),
  };
}

module.exports = { parse };
