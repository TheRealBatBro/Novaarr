import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ShieldCheck, User as UserIcon, KeySquare } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { SettingsTabs } from '@/components/settings/SettingsTabs';
import { usersApi, accessRolesApi, type AppUser, type AccessRole, type AccessRoleWidget } from '@/lib/api';
import { useAuthStatus, useServices } from '@/lib/queries';
import { UserLinksEditor } from '@/components/settings/UserLinksEditor';
import { WIDGET_CATALOG, instanceWidgetCatalog, resolveWidgetInstanceId } from '@/lib/dashboardWidgets';
import { getServiceDefinition } from '@/lib/serviceRegistry';
import { getServiceIcon } from '@/lib/serviceIcons';

export const Route = createFileRoute('/settings/users')({ component: SettingsUsers });

function useUsers() {
  return useQuery({ queryKey: ['users'], queryFn: usersApi.list });
}

function useAccessRoles() {
  return useQuery({ queryKey: ['access-roles'], queryFn: accessRolesApi.list });
}

function UserForm({ existing, onClose }: { existing?: AppUser; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: roles = [] } = useAccessRoles();
  const [username, setUsername] = useState(existing?.username ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>(existing?.role ?? 'member');
  const [accessRoleId, setAccessRoleId] = useState<number | null>(existing?.accessRoleId ?? null);

  const save = useMutation({
    mutationFn: () =>
      existing
        ? usersApi.update(existing.id, { username, role, accessRoleId, ...(password ? { password } : {}) })
        : usersApi.create(username, password, role).then((u) => (accessRoleId ? usersApi.update(u.id, { accessRoleId }) : u)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(existing ? 'User updated' : 'User created');
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save'),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="username">Username</Label>
        <Input id="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">{existing ? 'New password (leave blank to keep current)' : 'Password'}</Label>
        <Input
          id="password"
          type="password"
          required={!existing}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="role">Role</Label>
        <Select id="role" value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'member')}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </Select>
      </div>
      {role === 'member' && (
        <div className="grid gap-1.5">
          <Label htmlFor="accessRole">Access role</Label>
          <Select
            id="accessRole"
            value={accessRoleId ?? ''}
            onChange={(e) => setAccessRoleId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Full access (default)</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">Restricts which service pages and dashboard widgets this person can see and use.</p>
        </div>
      )}
      <Button type="submit" disabled={save.isPending} className="mt-1">
        {existing ? 'Save changes' : 'Create user'}
      </Button>
    </form>
  );
}

function AccessRoleForm({ existing, onClose }: { existing?: AccessRole; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: instances = [] } = useServices();
  const [name, setName] = useState(existing?.name ?? '');
  const [instanceIds, setInstanceIds] = useState<Set<number>>(new Set(existing?.serviceInstanceIds ?? []));
  const [widgetKeys, setWidgetKeys] = useState<Set<string>>(new Set(existing?.widgets.map((w) => w.widgetKey) ?? []));
  const [calendarSourceIds, setCalendarSourceIds] = useState<Set<number>>(new Set(existing?.calendarSourceIds ?? []));
  const widgetCatalog = [...WIDGET_CATALOG, ...instanceWidgetCatalog(instances)];
  const calendarSources = instances.filter((i) => i.serviceId === 'sonarr' || i.serviceId === 'radarr');

  const save = useMutation({
    mutationFn: () => {
      // Each selected widget's backing instance is resolved here (not on the backend, which has
      // no notion of the widget catalog) and sent alongside its key — see
      // lib/dashboardWidgets.ts's resolveWidgetInstanceId.
      const widgets: AccessRoleWidget[] = [...widgetKeys]
        .map((widgetKey) => {
          const def = widgetCatalog.find((w) => w.key === widgetKey);
          const instanceId = def ? resolveWidgetInstanceId(widgetKey, def.source, instances) : undefined;
          return instanceId !== undefined ? { widgetKey, instanceId } : null;
        })
        .filter((w): w is AccessRoleWidget => w !== null);
      return existing
        ? accessRolesApi.update(existing.id, { name, instanceIds: [...instanceIds], widgets, calendarSourceIds: [...calendarSourceIds] })
        : accessRolesApi.create(name, [...instanceIds], widgets, [...calendarSourceIds]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['access-roles'] });
      toast.success(existing ? 'Role updated' : 'Role created');
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save'),
  });

  function toggleInstance(id: number) {
    setInstanceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleWidget(key: string) {
    setWidgetKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleCalendarSource(id: number) {
    setCalendarSourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="roleName">Role name</Label>
        <Input id="roleName" required placeholder="e.g. Kids" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label>Allowed services</Label>
        <p className="text-xs text-muted-foreground">Full page + nav access. Some sources (Plex, Trakt, …) have no page at all — grant those below instead.</p>
        <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
          {instances.length === 0 && <p className="p-2 text-sm text-muted-foreground">Configure a service first.</p>}
          {instances.map((i) => (
            <label key={i.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
              <input type="checkbox" checked={instanceIds.has(i.id)} onChange={() => toggleInstance(i.id)} />
              {i.displayName}
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>Allowed dashboard widgets</Label>
        <p className="text-xs text-muted-foreground">
          Leave none checked to allow every widget from the services above. Checking any widget here also grants access to its
          underlying service's data — this narrows the dashboard, it can't hide data behind an otherwise-open service.
        </p>
        <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
          {widgetCatalog.length === 0 && <p className="p-2 text-sm text-muted-foreground">Configure a service first.</p>}
          {widgetCatalog.map((w) => {
            const Icon = getServiceIcon(w.source);
            const serviceName = getServiceDefinition(w.source)?.displayName ?? w.source;
            return (
              <label key={w.key} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                <input type="checkbox" checked={widgetKeys.has(w.key)} onChange={() => toggleWidget(w.key)} />
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 truncate">
                  {w.title} <span className="text-muted-foreground">— {serviceName}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>Calendar sources</Label>
        <p className="text-xs text-muted-foreground">
          Which Sonarr/Radarr instances' episodes and releases show on Calendar — independent of the page access above, so
          Calendar can pull from an instance without exposing its own page.
        </p>
        <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
          {calendarSources.length === 0 && <p className="p-2 text-sm text-muted-foreground">Configure Sonarr or Radarr first.</p>}
          {calendarSources.map((i) => (
            <label key={i.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
              <input type="checkbox" checked={calendarSourceIds.has(i.id)} onChange={() => toggleCalendarSource(i.id)} />
              {i.displayName}
            </label>
          ))}
        </div>
      </div>
      <Button type="submit" disabled={save.isPending} className="mt-1">
        {existing ? 'Save changes' : 'Create role'}
      </Button>
    </form>
  );
}

function SettingsUsers() {
  const { data: authStatus } = useAuthStatus();
  const { data: users = [], isLoading } = useUsers();
  const { data: roles = [] } = useAccessRoles();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AppUser | 'new' | null>(null);
  const [editingRole, setEditingRole] = useState<AccessRole | 'new' | null>(null);
  const isAdmin = authStatus?.user?.role === 'admin';
  const roleName = (id?: number | null) => roles.find((r) => r.id === id)?.name;

  const remove = useMutation({
    mutationFn: (id: number) => usersApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('User removed');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to remove user'),
  });

  const removeRole = useMutation({
    mutationFn: (id: number) => accessRolesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['access-roles'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Role removed');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to remove role'),
  });

  return (
    <div>
      <SettingsTabs active="users" />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">Manage who can sign in and what they can do.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setEditing('new')} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add user
          </Button>
        )}
      </div>

      {!isAdmin && (
        <p className="mb-4 text-sm text-muted-foreground">Only admins can manage users — you can view your own account here.</p>
      )}

      <div className="flex flex-col gap-2">
        {!isLoading &&
          users.map((u) => (
            <Card key={u.id}>
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  {u.role === 'admin' ? <ShieldCheck className="h-4 w-4 text-primary" /> : <UserIcon className="h-4 w-4 text-muted-foreground" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.username}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {u.role}
                    {u.role === 'member' && roleName(u.accessRoleId) && ` · ${roleName(u.accessRoleId)}`}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(u)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove.mutate(u.id)}
                      disabled={remove.isPending}
                      aria-label={`Remove ${u.username}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
      </div>

      {isAdmin && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <KeySquare className="h-4 w-4 text-muted-foreground" /> Access roles
              </h2>
              <p className="text-xs text-muted-foreground">Named sets of services a member can be restricted to.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditingRole('new')} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add role
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {roles.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.serviceInstanceIds.length} service{r.serviceInstanceIds.length === 1 ? '' : 's'}
                      {r.widgets.length > 0 && ` · ${r.widgets.length} widget${r.widgets.length === 1 ? '' : 's'}`}
                      {r.calendarSourceIds.length > 0 && ` · ${r.calendarSourceIds.length} calendar source${r.calendarSourceIds.length === 1 ? '' : 's'}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setEditingRole(r)}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => removeRole.mutate(r.id)} disabled={removeRole.isPending} aria-label={`Remove ${r.name}`}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            ))}
            {roles.length === 0 && <p className="text-sm text-muted-foreground">No access roles yet — members default to full access.</p>}
          </div>
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'Add user' : 'Edit user'}</DialogTitle>
            <DialogDescription>{editing === 'new' ? 'Create a new account for a household member.' : 'Update this account.'}</DialogDescription>
          </DialogHeader>
          {editing !== null && (
            <UserForm existing={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />
          )}
          {editing !== null && editing !== 'new' && (
            <div className="border-t border-border pt-4">
              <UserLinksEditor user={editing} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editingRole !== null} onOpenChange={(open) => !open && setEditingRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole === 'new' ? 'Add access role' : 'Edit access role'}</DialogTitle>
            <DialogDescription>Choose which services a member with this role can see and use.</DialogDescription>
          </DialogHeader>
          {editingRole !== null && (
            <AccessRoleForm existing={editingRole === 'new' ? undefined : editingRole} onClose={() => setEditingRole(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
