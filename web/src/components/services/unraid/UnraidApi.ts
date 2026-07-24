import { useServiceProxy } from '@/lib/queries';
import { proxyApi, type ProxyResponse, type ServiceInstance } from '@/lib/api';

// Unraid's GraphQL API (docs.unraid.net/API) isn't published as a stable, versioned schema the
// way Prowlarr's/Sonarr's REST APIs are — these queries were built from Unraid's own public docs
// and third-party client references, not verified against a live instance. Every response is read
// defensively (optional chaining, fallbacks) so an unexpected field name degrades to an empty
// section instead of a crash.
export type GraphQLResponse<T> = { data?: T | null; errors?: { message: string }[] };

export function useUnraidQuery<T>(
  instance: ServiceInstance,
  query: string,
  opts?: { refetchInterval?: number | false; variables?: Record<string, unknown> },
) {
  return useServiceProxy<GraphQLResponse<T>>(instance, {
    path: '/graphql',
    method: 'POST',
    body: { query, variables: opts?.variables },
    refetchInterval: opts?.refetchInterval ?? 15000,
  });
}

// useServiceProxy's `data` is the outer proxy envelope ({ok, status, data: <graphql response>});
// the GraphQL response itself is another { data, errors } envelope — this unwraps both layers
// into the one thing every tab actually wants, so call sites don't repeat `data?.data?.data`.
export function gqlData<T>(resp?: ProxyResponse<GraphQLResponse<T>>): T | undefined {
  if (!resp?.ok || resp.data?.errors?.length) return undefined;
  return resp.data?.data ?? undefined;
}

export async function unraidMutate<T>(
  instance: ServiceInstance,
  query: string,
  variables?: Record<string, unknown>,
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const res = await proxyApi.call<GraphQLResponse<T>>(instance.id, { path: '/graphql', method: 'POST', body: { query, variables } });
  if (!res.ok) return { ok: false, error: res.error || `Request failed (${res.status})` };
  if (res.data?.errors?.length) return { ok: false, error: res.data.errors[0].message };
  return { ok: true, data: res.data?.data ?? undefined };
}

export const SYSTEM_QUERY = `query { info { os { hostname uptime } } array { state } }`;

export const UPS_QUERY = `query { upsDevices { id name model status battery { chargeLevel estimatedRuntime health } power { inputVoltage outputVoltage loadPercentage } } }`;

export const ARRAY_QUERY = `query {
  array {
    state
    capacity { kilobytes { free used total } }
    parities { name device size status type temp }
    disks { name device size status type temp fsSize fsFree fsUsed numErrors isSpinning }
    caches { name device size status type temp fsSize fsFree fsUsed isSpinning }
  }
  parityHistory { date duration speed status errors }
}`;

export const DOCKER_QUERY = `query {
  docker {
    containers { id names image state status autoStart isUpdateAvailable webUiUrl iconUrl }
  }
}`;
export const DOCKER_START = `mutation($id: ID!) { docker { start(id: $id) { id state } } }`;
export const DOCKER_STOP = `mutation($id: ID!) { docker { stop(id: $id) { id state } } }`;

export const VMS_QUERY = `query { vms { domains { id name state } } }`;
export const VM_START = `mutation($id: ID!) { vm { start(id: $id) } }`;
export const VM_STOP = `mutation($id: ID!) { vm { stop(id: $id) } }`;

export const NOTIFICATIONS_QUERY = `query {
  notifications {
    overview { unread { info warning alert total } }
    list(filter: { type: UNREAD, offset: 0, limit: 30 }) { id title subject description importance timestamp }
  }
}`;
export const NOTIFICATIONS_ARCHIVE = `mutation($ids: [ID!]!) { archiveNotifications(ids: $ids) { id } }`;

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

/** Unraid's `capacity.kilobytes` fields come back as strings — some totals exceed Number's safe
 * integer range at the kilobyte scale for very large arrays. */
export function kbToBytes(kb?: string | number | null): number {
  return kb ? Number(kb) * 1024 : 0;
}

export function formatUptimeSeconds(seconds?: number | null): string | undefined {
  if (!seconds || seconds <= 0) return undefined;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (days || hours) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

const DISK_STATUS_TONE: Record<string, 'success' | 'destructive' | 'muted'> = {
  DISK_OK: 'success',
  DISK_NP: 'muted',
  DISK_NP_MISSING: 'destructive',
  DISK_INVALID: 'destructive',
  DISK_WRONG: 'destructive',
  DISK_DSBL: 'destructive',
  DISK_NP_DSBL: 'destructive',
};

export function diskStatusTone(status?: string | null): 'success' | 'destructive' | 'muted' {
  if (!status) return 'muted';
  return DISK_STATUS_TONE[status] ?? 'muted';
}
