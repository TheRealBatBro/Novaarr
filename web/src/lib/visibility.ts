import { useServices } from './queries';
import { SERVICE_REGISTRY, type ServiceDefinition } from './serviceRegistry';
import type { ServiceInstance } from './api';
import { useUiStore } from '@/stores/useUiStore';

export type VisibleService = { definition: ServiceDefinition; instance?: ServiceInstance };

declare global {
  interface Window {
    __SHOW_ALL_SERVICES__?: boolean;
    /** Sub-path this app is mounted at behind a reverse proxy (e.g. "/remotarr"), or "" at
     * root — injected server-side from BASE_PATH, see server.js and web/src/lib/api.ts. */
    __BASE_PATH__?: string;
  }
}

/**
 * True when this deployment is a dev/testing environment — either `vite dev` itself, or a
 * Docker deployment started with SHOW_ALL_SERVICES=true (how this project's own dev instance
 * runs, since it's normally accessed via Docker rather than `vite dev`). Gates the Settings
 * toggle below: end users running a "real" deployment (SHOW_ALL_SERVICES unset) never see it.
 */
export function useIsDevEnvironment(): boolean {
  return import.meta.env.DEV || window.__SHOW_ALL_SERVICES__ === true;
}

/**
 * By default, only configured+enabled services show up in nav/search — toggling a service
 * off in Settings hides it without losing its saved config. In a dev environment (see
 * useIsDevEnvironment) every registry entry shows regardless of enabled state, unless the
 * user has flipped the Settings > Services "show unconfigured services" toggle off to
 * preview what a real deployment would look like.
 */
export function useVisibleServices(): VisibleService[] {
  const { data: instances = [] } = useServices();
  const byServiceId = new Map(instances.map((i) => [i.serviceId, i]));
  const isDevEnvironment = useIsDevEnvironment();
  const override = useUiStore((s) => s.devShowAllServices);
  const showAll = override ?? isDevEnvironment;

  const navigable = SERVICE_REGISTRY.filter((definition) => !definition.hideFromNav);

  if (showAll) {
    return navigable.map((definition) => ({ definition, instance: byServiceId.get(definition.id) }));
  }

  return navigable.filter((definition) => byServiceId.get(definition.id)?.enabled).map((definition) => ({
    definition,
    instance: byServiceId.get(definition.id),
  }));
}
