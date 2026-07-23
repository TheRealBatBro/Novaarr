import { useMemo, useState } from 'react';
import { Search, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceProxy } from '@/lib/queries';
import { cn, timeAgo } from '@/lib/utils';
import { trustTone, trustLabel, type TracearrUser } from './TracearrShared';
import type { ServiceInstance } from '@/lib/api';

type UsersResponse = { data?: TracearrUser[]; meta?: { total: number } };

const SORTS = ['name', 'trustScore', 'createdAt', 'lastActivityAt'] as const;
const SORT_LABEL: Record<(typeof SORTS)[number], string> = { name: 'Name', trustScore: 'Trust Score', createdAt: 'Join Date', lastActivityAt: 'Last Activity' };

const TONE_CLASS: Record<string, string> = {
  success: 'bg-success/15 text-success',
  amber: 'bg-amber-500/15 text-amber-500',
  destructive: 'bg-destructive/15 text-destructive',
};

export function TracearrUsersTab({ instance }: { instance: ServiceInstance }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<(typeof SORTS)[number]>('name');
  const { data, isLoading } = useServiceProxy<UsersResponse>(instance, {
    path: '/api/v1/public/users',
    query: { pageSize: '100' },
    refetchInterval: false,
  });

  const users = data?.data?.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? users.filter((u) => u.displayName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)) : users;
    return [...list].sort((a, b) => {
      if (sort === 'name') return a.displayName.localeCompare(b.displayName);
      if (sort === 'trustScore') return b.trustScore - a.trustScore;
      if (sort === 'createdAt') return b.createdAt.localeCompare(a.createdAt);
      return (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? '');
    });
  }, [users, search, sort]);

  return (
    <div>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users…" className="pl-9" />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {SORTS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSort(s)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              sort === s ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            {SORT_LABEL[s]}
          </button>
        ))}
      </div>

      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold tracking-tight">
        Users <span className="rounded-full bg-muted px-2 py-0.5 text-sm font-medium text-muted-foreground">{filtered.length}</span>
      </h2>

      <div className="flex flex-col gap-2">
        {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        {!isLoading && filtered.length === 0 && <p className="text-sm text-muted-foreground">No users found.</p>}
        {filtered.map((u) => (
          <div key={u.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
              {u.avatarUrl ? <img src={u.avatarUrl} alt={u.displayName} loading="lazy" className="h-full w-full object-cover" /> : <User className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold leading-tight">{u.displayName}</p>
              <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
              <p className="text-xs text-muted-foreground">
                Joined {new Date(u.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                {' · '}
                {u.lastActivityAt ? timeAgo(u.lastActivityAt) : 'Never'}
              </p>
            </div>
            <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', TONE_CLASS[trustTone(u.trustScore)])}>
              {u.trustScore} · {trustLabel(u.trustScore)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
