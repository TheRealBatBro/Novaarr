import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Home, CalendarDays, Sparkles, Search, Menu, type LucideIcon } from 'lucide-react';
import { useAuthStatus, useServices } from '@/lib/queries';
import { useUiStore } from '@/stores/useUiStore';
import { cn } from '@/lib/utils';

function TabButton({ icon: Icon, label, active, onClick }: { icon: LucideIcon; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors',
        active ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      <Icon className={cn('h-5 w-5', active && 'fill-primary/15')} />
      {label}
    </button>
  );
}

// A native-app-style bottom tab bar for the handful of destinations worth one-tap access on
// mobile — everything else (every configured service, Settings) still lives behind the
// hamburger drawer's full nav list, which this doesn't replace. Hidden at the same `lg` breakpoint
// the persistent desktop sidebar appears at (see AppSidebar), so exactly one of the two nav
// surfaces is ever visible.
export function MobileTabBar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: authStatus } = useAuthStatus();
  const showCalendar = authStatus?.user?.calendarAccessible ?? true;
  const { data: instances = [] } = useServices();
  const showDiscover = instances.some((i) => i.serviceId === 'overseerr' && i.enabled);
  const { setPaletteOpen, setDrawerOpen } = useUiStore();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] lg:hidden">
      <TabButton icon={Home} label="Home" active={pathname === '/'} onClick={() => navigate({ to: '/' })} />
      {showCalendar && (
        <TabButton icon={CalendarDays} label="Calendar" active={pathname === '/calendar'} onClick={() => navigate({ to: '/calendar' })} />
      )}
      {showDiscover && (
        <TabButton icon={Sparkles} label="Discover" active={pathname === '/discover'} onClick={() => navigate({ to: '/discover' })} />
      )}
      <TabButton icon={Search} label="Search" active={false} onClick={() => setPaletteOpen(true)} />
      <TabButton icon={Menu} label="Menu" active={pathname.startsWith('/settings') || pathname.startsWith('/service/')} onClick={() => setDrawerOpen(true)} />
    </nav>
  );
}
