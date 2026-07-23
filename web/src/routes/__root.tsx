import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { AppLockGate } from '@/components/layout/AppLockGate';
import { AppShell } from '@/components/layout/AppShell';

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <AppLockGate>
      <AppShell>
        {/* Enter-only: AnimatePresence's exit phase could get stuck (stale exit opacity/transform
            applied to the newly-mounted page) when paired with the router's synchronous Outlet swap. */}
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 10, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-6xl px-4 py-6 sm:px-6"
        >
          <Outlet />
        </motion.div>
      </AppShell>
    </AppLockGate>
  );
}

export const Route = createRootRoute({ component: RootLayout });
