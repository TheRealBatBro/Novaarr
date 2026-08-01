import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { SettingsTabs } from '@/components/settings/SettingsTabs';
import { AdminOnlyNotice } from '@/components/settings/AdminOnlyNotice';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { auditLogApi } from '@/lib/api';
import { useIsSettingsAdmin } from '@/lib/queries';

export const Route = createFileRoute('/settings/audit')({ component: SettingsAudit });

// Mirrors the action strings logged server-side (lib/audit.js call sites) — kept as a plain
// label map here rather than round-tripped from the backend, since these never change without
// a code change on both sides anyway.
const ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Signed in',
  'auth.login_failed': 'Failed sign-in attempt',
  'auth.credential_changed': 'PIN/password changed',
  'auth.sessions_revoked': 'Sessions revoked',
  'auth.multi_user_enabled': 'Multi-user mode enabled',
  'user.created': 'User created',
  'user.updated': 'User updated',
  'user.deleted': 'User deleted',
  'service.created': 'Service added',
  'service.updated': 'Service updated',
  'service.deleted': 'Service removed',
  'access_role.created': 'Access role created',
  'access_role.updated': 'Access role updated',
  'access_role.deleted': 'Access role deleted',
};

function formatTimestamp(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleString();
}

function SettingsAudit() {
  const isAdmin = useIsSettingsAdmin();
  const [actionFilter, setActionFilter] = useState<string>('');
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['audit-log', actionFilter],
    queryFn: () => auditLogApi.list({ limit: 500, action: actionFilter || undefined }),
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <div>
        <SettingsTabs active="audit" />
        <AdminOnlyNotice />
      </div>
    );
  }

  return (
    <div>
      <SettingsTabs active="audit" />
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
          <p className="text-sm text-muted-foreground">
            Sign-ins, user management, and service/access-role changes. Kept for 90 days or the most recent 5,000 entries,
            whichever comes first.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="shrink-0">
          <RefreshCw className={isFetching ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
          Refresh
        </Button>
      </div>

      <div className="mb-4 max-w-xs">
        <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
          <option value="">All actions</option>
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Who</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Detail</th>
                <th className="px-3 py-2 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry) => (
                <tr key={entry.id} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatTimestamp(entry.createdAt)}</td>
                  <td className="px-3 py-2">{entry.actorLabel}</td>
                  <td className="px-3 py-2">{ACTION_LABELS[entry.action] ?? entry.action}</td>
                  <td className="px-3 py-2 text-muted-foreground">{entry.detail ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{entry.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
