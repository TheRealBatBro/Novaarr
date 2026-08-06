import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Toaster } from 'sonner';
import { getRouter } from './router';
import { queryClient } from './lib/queryClient';
import { queryPersister, PERSIST_MAX_AGE, shouldDehydrateQuery } from './lib/persist';
import { BASE_PATH } from './lib/api';
import { applyAccent, applyAmoled } from './lib/theme';
import './styles.css';

// Dark-first by default; only an explicit "light" preference opts out. Falls back to the
// pre-rename key so an upgrading user's saved preference doesn't silently reset.
const savedTheme = localStorage.getItem('novaarr:theme') ?? localStorage.getItem('remotarr:theme');
const isDark = savedTheme !== 'light';
document.documentElement.classList.toggle('dark', isDark);

// Same flash-prevention idea as the dark-class toggle above, for accent/AMOLED — useUiStore's
// own onRehydrateStorage re-applies these too, but that runs after this module (and zustand's
// own async rehydrate) finishes, which is late enough to show a flash of the default look first.
// Reading the persisted blob directly here keeps first paint already correct.
try {
  const persisted = localStorage.getItem('novaarr:ui');
  const state = persisted ? JSON.parse(persisted)?.state : null;
  if (state?.accent) applyAccent(state.accent, isDark ? 'dark' : 'light');
  if (state?.amoled) applyAmoled(true);
} catch {
  // Malformed persisted state — the store's own rehydrate will still set correct defaults.
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${BASE_PATH}/sw.js`).catch(() => {});
  });
}

const router = getRouter();

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <StrictMode>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: queryPersister, maxAge: PERSIST_MAX_AGE, dehydrateOptions: { shouldDehydrateQuery } }}
      >
        <RouterProvider router={router} />
        <Toaster theme="dark" position="top-center" richColors />
      </PersistQueryClientProvider>
    </StrictMode>,
  );
}
