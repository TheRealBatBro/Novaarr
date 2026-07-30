import { Link } from '@tanstack/react-router';
import { Plug, ListOrdered, LayoutDashboard, ShieldCheck, Database, Info, Users, type LucideIcon } from 'lucide-react';
import { useAuthStatus } from '@/lib/queries';
import { cn } from '@/lib/utils';

const TABS: { key: string; label: string; to: string; icon: LucideIcon }[] = [
  { key: 'services', label: 'Services', to: '/settings/services', icon: Plug },
  { key: 'menu', label: 'Menu', to: '/settings/menu', icon: ListOrdered },
  { key: 'dashboard', label: 'Dashboard', to: '/settings/dashboard', icon: LayoutDashboard },
  { key: 'security', label: 'Security', to: '/settings/security', icon: ShieldCheck },
  { key: 'users', label: 'Users', to: '/settings/users', icon: Users },
  { key: 'backup', label: 'Backup', to: '/settings/backup', icon: Database },
  { key: 'about', label: 'About', to: '/settings/about', icon: Info },
];

export function SettingsTabs({ active }: { active: 'services' | 'menu' | 'dashboard' | 'security' | 'users' | 'backup' | 'about' }) {
  // The Users tab only makes sense once a deployment has opted into multi-user mode — hidden
  // entirely in simple mode rather than shown-but-empty.
  const { data } = useAuthStatus();
  const tabs = data?.multiUser ? TABS : TABS.filter((t) => t.key !== 'users');
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
