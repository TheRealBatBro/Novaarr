import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { getRouter } from './router';
import { queryClient } from './lib/queryClient';
import './styles.css';

// Dark-first by default; only an explicit "light" preference opts out.
const savedTheme = localStorage.getItem('mediaremote:theme');
document.documentElement.classList.toggle('dark', savedTheme !== 'light');

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

const router = getRouter();

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster theme="dark" position="top-center" richColors />
      </QueryClientProvider>
    </StrictMode>,
  );
}
