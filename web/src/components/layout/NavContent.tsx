import { useNavigate, useRouterState } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { Home, CalendarDays, Settings, type LucideIcon } from 'lucide-react';
import { useVisibleServices } from '@/lib/visibility';
import { getServiceIcon } from '@/lib/serviceIcons';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '@/lib/serviceRegistry';
import { StatusDot } from '@/components/dashboard/StatusDot';
import { cn } from '@/lib/utils';

/** Sliding pill that marks the active row — shared layoutId animates it between rows on navigation. */
function ActiveIndicator() {
  return (
    <motion.span
      layoutId="nav-active-indicator"
      className="absolute inset-y-1 left-0 w-1 rounded-full bg-primary"
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
        'relative flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-base font-semibold transition-colors hover:bg-accent',
        active ? 'bg-primary/10 text-primary' : 'text-foreground',
      )}
    >
      {active && <ActiveIndicator />}
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}

/** Shared nav content — rendered inside the mobile overlay drawer and the persistent desktop sidebar. */
export function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const visible = useVisibleServices();

  function go(to: string) {
    onNavigate?.();
    navigate({ to });
  }

  const configuredCount = visible.filter((v) => v.instance).length;

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border p-4">
        <img src="/icon.svg" alt="" className="h-10 w-10 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold leading-tight">Remotarr</p>
          <p className="truncate text-xs text-muted-foreground">
            {configuredCount} service{configuredCount === 1 ? '' : 's'} configured
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <NavRow icon={Home} label="Dashboard" active={pathname === '/'} onClick={() => go('/')} />
        <NavRow icon={CalendarDays} label="Calendar" active={pathname === '/calendar'} onClick={() => go('/calendar')} />

        {CATEGORY_ORDER.map((cat) => {
          const rows = visible.filter((v) => v.definition.category === cat);
          if (!rows.length) return null;
          return (
            <div key={cat} className="mt-5">
              <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{CATEGORY_LABELS[cat]}</p>
              {rows.map(({ definition, instance }) => {
                const Icon = getServiceIcon(definition.id);
                const active = pathname === `/service/${definition.id}`;
                return (
                  <button
                    key={definition.id}
                    type="button"
                    onClick={() => go(`/service/${definition.id}`)}
                    className={cn(
                      'relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] font-medium transition-colors hover:bg-accent',
                      active && 'bg-accent',
                    )}
                  >
                    {active && <ActiveIndicator />}
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${definition.brandColor}22`, color: definition.brandColor }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{definition.displayName}</span>
                    <StatusDot status={instance ? 'unknown' : 'off'} />
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="border-t border-border p-2">
        <NavRow icon={Settings} label="Settings" active={pathname.startsWith('/settings')} onClick={() => go('/settings/services')} />
      </div>
    </>
  );
}
