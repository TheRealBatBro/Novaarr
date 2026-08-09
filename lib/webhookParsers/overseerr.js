// Overseerr/Jellyseerr's webhook agent has no fixed schema — the admin authors the exact JSON
// body themselves (Settings > Notifications > Webhook, using {{double-brace}} template
// variables), so this only works once that JSON is set to what Settings > Services documents:
//   { "notification_type": "{{notification_type}}", "subject": "{{subject}}", "message": "{{message}}" }
// Field/variable names confirmed against overseerr's own source
// (server/lib/notifications/agents/webhook.ts's KeyMap, server/lib/notifications/index.ts's
// Notification enum) rather than guessed.
const TYPE_MAP = {
  MEDIA_PENDING: 'overseerr.media_pending',
  MEDIA_APPROVED: 'overseerr.media_approved',
  MEDIA_AUTO_APPROVED: 'overseerr.media_approved',
  MEDIA_AVAILABLE: 'overseerr.media_available',
  MEDIA_DECLINED: 'overseerr.media_declined',
  MEDIA_FAILED: 'overseerr.media_failed',
  ISSUE_CREATED: 'overseerr.issue_created',
};

function parse(body) {
  const eventKey = TYPE_MAP[body.notification_type];
  if (!eventKey) return null; // TEST_NOTIFICATION and comment/reopened/resolved types aren't tracked events today
  return { eventKey, title: body.subject || 'Overseerr', body: body.message || '' };
}

module.exports = { parse };
