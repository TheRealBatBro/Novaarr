import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Toaster } from 'sonner';
import { getRouter } from './router';
import { queryClient } from './lib/queryClient';
import { queryPersister, PERSIST_MAX_AGE, shouldDehydrateQuery } from './lib/persist';
import { BASE_PATH } from './lib/api';
import './styles.css';

// Dark-first by default; only an explicit "light" preference opts out.
const savedTheme = localStorage.getItem('remotarr:theme');
document.documentElement.classList.toggle('dark', savedTheme !== 'light');

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
