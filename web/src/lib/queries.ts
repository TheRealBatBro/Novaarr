import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
    timeoutMs?: number;
    enabled?: boolean;
  },
) {
  return useQuery({
    queryKey: ['proxy', instance?.id, opts.path, opts.query, opts.body],
    queryFn: () => proxyApi.call<T>(instance!.id, { path: opts.path, method: opts.method, query: opts.query, body: opts.body, timeoutMs: opts.timeoutMs }),
    enabled: (opts.enabled ?? true) && !!instance,
    refetchInterval: opts.refetchInterval ?? 10_000,
    retry: 1,
  });
}
