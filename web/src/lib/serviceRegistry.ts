export type ServiceCategory = 'download-client' | 'arr' | 'indexer' | 'other';

export type AuthType =
  | 'apikey-query'
  | 'apikey-header'
  | 'ombi-apikey'
  | 'apikey-url-segment'
  | 'basic-auth'
  | 'utorrent-token'
  | 'rutorrent-xmlrpc'
  | 'qbittorrent-session'
  | 'deluge-jsonrpc'
  | 'transmission-rpc'
  | 'torznab'
  | 'trakt'
  | 'bearer-token'
  | 'plex-token'
  | 'emby-token'
  | 'none';

export type ServiceFieldDef = {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url';
  required: boolean;
  placeholder?: string;
  helpText?: string;
};

/** The cheapest real request that proves an instance is reachable and responding — used for
 * the nav's online/offline dot. Routed through the same /api/proxy adapter as everything else,
 * so it inherits that adapter's own auth handling, timeout, and error containment. */
export type ServiceHealthCheck = {
  path: string;
  method?: string;
  query?: Record<string, string>;
  body?: unknown;
};

export type ServiceDefinition = {
  id: string;
  category: ServiceCategory;
  displayName: string;
  brandColor: string;
  authType: AuthType;
  fields: ServiceFieldDef[];
  hasDetailScreen?: boolean;
  helpText?: string;
  /** Cloud APIs with no self-hosted URL (e.g. Trakt) — the Local/Remote URL fields are hidden and this is used instead. */
  fixedBaseUrl?: string;
  /** Services that only power features embedded in other screens (e.g. Bazarr's subtitle
   * controls on movie/series detail pages) — configurable in Settings > Services as usual, but
   * excluded from the sidebar/command palette and given no page of their own. */
  hideFromNav?: boolean;
  /** Registered (auth type + form fields exist) but with no built screen yet — falls back to
   * GenericServiceScreen's stub. Settings > Services shows "Coming soon" instead of an Add
   * button so users aren't surprised by an empty page. */
  comingSoon?: boolean;
  /** Omitted for services with no pingable API (e.g. Unraid) — their nav dot stays neutral. */
  healthCheck?: ServiceHealthCheck;
};

const apiKeyField: ServiceFieldDef = {
  key: 'apiKey',
  label: 'API Key',
  type: 'password',
  required: true,
};

const usernameField: ServiceFieldDef = { key: 'username', label: 'Username', type: 'text', required: true };
const passwordField: ServiceFieldDef = { key: 'password', label: 'Password', type: 'password', required: true };

export const SERVICE_REGISTRY: ServiceDefinition[] = [
  // ── Download clients ──────────────────────────────────────────────────
  {
    id: 'sabnzbd',
    category: 'download-client',
    displayName: 'SABnzbd',
    brandColor: '#f2b632',
    authType: 'apikey-query',
    fields: [apiKeyField],
    hasDetailScreen: true,
    healthCheck: { path: '/api', query: { mode: 'version', output: 'json' } },
  },
  {
    id: 'nzbget',
    category: 'download-client',
    displayName: 'NZBGet',
    brandColor: '#4caf50',
    authType: 'basic-auth',
    fields: [usernameField, passwordField],
    hasDetailScreen: true,
    healthCheck: { path: '/jsonrpc', method: 'POST', body: { method: 'version', params: [], id: 1 } },
  },
  {
    id: 'deluge',
    category: 'download-client',
    displayName: 'Deluge',
    brandColor: '#52a2da',
    authType: 'deluge-jsonrpc',
    fields: [{ ...passwordField, label: 'Web UI Password' }],
    hasDetailScreen: true,
    helpText: 'The daemon-connect handshake is best-effort and unverified against a live Deluge instance.',
    healthCheck: { path: '/json', method: 'POST', body: { method: 'daemon.info', params: [] } },
  },
  {
    id: 'transmission',
    category: 'download-client',
    displayName: 'Transmission',
    brandColor: '#cf4a3d',
    authType: 'transmission-rpc',
    fields: [
      { ...usernameField, required: false },
      { ...passwordField, required: false, helpText: 'Leave blank if Transmission has no auth enabled' },
    ],
    hasDetailScreen: true,
    healthCheck: { path: '/transmission/rpc', method: 'POST', body: { method: 'session-get' } },
  },
  {
    id: 'utorrent',
    category: 'download-client',
    displayName: 'µTorrent',
    brandColor: '#6dbe49',
    authType: 'utorrent-token',
    fields: [usernameField, passwordField],
    hasDetailScreen: true,
    helpText: 'Uses the classic µTorrent WebUI (Settings → Advanced → Web UI). Enable it and use those credentials here.',
    healthCheck: { path: '/gui/', query: { list: '1' } },
  },
  {
    id: 'qbittorrent',
    category: 'download-client',
    displayName: 'qBittorrent',
    brandColor: '#2f67d8',
    authType: 'qbittorrent-session',
    fields: [usernameField, passwordField],
    hasDetailScreen: true,
    healthCheck: { path: '/api/v2/app/version' },
  },
  {
    id: 'rutorrent',
    category: 'download-client',
    displayName: 'rTorrent / ruTorrent',
    brandColor: '#7c5cd6',
    authType: 'rutorrent-xmlrpc',
    fields: [usernameField, passwordField],
    hasDetailScreen: true,
    helpText: 'This is the HTTP Basic Auth that gates your ruTorrent directory (its .htaccess/reverse-proxy credentials) — ruTorrent has no separate login of its own.',
    healthCheck: { path: '', body: { method: 'system.client_version', params: [] } },
  },

  // ── *arr suite / search clients ──────────────────────────────────────
  {
    id: 'sonarr',
    category: 'arr',
    displayName: 'Sonarr',
    brandColor: '#365fe0',
    authType: 'apikey-header',
    fields: [apiKeyField],
    hasDetailScreen: true,
    healthCheck: { path: '/api/v3/system/status' },
  },
  {
    id: 'radarr',
    category: 'arr',
    displayName: 'Radarr',
    brandColor: '#f5b942',
    authType: 'apikey-header',
    fields: [apiKeyField],
    hasDetailScreen: true,
    healthCheck: { path: '/api/v3/system/status' },
  },
  {
    id: 'lidarr',
    category: 'arr',
    displayName: 'Lidarr',
    brandColor: '#1fb8a3',
    authType: 'apikey-header',
    fields: [apiKeyField],
    hasDetailScreen: true,
    helpText: 'Shows the download queue and history. Its artist/album library shape differs enough from Sonarr/Radarr that it doesn’t get its own library browser yet.',
    healthCheck: { path: '/api/v1/system/status' },
  },
  {
    id: 'readarr',
    category: 'arr',
    displayName: 'Readarr',
    brandColor: '#b4282c',
    authType: 'apikey-header',
    fields: [apiKeyField],
    hasDetailScreen: true,
    helpText: 'Shows the download queue and history. Its author/book library shape differs enough from Sonarr/Radarr that it doesn’t get its own library browser yet.',
    healthCheck: { path: '/api/v1/system/status' },
  },
  {
    id: 'bazarr',
    category: 'arr',
    displayName: 'Bazarr',
    brandColor: '#3e5c76',
    authType: 'apikey-header',
    fields: [apiKeyField],
    hasDetailScreen: true,
    healthCheck: { path: '/api/system/status' },
  },
  {
    id: 'sickbeard',
    category: 'arr',
    displayName: 'Sick Beard',
    brandColor: '#6fbe44',
    authType: 'apikey-url-segment',
    fields: [apiKeyField],
    hasDetailScreen: true,
    helpText: 'Requires "Use API" to be enabled under Config → General in Sick Beard, alongside the API key shown there.',
    healthCheck: { path: '', query: { cmd: 'sb.ping' } },
  },

  // ── Indexers (manual search) ─────────────────────────────────────────
  {
    id: 'newznab',
    category: 'indexer',
    displayName: 'NEWZnab',
    brandColor: '#7c8f4b',
    authType: 'torznab',
    fields: [apiKeyField],
    hasDetailScreen: true,
    comingSoon: true,
    helpText: 'Enter the exact Torznab endpoint URL (including any indexer-specific path) as the Local URL.',
    healthCheck: { path: '', query: { t: 'caps' } },
  },
  {
    id: 'jackett',
    category: 'indexer',
    displayName: 'Jackett',
    brandColor: '#4b4b4b',
    authType: 'torznab',
    fields: [apiKeyField],
    hasDetailScreen: true,
    helpText:
      'Enter Jackett’s server URL (e.g. http://host:9117) as the Local URL, and the API key shown on Jackett’s dashboard. If Jackett has an admin password set, its indexer list won’t load — API-key auth only works for the search endpoints in that case, not the indexer-management ones.',
    healthCheck: { path: '/api/v2.0/indexers/all/results/torznab/api', query: { t: 'caps' } },
  },
  {
    id: 'nzbhydra2',
    category: 'indexer',
    displayName: 'NZBHydra2',
    brandColor: '#4caf50',
    authType: 'torznab',
    fields: [apiKeyField],
    hasDetailScreen: true,
    helpText: 'Enter NZBHydra2’s Newznab API endpoint (e.g. http://host:5076/api) as the Local URL — find it via the “API?” button on NZBHydra2’s config page.',
    healthCheck: { path: '', query: { t: 'caps' } },
  },
  {
    id: 'prowlarr',
    category: 'indexer',
    displayName: 'Prowlarr',
    brandColor: '#ff6d2d',
    authType: 'apikey-header',
    fields: [apiKeyField],
    hasDetailScreen: true,
    healthCheck: { path: '/api/v1/system/status' },
  },

  // ── Other services ────────────────────────────────────────────────────
  {
    id: 'unraid',
    category: 'other',
    displayName: 'Unraid',
    brandColor: '#f15a2c',
    authType: 'apikey-header',
    fields: [apiKeyField],
    hasDetailScreen: true,
    helpText:
      'Enable the API under Settings → Management Access → API Keys in Unraid (6.12.15+), create a key there, and enter your server’s base URL (e.g. http://192.168.1.50) as the Local URL — a Tailscale address works too as the Remote URL.',
    healthCheck: { path: '/graphql', method: 'POST', body: { query: '{ info { os { hostname } } }' } },
  },
  {
    id: 'overseerr',
    category: 'other',
    displayName: 'Seerr',
    brandColor: '#6c56e6',
    authType: 'apikey-header',
    fields: [apiKeyField],
    hasDetailScreen: true,
    healthCheck: { path: '/api/v1/status' },
  },
  {
    id: 'ombi',
    category: 'other',
    displayName: 'Ombi',
    brandColor: '#e37200',
    authType: 'ombi-apikey',
    fields: [apiKeyField],
    hasDetailScreen: true,
    helpText: 'Media request management, like Seerr — find your API key under Settings → Configuration → Ombi in Ombi’s own UI.',
    healthCheck: { path: '/api/v1/Status' },
  },
  {
    id: 'tautulli',
    category: 'other',
    displayName: 'Tautulli',
    brandColor: '#daa520',
    authType: 'apikey-query',
    fields: [apiKeyField],
    hasDetailScreen: true,
    healthCheck: { path: '/api/v2', query: { cmd: 'get_server_info' } },
  },
  {
    id: 'plex',
    category: 'other',
    displayName: 'Plex',
    brandColor: '#e5a00d',
    authType: 'plex-token',
    fields: [
      {
        key: 'apiKey',
        label: 'Plex Token',
        type: 'password',
        required: true,
        helpText: 'Your X-Plex-Token — find it by inspecting any request Plex Web makes in your browser’s dev tools, or search "finding an authentication token" on plex.tv/support.',
      },
    ],
    helpText: 'Powers the dashboard’s recently-added, collections, and library-stats widgets directly from Plex — separate from Tautulli, which tracks watch activity instead.',
    // Purely a background data source for dashboard widgets (like Trakt) — no page of its own.
    hideFromNav: true,
    healthCheck: { path: '/identity' },
  },
  {
    id: 'emby',
    category: 'other',
    displayName: 'Emby',
    brandColor: '#52b54b',
    authType: 'emby-token',
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        helpText: 'Generate one under Emby Dashboard → Advanced → API Keys.',
      },
    ],
    helpText: 'Powers the dashboard’s recently-added, collections, and library-stats widgets directly from Emby.',
    hideFromNav: true,
    healthCheck: { path: '/System/Info/Public' },
  },
  {
    id: 'jellyfin',
    category: 'other',
    displayName: 'Jellyfin',
    brandColor: '#00a4dc',
    authType: 'emby-token',
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        helpText: 'Generate one under Jellyfin Dashboard → API Keys.',
      },
    ],
    helpText: 'Powers the dashboard’s recently-added, collections, and library-stats widgets directly from Jellyfin.',
    hideFromNav: true,
    healthCheck: { path: '/System/Info/Public' },
  },
  {
    id: 'tracearr',
    category: 'other',
    displayName: 'Tracearr',
    brandColor: '#2196f3',
    authType: 'bearer-token',
    fields: [apiKeyField],
    hasDetailScreen: true,
    healthCheck: { path: '/api/v1/public/stats/today' },
  },
  {
    id: 'trakt',
    category: 'other',
    displayName: 'Trakt',
    brandColor: '#ed2224',
    authType: 'trakt',
    fixedBaseUrl: 'https://api.trakt.tv',
    fields: [
      {
        key: 'apiKey',
        label: 'Client ID',
        type: 'password',
        required: true,
        helpText: 'Create a free API app at trakt.tv/oauth/applications and use its Client ID — no OAuth login needed for public lists.',
      },
    ],
    helpText: 'Powers the dashboard’s trending/anticipated carousels. A cloud API — no local/remote URL to configure.',
    healthCheck: { path: '/genres/movies' },
    // Purely a background data source for the dashboard carousels (like Bazarr's subtitle
    // integration) — no page of its own to link to, so it's configured in Settings > Services
    // as usual but doesn't get a slot in the nav/command palette.
    hideFromNav: true,
  },
  {
    id: 'mdblist',
    category: 'other',
    displayName: 'MDBList',
    brandColor: '#f5a623',
    authType: 'apikey-query',
    fixedBaseUrl: 'https://api.mdblist.com',
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        helpText: 'Find your key at mdblist.com/preferences under API Access. Free-tier keys are capped at 1,000 requests/day.',
      },
    ],
    helpText: 'An alternative to Trakt for the dashboard’s trending/anticipated carousels — same widgets, different data source.',
    healthCheck: { path: '/user' },
    hideFromNav: true,
  },
  {
    id: 'maintainerr',
    category: 'other',
    displayName: 'Maintainerr',
    brandColor: '#6366f1',
    // Maintainerr has no authentication of its own — anyone who can reach its URL can call its
    // API. Nothing to configure beyond the URL itself.
    authType: 'none',
    fields: [],
    hasDetailScreen: true,
    helpText:
      'Automated library cleanup for Plex/Jellyfin/Emby — rule-based collections that flag and remove media nobody\'s watching. Maintainerr has no login of its own, so just point this at its URL (default port 6246).',
    healthCheck: { path: '/api/health' },
  },
];

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  'download-client': 'Download Clients',
  arr: '*arr Suite',
  indexer: 'Indexers',
  other: 'Other Services',
};

export const CATEGORY_ORDER: ServiceCategory[] = ['download-client', 'arr', 'indexer', 'other'];

export function getServiceDefinition(serviceId: string): ServiceDefinition | undefined {
  return SERVICE_REGISTRY.find((s) => s.id === serviceId);
}
