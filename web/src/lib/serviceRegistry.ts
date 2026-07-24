export type ServiceCategory = 'download-client' | 'arr' | 'indexer' | 'other';

export type AuthType =
  | 'apikey-query'
  | 'apikey-header'
  | 'apikey-url-segment'
  | 'basic-auth'
  | 'qbittorrent-session'
  | 'deluge-jsonrpc'
  | 'transmission-rpc'
  | 'torznab'
  | 'trakt'
  | 'bearer-token'
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
    comingSoon: true,
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
    comingSoon: true,
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
    comingSoon: true,
    healthCheck: { path: '/transmission/rpc', method: 'POST', body: { method: 'session-get' } },
  },
  {
    id: 'utorrent',
    category: 'download-client',
    displayName: 'µTorrent',
    brandColor: '#6dbe49',
    authType: 'basic-auth',
    fields: [usernameField, passwordField],
    helpText: 'Newer µTorrent WebUI builds add a CSRF token dance on top of Basic Auth — unverified here, works best with older/classic WebUI configs.',
    comingSoon: true,
  },
  {
    id: 'qbittorrent',
    category: 'download-client',
    displayName: 'qBittorrent',
    brandColor: '#2f67d8',
    authType: 'qbittorrent-session',
    fields: [usernameField, passwordField],
    hasDetailScreen: true,
    comingSoon: true,
    healthCheck: { path: '/api/v2/app/version' },
  },
  {
    id: 'rutorrent',
    category: 'download-client',
    displayName: 'rTorrent / ruTorrent',
    brandColor: '#7c5cd6',
    authType: 'basic-auth',
    fields: [usernameField, passwordField],
    helpText: 'Connects via ruTorrent’s HTTP API.',
    comingSoon: true,
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
    comingSoon: true,
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
    comingSoon: true,
    healthCheck: { path: '/api/v1/system/status' },
  },
  {
    id: 'bazarr',
    category: 'arr',
    displayName: 'Bazarr',
    brandColor: '#3e5c76',
    authType: 'apikey-header',
    fields: [apiKeyField],
    hideFromNav: true,
  },
  {
    id: 'sickbeard',
    category: 'arr',
    displayName: 'Sick Beard',
    brandColor: '#6fbe44',
    authType: 'apikey-url-segment',
    fields: [apiKeyField],
    comingSoon: true,
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
    comingSoon: true,
    helpText: 'Enter one indexer’s Torznab feed URL from Jackett (e.g. .../api/v2.0/indexers/all/results/torznab) as the Local URL.',
    healthCheck: { path: '', query: { t: 'caps' } },
  },
  {
    id: 'nzbhydra2',
    category: 'indexer',
    displayName: 'NZBHydra2',
    brandColor: '#4caf50',
    authType: 'torznab',
    fields: [apiKeyField],
    hasDetailScreen: true,
    comingSoon: true,
    helpText: 'Enter NZBHydra2’s Torznab endpoint (e.g. .../torznab/api) as the Local URL.',
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
    authType: 'none',
    fields: [],
    comingSoon: true,
    helpText: 'No stable remote API — this is a deep-link tile to your WebGUI. Use Wake-on-LAN below to wake the server.',
  },
  {
    id: 'overseerr',
    category: 'other',
    displayName: 'Overseerr / Seerr',
    brandColor: '#6c56e6',
    authType: 'apikey-header',
    fields: [apiKeyField],
    hasDetailScreen: true,
    healthCheck: { path: '/api/v1/status' },
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
