import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useAlertEvents, useSetDisabledAlertEvents } from '@/lib/queries';

export function AlertEventsCard() {
  const { data, isLoading } = useAlertEvents();
  const setDisabled = useSetDisabledAlertEvents();

  function toggle(key: string, enabled: boolean) {
    if (!data) return;
    const disabledKeys = data.filter((e) => (e.key === key ? !enabled : !e.enabled)).map((e) => e.key);
    setDisabled.mutate(disabledKeys);
  }

  const groups = data ? [...new Set(data.map((e) => e.group))] : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Which events alert</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          Applies to every alert channel above and to push notifications — turn off anything too noisy.
        </p>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        ) : (
          groups.map((group) => (
            <div key={group}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
              <div className="flex flex-col gap-1.5">
                {data!
                  .filter((e) => e.group === group)
                  .map((e) => (
                    <label key={e.key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                      <span className="text-sm">{e.label}</span>
                      <Switch checked={e.enabled} onCheckedChange={(checked) => toggle(e.key, checked)} />
                    </label>
                  ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
