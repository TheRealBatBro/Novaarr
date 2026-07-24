import { useEffect, useRef } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { TopBar } from './TopBar';
import { CommandPalette } from './CommandPalette';
import { AppDrawer } from './AppDrawer';
import { AppSidebar } from './AppSidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const mainRef = useRef<HTMLElement>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // The router's own scrollRestoration targets window scroll — this app scrolls a custom
  // container instead (<main> below), which the router has no visibility into, so a new page
  // was silently opening wherever the previous page happened to be scrolled to.
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex h-dvh min-w-0 flex-1 flex-col">
        <TopBar />
        <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto pb-6 [scrollbar-gutter:stable]">
          {children}
        </main>
      </div>
      <AppDrawer />
      <CommandPalette />
    </div>
  );
}
