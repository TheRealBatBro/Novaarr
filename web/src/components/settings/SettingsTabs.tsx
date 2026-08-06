import { Link } from '@tanstack/react-router';
import { Plug, ListOrdered, LayoutDashboard, ShieldCheck, Database, Info, Users, ScrollText, Palette, Bell, type LucideIcon } from 'lucide-react';
import { useAuthStatus, useIsSettingsAdmin } from '@/lib/queries';
import { cn } from '@/lib/utils';

const TABS: { key: string; label: string; to: string; icon: LucideIcon; adminOnly?: boolean }[] = [
  { key: 'services', label: 'Services', to: '/settings/services', icon: Plug, adminOnly: true },
  { key: 'menu', label: 'Menu', to: '/settings/menu', icon: ListOrdered, adminOnly: true },
  { key: 'dashboard', label: 'Dashboard', to: '/settings/dashboard', icon: LayoutDashboard },
  { key: 'appearance', label: 'Appearance', to: '/settings/appearance', icon: Palette },
  { key: 'notifications', label: 'Notifications', to: '/settings/notifications', icon: Bell },
  { key: 'security', label: 'Security', to: '/settings/security', icon: ShieldCheck },
  { key: 'users', label: 'Users', to: '/settings/users', icon: Users },
  { key: 'backup', label: 'Backup', to: '/settings/backup', icon: Database, adminOnly: true },
  { key: 'audit', label: 'Audit', to: '/settings/audit', icon: ScrollText, adminOnly: true },
  { key: 'about', label: 'About', to: '/settings/about', icon: Info },
];

export function SettingsTabs({
  active,
}: {
  active: 'services' | 'menu' | 'dashboard' | 'appearance' | 'notifications' | 'security' | 'users' | 'backup' | 'audit' | 'about';
}) {
  // The Users tab only makes sense once a deployment has opted into multi-user mode — hidden
  // entirely in simple mode rather than shown-but-empty. Services/Menu/Backup change shared,
  // deployment-wide state, so a member (non-admin) in multi-user mode doesn't see them at all —
  // mirrors the backend's requireAdmin gating on those same routes.
  const { data } = useAuthStatus();
  const isAdmin = useIsSettingsAdmin();
  const tabs = TABS.filter((t) => t.key !== 'users' || data?.multiUser).filter((t) => !t.adminOnly || isAdmin);
  return (
    <div className="mb-6 flex flex-wrap gap-1 rounded-xl bg-muted/60 p-1">
      {tabs.map((t) => {
        const Icon = t.icon;
        return (
          <Link
            key={t.key}
            to={t.to}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
              active === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
