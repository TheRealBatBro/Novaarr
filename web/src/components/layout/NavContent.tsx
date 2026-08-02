import { useNavigate, useRouterState } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { Home, CalendarDays, Settings, Sparkles, type LucideIcon } from 'lucide-react';
import { useVisibleServices, type VisibleService } from '@/lib/visibility';
import { getServiceIcon } from '@/lib/serviceIcons';
import { StatusDot } from '@/components/dashboard/StatusDot';
import { useServiceHealth } from '@/lib/serviceHealth';
import { useAuthStatus, useServices } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { BASE_PATH } from '@/lib/api';

/** Sliding pill that marks the active row — shared layoutId animates it between rows on navigation. */
function ActiveIndicator() {
  return (
    <motion.span
      layoutId="nav-active-indicator"
      className="absolute inset-y-2.5 left-1 w-[3px] rounded-full bg-primary"
      transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
    />
  );
}

function NavRow({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-base font-semibold transition-colors hover:bg-accent/60',
        active ? 'bg-primary/10 text-primary' : 'text-foreground',
      )}
    >
      {active && <ActiveIndicator />}
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}

function ServiceRow({ definition, instance, active, onClick }: VisibleService & { active: boolean; onClick: () => void }) {
  const Icon = getServiceIcon(definition.id);
  const health = useServiceHealth(instance, definition);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[15px] font-medium transition-colors hover:bg-accent/60',
        active && 'bg-accent/80',
      )}
    >
      {active && <ActiveIndicator />}
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${definition.brandColor}22`, color: definition.brandColor }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 truncate">{instance?.displayName ?? definition.displayName}</span>
      <StatusDot status={instance ? health : 'off'} />
    </button>
  );
}

/** Shared nav content — rendered inside the mobile overlay drawer and the persistent desktop sidebar. */
export function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const visible = useVisibleServices();
  const { data: authStatus } = useAuthStatus();
  const showCalendar = authStatus?.user?.calendarAccessible ?? true;
  const { data: instances = [] } = useServices();
  const showDiscover = instances.some((i) => i.serviceId === 'overseerr' && i.enabled);

  function go(to: string) {
    onNavigate?.();
    navigate({ to });
  }

  return (
    <>
      <button type="button" onClick={() => go('/')} className="flex items-center gap-3 border-b border-border p-4 text-left hover:bg-accent">
        <img src={`${BASE_PATH}/icon.png`} alt="" className="h-10 w-10 rounded-xl" />
        <p className="min-w-0 flex-1 truncate font-bold leading-tight">Novaarr</p>
      </button>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="flex flex-col gap-0.5">
          <NavRow icon={Home} label="Dashboard" active={pathname === '/'} onClick={() => go('/')} />
          {showCalendar && (
            <NavRow icon={CalendarDays} label="Calendar" active={pathname === '/calendar'} onClick={() => go('/calendar')} />
          )}
          {showDiscover && (
            <NavRow icon={Sparkles} label="Discover" active={pathname === '/discover'} onClick={() => go('/discover')} />
          )}
        </div>

        <div className="mt-5 flex flex-col gap-0.5">
          {visible.map(({ definition, instance }) => {
            // Multiple instances of one service share a definition.id, so the route/key has to
            // key off the specific instance's row id once one exists — definition.id only for
            // the "not configured yet" placeholder row (dev-preview mode).
            const routeId = instance ? String(instance.id) : definition.id;
            return (
              <ServiceRow
                key={routeId}
                definition={definition}
                instance={instance}
                active={pathname === `/service/${routeId}`}
                onClick={() => go(`/service/${routeId}`)}
              />
            );
          })}
        </div>
      </div>

      <div className="border-t border-border p-2">
        <NavRow icon={Settings} label="Settings" active={pathname.startsWith('/settings')} onClick={() => go('/settings/services')} />
      </div>
    </>
  );
}
