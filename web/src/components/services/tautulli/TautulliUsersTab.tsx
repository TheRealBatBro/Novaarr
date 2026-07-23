import { useState } from 'react';
import { User } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceProxy } from '@/lib/queries';
import { timeAgo } from '@/lib/utils';
import { formatLongDuration } from './TautulliShared';
import type { ServiceInstance } from '@/lib/api';

type TautulliUser = {
  user_id: number;
  friendly_name: string;
  user_thumb?: string;
  plays: number;
  duration: number;
  last_seen?: number;
  last_played?: string;
};
type TautulliUsersResponse = { response?: { result: string; data?: { data?: TautulliUser[]; recordsFiltered?: number } } };

const SORTS = ['friendly_name', 'last_seen', 'plays', 'duration'] as const;
const SORT_LABEL: Record<(typeof SORTS)[number], string> = { friendly_name: 'Name', last_seen: 'Last Seen', plays: 'Plays', duration: 'Duration' };

export function TautulliUsersTab({ instance }: { instance: ServiceInstance }) {
  const [sort, setSort] = useState<(typeof SORTS)[number]>('friendly_name');
  const { data, isLoading } = useServiceProxy<TautulliUsersResponse>(instance, {
    path: '/api/v2',
    query: { cmd: 'get_users_table', order_column: sort, order_dir: sort === 'friendly_name' ? 'asc' : 'desc', length: '100' },
    refetchInterval: false,
  });

  const users = data?.data?.response?.data?.data ?? [];
  const total = data?.data?.response?.data?.recordsFiltered ?? users.length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">{total} User{total === 1 ? '' : 's'}</h2>
          <p className="text-sm text-muted-foreground">View all users on your server.</p>
        </div>
        <Select value={sort} onChange={(e) => setSort(e.target.value as (typeof SORTS)[number])} className="w-40 shrink-0">
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {SORT_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        {!isLoading && users.length === 0 && <p className="text-sm text-muted-foreground">No users found.</p>}
        {users.map((u) => (
          <div key={u.user_id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
              {u.user_thumb ? (
                <img src={u.user_thumb} alt={u.friendly_name} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <User className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold leading-tight">{u.friendly_name}</p>
              {u.last_played && (
                <p className="truncate text-xs text-muted-foreground">
                  {u.last_seen ? `${timeAgo(new Date(u.last_seen * 1000).toISOString())} · ` : ''}
                  {u.last_played}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {u.plays} Play{u.plays === 1 ? '' : 's'} · {formatLongDuration(u.duration)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
