import { useServiceProxy } from './queries';
import type { ServiceInstance } from './api';
import type { ServiceDefinition } from './serviceRegistry';
import type { ServiceStatus } from '@/components/dashboard/StatusDot';

/**
 * Pings a service instance's own healthCheck (see serviceRegistry.ts) to drive the nav's
 * online/offline dot. Reuses useServiceProxy/proxyApi.call, so it inherits the same
 * always-resolves-200 contract and server-side timeout — a down or hanging upstream can never
 * throw here, it just resolves { ok: false } and the dot goes red instead of crashing anything.
 */
export function useServiceHealth(instance: ServiceInstance | undefined, definition: ServiceDefinition): ServiceStatus {
  const check = definition.healthCheck;
  const { data, isLoading } = useServiceProxy(instance, {
    path: check?.path ?? '',
    method: check?.method,
    query: check?.query,
    body: check?.body,
    refetchInterval: 30_000,
    enabled: !!check && !!instance,
  });

  if (!check || !instance) return 'unknown';
  if (isLoading) return 'unknown';
  return data?.ok ? 'online' : 'offline';
}
