import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'services', label: 'Services', to: '/settings/services' },
  { key: 'menu', label: 'Menu', to: '/settings/menu' },
  { key: 'dashboard', label: 'Dashboard', to: '/settings/dashboard' },
  { key: 'security', label: 'Security', to: '/settings/security' },
  { key: 'backup', label: 'Backup', to: '/settings/backup' },
] as const;

export function SettingsTabs({ active }: { active: 'services' | 'menu' | 'dashboard' | 'security' | 'backup' }) {
  return (
    <div className="mb-4 flex gap-1.5">
      {TABS.map((t) => (
        <Link
          key={t.key}
          to={t.to}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            active === t.key ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
