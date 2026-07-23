import { TopBar } from './TopBar';
import { CommandPalette } from './CommandPalette';
import { AppDrawer } from './AppDrawer';
import { AppSidebar } from './AppSidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex h-dvh min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-w-0 flex-1 overflow-y-auto pb-6 [scrollbar-gutter:stable]">{children}</main>
      </div>
      <AppDrawer />
      <CommandPalette />
    </div>
  );
}
