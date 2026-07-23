export type AuthMode = 'pin' | 'password';
export type AuthStatus = { hasCredential: boolean; authMode: AuthMode | null; authenticated: boolean };

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && (data.error as string)) || `Request failed (${res.status})`);
  }
  return data as T;
}

export const authApi = {
  status: () => fetch('/api/auth/status', { credentials: 'same-origin' }).then((r) => json<AuthStatus>(r)),
  setup: (mode: AuthMode, credential: string) =>
    fetch('/api/auth/setup', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, credential }),
    }).then((r) => json<{ ok: true }>(r)),
  login: (credential: string) =>
    fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    }).then((r) => json<{ ok: true }>(r)),
  logout: () => fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).then((r) => json<{ ok: true }>(r)),
  changeCredential: (current: string, newMode: AuthMode, newCredential: string) =>
    fetch('/api/auth/change-credential', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current, newMode, newCredential }),
    }).then((r) => json<{ ok: true }>(r)),
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
  wolMac: string | null;
  wolBroadcast: string | null;
  favorite: boolean;
  sortOrder: number;
  enabled: boolean;
};

export type ServiceInstanceInput = Partial<Omit<ServiceInstance, 'id'>> & {
  serviceId: string;
  displayName: string;
  authType: string;
};

export const servicesApi = {
  list: () => fetch('/api/services', { credentials: 'same-origin' }).then((r) => json<ServiceInstance[]>(r)),
  create: (input: ServiceInstanceInput) =>
    fetch('/api/services', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).then((r) => json<ServiceInstance>(r)),
  update: (id: number, input: Partial<ServiceInstanceInput>) =>
    fetch(`/api/services/${id}`, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).then((r) => json<ServiceInstance>(r)),
  remove: (id: number) =>
    fetch(`/api/services/${id}`, { method: 'DELETE', credentials: 'same-origin' }).then((r) => json<{ ok: true }>(r)),
};

export type ProxyResponse<T = unknown> = { ok: boolean; status: number; data?: T; error?: string };

export const proxyApi = {
  call: <T = unknown>(
    instanceId: number,
    opts: { path: string; method?: string; query?: Record<string, string>; body?: unknown; timeoutMs?: number },
  ) =>
    fetch(`/api/proxy/${instanceId}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    }).then((r) => json<ProxyResponse<T>>(r)),
};

export const sabnzbdApi = {
  uploadNzb: (instanceId: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`/api/sabnzbd/${instanceId}/upload`, {
      method: 'POST',
      credentials: 'same-origin',
      body: form,
    }).then((r) => json<ProxyResponse>(r));
  },
};

export type DashboardWidgetConfig = { key: string; enabled: boolean };

export const dashboardApi = {
  getWidgets: () => fetch('/api/dashboard/widgets', { credentials: 'same-origin' }).then((r) => json<DashboardWidgetConfig[]>(r)),
  setWidgets: (widgets: DashboardWidgetConfig[]) =>
    fetch('/api/dashboard/widgets', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(widgets),
    }).then((r) => json<DashboardWidgetConfig[]>(r)),
};

export const wolApi = {
  wake: (mac: string, broadcast?: string) =>
    fetch('/api/wol', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac, broadcast }),
    }).then((r) => json<{ ok: true }>(r)),
};
