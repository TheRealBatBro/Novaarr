// The canonical list of things Novaarr can alert on — every action already recorded in the
// audit log (db.js's logAudit, fired from lib/audit.js's logAction and a few direct call sites
// in routes/auth.js/webauthn.js), plus the one existing background poller (Overseerr pending
// requests). Deliberately NOT attempting per-service events (e.g. "Sonarr grabbed a release") —
// Novaarr doesn't receive webhooks from those services today; that's a separate, larger feature.
const EVENTS = [
  { key: 'auth.login', label: 'Successful sign-in', group: 'Security' },
  { key: 'auth.login_failed', label: 'Failed sign-in attempt', group: 'Security' },
  { key: 'auth.credential_changed', label: 'PIN/password changed', group: 'Security' },
  { key: 'auth.sessions_revoked', label: 'Sessions revoked ("sign out everywhere")', group: 'Security' },
  { key: 'auth.multi_user_enabled', label: 'Switched to multi-user mode', group: 'Security' },
  { key: 'auth.2fa_enabled', label: 'Two-factor authentication enabled', group: 'Security' },
  { key: 'auth.2fa_disabled', label: 'Two-factor authentication disabled', group: 'Security' },
  { key: 'auth.passkey_added', label: 'Passkey added', group: 'Security' },
  { key: 'auth.passkey_removed', label: 'Passkey removed', group: 'Security' },
  { key: 'service.created', label: 'Service added', group: 'Configuration' },
  { key: 'service.updated', label: 'Service edited', group: 'Configuration' },
  { key: 'service.deleted', label: 'Service removed', group: 'Configuration' },
  { key: 'user.created', label: 'User account created', group: 'Configuration' },
  { key: 'user.updated', label: 'User account edited', group: 'Configuration' },
  { key: 'user.deleted', label: 'User account deleted', group: 'Configuration' },
  { key: 'access_role.created', label: 'Access role created', group: 'Configuration' },
  { key: 'access_role.updated', label: 'Access role edited', group: 'Configuration' },
  { key: 'access_role.deleted', label: 'Access role deleted', group: 'Configuration' },
  { key: 'overseerr.pending_requests', label: 'New pending Overseerr/Jellyseerr request', group: 'Media' },

  // Everything below arrives via that service's own OUTBOUND webhook, configured in its
  // notification settings to point at the URL shown in Settings > Services for that instance —
  // not something Novaarr polls for. See routes/webhooks.js and lib/webhookParsers/*.
  { key: 'sonarr.grab', label: 'Sonarr grabbed a release', group: 'Sonarr' },
  { key: 'sonarr.download', label: 'Sonarr imported an episode', group: 'Sonarr' },
  { key: 'sonarr.health', label: 'Sonarr health issue', group: 'Sonarr' },
  { key: 'radarr.grab', label: 'Radarr grabbed a release', group: 'Radarr' },
  { key: 'radarr.download', label: 'Radarr imported a movie', group: 'Radarr' },
  { key: 'radarr.health', label: 'Radarr health issue', group: 'Radarr' },
  { key: 'prowlarr.health', label: 'Prowlarr health issue', group: 'Prowlarr' },
  { key: 'overseerr.media_pending', label: 'New request awaiting approval', group: 'Overseerr / Jellyseerr' },
  { key: 'overseerr.media_approved', label: 'Request approved', group: 'Overseerr / Jellyseerr' },
  { key: 'overseerr.media_available', label: 'Requested media is now available', group: 'Overseerr / Jellyseerr' },
  { key: 'overseerr.media_declined', label: 'Request declined', group: 'Overseerr / Jellyseerr' },
  { key: 'overseerr.media_failed', label: 'Request failed to process', group: 'Overseerr / Jellyseerr' },
  { key: 'overseerr.issue_created', label: 'New issue reported', group: 'Overseerr / Jellyseerr' },
  { key: 'tautulli.playback_started', label: 'Playback started', group: 'Tautulli' },
  { key: 'tautulli.recently_added', label: 'New media added to Plex', group: 'Tautulli' },
];

const LABELS = Object.fromEntries(EVENTS.map((e) => [e.key, e.label]));

module.exports = { EVENTS, LABELS };
