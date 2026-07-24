import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

export const getRouter = () => {
  return createRouter({
    routeTree,
    context: {},
    // AppShell resets the shared <main> scroll container to the top on every route change (and
    // useResetScrollOnChange does the same for in-page tabs) — the app always wants a fresh page
    // to open at the top, never a restored position. With this left on, the router's own scroll
    // restoration raced that reset on browser back/forward specifically (it isn't just a window
    // thing — it tracks arbitrary scrollable elements) and won on the deploy the scroll bug was
    // reported against: it re-applied the *previous* page's scroll offset to <main> right after
    // our reset ran.
    scrollRestoration: false,
    defaultPreloadStaleTime: 0,
    basepath: window.__BASE_PATH__ || '/',
  });
};

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
