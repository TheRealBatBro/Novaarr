import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Plus, Trash2, CirclePlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { SERVICE_REGISTRY, CATEGORY_LABELS, CATEGORY_ORDER, type ServiceDefinition } from '@/lib/serviceRegistry';
import { getServiceIcon } from '@/lib/serviceIcons';
import { useDeleteService, useServices, useUpdateService } from '@/lib/queries';
import { useIsDevEnvironment } from '@/lib/visibility';
import { useUiStore } from '@/stores/useUiStore';
import type { ServiceInstance } from '@/lib/api';
import { ServiceInstanceForm } from '@/components/services/ServiceInstanceForm';
import { SettingsTabs } from '@/components/settings/SettingsTabs';
import { AdminOnlyNotice } from '@/components/settings/AdminOnlyNotice';
import { useIsSettingsAdmin } from '@/lib/queries';

export const Route = createFileRoute('/settings/services')({ component: SettingsServices });

function SettingsServices() {
  const isAdmin = useIsSettingsAdmin();
  const { data: instances = [] } = useServices();
  const deleteService = useDeleteService();
  const updateService = useUpdateService();
  const [editing, setEditing] = useState<{ definition: ServiceDefinition; existing?: ServiceInstance } | null>(null);
  const isDevEnvironment = useIsDevEnvironment();
  const devShowAllServices = useUiStore((s) => s.devShowAllServices);
  const setDevShowAllServices = useUiStore((s) => s.setDevShowAllServices);

  function toggleEnabled(instance: ServiceInstance) {
    updateService.mutate(
      { id: instance.id, input: { enabled: !instance.enabled } },
      { onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update') },
    );
  }

  async function remove(instance: ServiceInstance) {
    try {
      await deleteService.mutateAsync(instance.id);
      toast.success(`${instance.displayName} removed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove');
    }
  }

  const byServiceId = new Map<string, ServiceInstance[]>();
  for (const i of instances) {
    const list = byServiceId.get(i.serviceId);
    if (list) list.push(i);
    else byServiceId.set(i.serviceId, [i]);
  }

  if (!isAdmin) {
    return (
      <div>
        <SettingsTabs active="services" />
        <AdminOnlyNotice />
      </div>
    );
  }

  return (
    <div>
      <SettingsTabs active="services" />
      <h1 className="text-2xl font-bold tracking-tight">Services</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Every service lives here, configured or not — enabled ones show up in the menu.
      </p>

      {isDevEnvironment && (
        <Card className="mb-6 border-dashed">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">Show unconfigured services in menu</p>
              <p className="text-xs text-muted-foreground">
                Dev environment only — off previews the menu exactly as a real deployment (only configured + enabled services) would see it.
              </p>
            </div>
            <Switch
              checked={devShowAllServices ?? true}
              onCheckedChange={(checked) => setDevShowAllServices(checked)}
              aria-label="Toggle showing unconfigured services"
            />
          </CardContent>
        </Card>
      )}

      {CATEGORY_ORDER.map((cat) => {
        const rows = SERVICE_REGISTRY.filter((def) => def.category === cat);
        if (!rows.length) return null;
        return (
          <div key={cat} className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{CATEGORY_LABELS[cat]}</h2>
            <div className="flex flex-col gap-2">
              {rows.map((def) => {
                const defInstances = byServiceId.get(def.id) ?? [];
                const Icon = getServiceIcon(def.id);
                const hasInstances = defInstances.length > 0;
                return (
                  <Card key={def.id} className="overflow-hidden p-0">
                    {hasInstances ? (
                      defInstances.map((instance, i) => (
                        <div
                          key={instance.id}
                          className={cn(
                            'flex items-center justify-between gap-4 p-4',
                            i > 0 && 'border-t border-border',
                            !instance.enabled && 'opacity-60',
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                              style={{ backgroundColor: `${def.brandColor}22`, color: def.brandColor }}
                            >
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium leading-tight">{instance.displayName}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {defInstances.length > 1 ? `Configured · ${i + 1} of ${defInstances.length}` : 'Configured'}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <Switch
                              checked={instance.enabled}
                              onCheckedChange={() => toggleEnabled(instance)}
                              aria-label={instance.enabled ? `Disable ${instance.displayName}` : `Enable ${instance.displayName}`}
                            />
                            <Button variant="outline" size="sm" onClick={() => setEditing({ definition: def, existing: instance })}>
                              Edit
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => remove(instance)} aria-label="Remove">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center justify-between gap-4 p-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: `${def.brandColor}22`, color: def.brandColor }}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate font-medium leading-tight">{def.displayName}</p>
                              {def.comingSoon && (
                                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  Coming soon
                                </span>
                              )}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">Not configured</p>
                          </div>
                        </div>
                        {def.comingSoon ? (
                          <span className="shrink-0 text-xs text-muted-foreground">Not available yet</span>
                        ) : (
                          <Button variant="outline" size="sm" className="shrink-0" onClick={() => setEditing({ definition: def })}>
                            <Plus className="h-3.5 w-3.5" /> Add
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Lives inside the same card as its instances, right below the last one, so
                        adding a second/third instance reads as "more of this same group" rather
                        than a separate, disconnected action floating below the list. */}
                    {hasInstances && !def.comingSoon && (
                      <button
                        type="button"
                        onClick={() => setEditing({ definition: def })}
                        className="flex w-full items-center gap-2 border-t border-dashed border-border p-3 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
                      >
                        <CirclePlus className="h-3.5 w-3.5 shrink-0" />
                        Add another {def.displayName} instance
                      </button>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2.5">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${editing.definition.brandColor}22`, color: editing.definition.brandColor }}
                  >
                    {(() => {
                      const Icon = getServiceIcon(editing.definition.id);
                      return <Icon className="h-4 w-4" />;
                    })()}
                  </span>
                  {editing.existing ? `Edit ${editing.existing.displayName}` : `Add ${editing.definition.displayName}`}
                </DialogTitle>
                <DialogDescription>
                  {editing.definition.helpText ?? 'Local URL is required; remote URL is optional.'}
                </DialogDescription>
              </DialogHeader>
              <ServiceInstanceForm definition={editing.definition} existing={editing.existing} onDone={() => setEditing(null)} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
