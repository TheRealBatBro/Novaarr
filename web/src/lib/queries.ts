import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, servicesApi, proxyApi, dashboardApi, type ServiceInstance, type ServiceInstanceInput, type DashboardWidgetConfig } from './api';

export function useAuthStatus() {
  return useQuery({ queryKey: ['auth', 'status'], queryFn: authApi.status, staleTime: 0, retry: 0 });
}

export function useServices() {
  return useQuery({ queryKey: ['services'], queryFn: servicesApi.list });
}

export function useServiceInstance(id: number | undefined) {
  const { data } = useServices();
  return data?.find((s) => s.id === id);
}

/** Route params for /service/$serviceId (and its /title/$itemId child) are dual-mode: a numeric
 * string resolves by instance row id — needed once more than one instance of a service can exist
 * — anything else falls back to matching serviceId (old links/bookmarks, and the common
 * still-only-one-instance case, unaffected either way). */
export function resolveServiceParam(instances: ServiceInstance[], param: string): ServiceInstance | undefined {
  const asId = Number(param);
  if (!Number.isNaN(asId)) {
    const byId = instances.find((i) => i.id === asId);
    if (byId) return byId;
  }
  return instances.find((i) => i.serviceId === param);
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ServiceInstanceInput) => servicesApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });
}

export function useUpdateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<ServiceInstanceInput> }) => servicesApi.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => servicesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });
}

export function useDashboardWidgets() {
  return useQuery({ queryKey: ['dashboard', 'widgets'], queryFn: dashboardApi.getWidgets });
}

export function useSetDashboardWidgets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (widgets: DashboardWidgetConfig[]) => dashboardApi.setWidgets(widgets),
    onSuccess: (widgets) => qc.setQueryData(['dashboard', 'widgets'], widgets),
  });
}

/** Live polling status/queue query for a single configured service instance. */
export function useServiceProxy<T = unknown>(
  instance: ServiceInstance | undefined,
  opts: {
    path: string;
    method?: string;
    query?: Record<string, string>;
    body?: unknown;
    refetchInterval?: number | false;
    /** Defaults to the global 10s if unset — dashboard widgets pass this explicitly (matching
     * their own refetchInterval) so a page remount doesn't force an immediate refetch just
     * because 10s elapsed, defeating a deliberately long configured schedule. */
    staleTime?: number;
    timeoutMs?: number;
    enabled?: boolean;
  },
) {
  return useQuery({
    queryKey: ['proxy', instance?.id, opts.path, opts.query, opts.body],
    queryFn: () => proxyApi.call<T>(instance!.id, { path: opts.path, method: opts.method, query: opts.query, body: opts.body, timeoutMs: opts.timeoutMs }),
    enabled: (opts.enabled ?? true) && !!instance,
    refetchInterval: opts.refetchInterval ?? 10_000,
    staleTime: opts.staleTime,
    retry: 1,
  });
}

/** Same query (and cache key shape, so it rides the same cache as useServiceProxy) as above, but
 * for a dynamic list of instances of one service type — e.g. searching across every configured
 * Sonarr instance once multi-instance is in play. Can't just call useServiceProxy in a loop
 * (React hook-count rules don't allow a variable number of hook calls), so this uses useQueries,
 * the react-query primitive built for exactly that. Returns one query result per instance, same
 * order as `instances`. */
export function useServiceProxyQueries<T = unknown>(
  instances: ServiceInstance[],
  opts: { path: string; method?: string; query?: Record<string, string>; body?: unknown; refetchInterval?: number | false; enabled?: boolean },
) {
  return useQueries({
    queries: instances.map((instance) => ({
      queryKey: ['proxy', instance.id, opts.path, opts.query, opts.body],
      queryFn: () => proxyApi.call<T>(instance.id, { path: opts.path, method: opts.method, query: opts.query, body: opts.body }),
      enabled: opts.enabled ?? true,
      refetchInterval: opts.refetchInterval ?? 10_000,
      retry: 1,
    })),
  });
}
