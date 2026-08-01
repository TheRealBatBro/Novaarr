// Sub-path this app is served from behind a reverse proxy (e.g. "/remotarr"), injected by
// server.js from BASE_PATH — see web/src/lib/visibility.ts for the Window type declaration.
// Every request to OUR OWN backend must go through this, since the browser only knows the
// domain root, not whatever path a proxy mounted us at. Paths passed to the /api/proxy/:id
// generic proxy (e.g. Sonarr's own `/api/v3/movie`) are a different thing — those describe a
// path on the REMOTE service, resolved server-side, and must NOT be prefixed with this.
import { runWithInstanceLimit } from './concurrency';

export const BASE_PATH = typeof window !== 'undefined' ? window.__BASE_PATH__ || '' : '';
export function apiUrl(path: string): string {
  return `${BASE_PATH}${path}`;
}

export type AuthMode = 'pin' | 'password';
export type UserLink = { instanceId: number; externalId: string; externalName?: string | null; auto: boolean };
export type AppUser = {
  id: number;
  username: string;
  role: 'admin' | 'member';
  accessRoleId?: number | null;
  links?: UserLink[];
  /** Non-null only when the assigned role curated a specific widget list — null means no
   * widget-level restriction beyond whatever service-level access already allows. */
  widgetKeys?: string[] | null;
  /** Whether the Calendar nav item shows at all — distinct from whether any specific
   * Sonarr/Radarr page is reachable (see ServiceInstance.calendarAllowed for that). */
  calendarAccessible?: boolean;
};
export type AccessRoleWidget = { widgetKey: string; instanceId: number };
export type AccessRole = { id: number; name: string; serviceInstanceIds: number[]; widgets: AccessRoleWidget[]; calendarSourceIds: number[] };
export type AuthStatus = {
  hasCredential: boolean;
  authMode: AuthMode | null;
  authenticated: boolean;
  multiUser: boolean;
  user?: AppUser;
};

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && (data.error as string)) || `Request failed (${res.status})`);
  }
  return data as T;
}

export const authApi = {
  status: () => fetch(apiUrl('/api/auth/status'), { credentials: 'same-origin' }).then((r) => json<AuthStatus>(r)),
  setup: (mode: AuthMode, credential: string) =>
    fetch(apiUrl('/api/auth/setup'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, credential }),
    }).then((r) => json<{ ok: true }>(r)),
  login: (credential: string) =>
    fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    }).then((r) => json<{ ok: true }>(r)),
  loginMultiUser: (username: string, password: string) =>
    fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then((r) => json<{ ok: true; user: AppUser }>(r)),
  logout: () => fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'same-origin' }).then((r) => json<{ ok: true }>(r)),
  changeCredential: (current: string, newMode: AuthMode, newCredential: string) =>
    fetch(apiUrl('/api/auth/change-credential'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current, newMode, newCredential }),
    }).then((r) => json<{ ok: true }>(r)),
  enableMultiUser: (username: string, password: string) =>
    fetch(apiUrl('/api/auth/enable-multi-user'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then((r) => json<{ ok: true; user: AppUser }>(r)),
  revokeSessions: () =>
    fetch(apiUrl('/api/auth/revoke-sessions'), { method: 'POST', credentials: 'same-origin' }).then((r) => json<{ ok: true }>(r)),
};

export const usersApi = {
  list: () => fetch(apiUrl('/api/users'), { credentials: 'same-origin' }).then((r) => json<AppUser[]>(r)),
  create: (username: string, password: string, role: 'admin' | 'member') =>
    fetch(apiUrl('/api/users'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role }),
    }).then((r) => json<AppUser>(r)),
  update: (id: number, data: { username?: string; password?: string; role?: 'admin' | 'member'; accessRoleId?: number | null }) =>
    fetch(apiUrl(`/api/users/${id}`), {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => json<AppUser>(r)),
  remove: (id: number) =>
    fetch(apiUrl(`/api/users/${id}`), { method: 'DELETE', credentials: 'same-origin' }).then((r) => json<{ ok: true }>(r)),
  links: (userId: number) => fetch(apiUrl(`/api/users/${userId}/links`), { credentials: 'same-origin' }).then((r) => json<UserLink[]>(r)),
  upsertLink: (userId: number, instanceId: number, data: { externalId: string; externalName?: string; auto?: boolean }) =>
    fetch(apiUrl(`/api/users/${userId}/links/${instanceId}`), {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => json<UserLink[]>(r)),
  removeLink: (userId: number, instanceId: number) =>
    fetch(apiUrl(`/api/users/${userId}/links/${instanceId}`), { method: 'DELETE', credentials: 'same-origin' }).then((r) => json<{ ok: true }>(r)),
};

export const accessRolesApi = {
  list: () => fetch(apiUrl('/api/access-roles'), { credentials: 'same-origin' }).then((r) => json<AccessRole[]>(r)),
  create: (name: string, instanceIds: number[], widgets: AccessRoleWidget[], calendarSourceIds: number[]) =>
    fetch(apiUrl('/api/access-roles'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, instanceIds, widgets, calendarSourceIds }),
    }).then((r) => json<AccessRole>(r)),
  update: (id: number, data: { name?: string; instanceIds?: number[]; widgets?: AccessRoleWidget[]; calendarSourceIds?: number[] }) =>
    fetch(apiUrl(`/api/access-roles/${id}`), {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => json<AccessRole>(r)),
  remove: (id: number) =>
    fetch(apiUrl(`/api/access-roles/${id}`), { method: 'DELETE', credentials: 'same-origin' }).then((r) => json<{ ok: true }>(r)),
};

export type ServiceInstance = {
  id: number;
  serviceId: string;
  displayName: string;
  authType: string;
  localUrl: string | null;
  remoteUrl: string | null;
  preferredMode: 'auto' | 'local' | 'remote';
  credentials: Record<string, string>;
  /** Extra HTTP headers sent with every proxied request to this instance — e.g. a reverse-proxy
   * auth header, or anything a Tailscale Funnel/Serve setup requires beyond the URL itself. */
  customHeaders: Record<string, string>;
  favorite: boolean;
  sortOrder: number;
  enabled: boolean;
  /** How often this instance's dashboard carousels/widgets refresh, in minutes — see
   * REFRESH_INTERVAL_LIMITS in lib/dashboardWidgets.ts for the allowed range per service. */
  refreshIntervalMinutes: number;
  /** False only for a restricted member whose sole grant on this instance came from an access
   * role's widget list, not its service list — present in this array (so its widget can still
   * be built) but must not be offered as a navigable page: nav, Settings > Menu, Calendar, and
   * Command Palette all need to filter on this. Always true outside multi-user restriction. */
  navAllowed: boolean;
  /** True if this instance's episodes/releases may appear on Calendar — via full service access,
   * or via an access role's Calendar-specific grant on this instance (see
   * access_role_calendar_sources in db.js). Always true outside multi-user restriction. */
  calendarAllowed: boolean;
  /** Skip TLS certificate verification for this instance's requests — for a self-signed cert on
   * a local IP (e.g. Plex's own generated cert), which Node's fetch rejects outright by default
   * even though a browser would let you click through a warning. Opt-in per instance, never a
   * process-wide bypass. */
  ignoreCertErrors: boolean;
};

export type ServiceInstanceInput = Partial<Omit<ServiceInstance, 'id'>> & {
  serviceId: string;
  displayName: string;
  authType: string;
};

export type ServiceTestInput = Partial<ServiceInstanceInput> & {
  authType: string;
  /** The service definition's own healthCheck (serviceRegistry.ts) — omitted entirely for a
   * service with none (e.g. Bazarr), in which case the backend just checks reachability rather
   * than requiring a specific successful response. */
  testPath?: string;
  testMethod?: string;
  testQuery?: Record<string, string>;
  testBody?: unknown;
};
export type ServiceTestResult = { ok: boolean; error?: string };

export const servicesApi = {
  list: () => fetch(apiUrl('/api/services'), { credentials: 'same-origin' }).then((r) => json<ServiceInstance[]>(r)),
  test: (input: ServiceTestInput) =>
    fetch(apiUrl('/api/services/test'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).then((r) => json<ServiceTestResult>(r)),
  create: (input: ServiceInstanceInput) =>
    fetch(apiUrl('/api/services'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).then((r) => json<ServiceInstance>(r)),
  update: (id: number, input: Partial<ServiceInstanceInput>) =>
    fetch(apiUrl(`/api/services/${id}`), {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).then((r) => json<ServiceInstance>(r)),
  remove: (id: number) =>
    fetch(apiUrl(`/api/services/${id}`), { method: 'DELETE', credentials: 'same-origin' }).then((r) => json<{ ok: true }>(r)),
};

export type ProxyResponse<T = unknown> = { ok: boolean; status: number; data?: T; error?: string };

export const proxyApi = {
  // Every dashboard widget's request to a given service instance funnels through here — capped
  // per instance (see runWithInstanceLimit) so however many independently-mounted widgets happen
  // to share one backend (several Tautulli widgets, several Trakt lists resolving posters through
  // Overseerr, ...), only a few of their requests are ever actually in flight to that instance at
  // once. Unrelated services queue separately and aren't slowed down by one busy one.
  call: <T = unknown>(
    instanceId: number,
    opts: { path: string; method?: string; query?: Record<string, string>; body?: unknown; timeoutMs?: number },
  ) =>
    runWithInstanceLimit(instanceId, () =>
      fetch(apiUrl(`/api/proxy/${instanceId}`), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
      }).then((r) => json<ProxyResponse<T>>(r)),
    ),
};

export const sabnzbdApi = {
  uploadNzb: (instanceId: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(apiUrl(`/api/sabnzbd/${instanceId}/upload`), {
      method: 'POST',
      credentials: 'same-origin',
      body: form,
    }).then((r) => json<ProxyResponse>(r));
  },
};

export const torrentUploadApi = {
  uploadTorrent: (instanceId: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(apiUrl(`/api/torrent-upload/${instanceId}`), {
      method: 'POST',
      credentials: 'same-origin',
      body: form,
    }).then((r) => json<ProxyResponse>(r));
  },
};

export type DashboardWidgetConfig = { key: string; enabled: boolean };

export const dashboardApi = {
  getWidgets: () => fetch(apiUrl('/api/dashboard/widgets'), { credentials: 'same-origin' }).then((r) => json<DashboardWidgetConfig[]>(r)),
  setWidgets: (widgets: DashboardWidgetConfig[]) =>
    fetch(apiUrl('/api/dashboard/widgets'), {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(widgets),
    }).then((r) => json<DashboardWidgetConfig[]>(r)),
};

export const backupApi = {
  export: (password: string) =>
    fetch(apiUrl('/api/backup/export'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }).then(async (r) => {
      if (!r.ok) {
        const data = await r.json().catch(() => null);
        throw new Error((data && data.error) || `Backup failed (${r.status})`);
      }
      return r.blob();
    }),
  import: (file: File, password: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('password', password);
    return fetch(apiUrl('/api/backup/import'), { method: 'POST', credentials: 'same-origin', body: form }).then((r) =>
      json<{ ok: true; credentialPreserved: boolean }>(r),
    );
  },
};

export type AuditLogEntry = {
  id: number;
  createdAt: number;
  actorUserId: number | null;
  actorLabel: string;
  action: string;
  target: string | null;
  detail: string | null;
  ip: string | null;
};

export const auditLogApi = {
  list: (opts: { limit?: number; action?: string } = {}) => {
    const params = new URLSearchParams();
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.action) params.set('action', opts.action);
    const qs = params.toString();
    return fetch(apiUrl(`/api/audit-log${qs ? `?${qs}` : ''}`), { credentials: 'same-origin' }).then((r) => json<AuditLogEntry[]>(r));
  },
};

export type CloudflareTunnelStatus = { configured: boolean; connected: boolean; hostname: string | null };

export const cloudflareTunnelApi = {
  status: () => fetch(apiUrl('/api/cloudflare-tunnel/status'), { credentials: 'same-origin' }).then((r) => json<CloudflareTunnelStatus>(r)),
};
