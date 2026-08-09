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
];

const LABELS = Object.fromEntries(EVENTS.map((e) => [e.key, e.label]));

module.exports = { EVENTS, LABELS };
