import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Reorder } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { SettingsTabs } from '@/components/settings/SettingsTabs';
import { Card, CardContent } from '@/components/ui/card';
import { useVisibleServices, type VisibleService } from '@/lib/visibility';
import { useServices, useUpdateService } from '@/lib/queries';
import { getServiceIcon } from '@/lib/serviceIcons';

export const Route = createFileRoute('/settings/menu')({ component: SettingsMenu });

function SettingsMenu() {
  const { isLoading } = useServices();
  const visible = useVisibleServices();
  const configured = visible.filter((v) => v.instance);
  const updateService = useUpdateService();
  const [rows, setRows] = useState<VisibleService[] | null>(null);

  useEffect(() => {
    // Only seed from the server-derived order once the services query has actually loaded —
    // and only once overall, since re-deriving on every refetch would blow away whatever
    // position a drag just landed on.
    if (!rows && !isLoading) setRows(configured);
  }, [configured, isLoading, rows]);

  async function save(next: VisibleService[]) {
    setRows(next);
    try {
      await Promise.all(
        next.map((row, index) =>
          row.instance && row.instance.sortOrder !== index
            ? updateService.mutateAsync({ id: row.instance.id, input: { sortOrder: index } })
            : Promise.resolve(),
        ),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save order');
    }
  }

  return (
    <div>
      <SettingsTabs active="menu" />
      <h1 className="text-2xl font-bold tracking-tight">Customize menu</h1>
      <p className="mb-6 text-sm text-muted-foreground">Drag to reorder the services in your menu.</p>

      {rows && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Add a service in Settings → Services to see it here.</p>
      )}

      {rows && rows.length > 0 && (
        <Reorder.Group axis="y" values={rows} onReorder={save} className="flex flex-col gap-2">
          {rows.map((row) => {
            const Icon = getServiceIcon(row.definition.id);
            return (
              <Reorder.Item key={row.definition.id} value={row} as="div">
                <Card>
                  <CardContent className="flex items-center gap-3 p-3">
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${row.definition.brandColor}22`, color: row.definition.brandColor }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">{row.instance?.displayName ?? row.definition.displayName}</p>
                  </CardContent>
                </Card>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      )}
    </div>
  );
}
