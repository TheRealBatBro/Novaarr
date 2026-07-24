import { createFileRoute, Link } from '@tanstack/react-router';
import { Settings2 } from 'lucide-react';
import { useDashboardWidgets, useServices } from '@/lib/queries';
import { WIDGET_CATALOG, type WidgetDef } from '@/lib/dashboardWidgets';
import { DashboardWidget } from '@/components/dashboard/DashboardWidget';
import { Skeleton } from '@/components/ui/skeleton';

export const Route = createFileRoute('/')({ component: Dashboard });

// Inserts only genuinely-new catalog widgets (in newKeys — never present in the user's saved
// config at all) into baseOrder, right after their nearest catalog neighbor that's already in
// baseOrder. A disabled widget is deliberately absent from baseOrder too, but it's NOT in
// newKeys (it has a saved row, just with enabled: false) — the two must stay distinguishable, or
// disabling a widget and a brand new widget showing up look identical and both end up visible.
function mergeNewWidgetsByCatalogPosition(baseOrder: string[], catalog: WidgetDef[], newKeys: Set<string>): string[] {
  const result = [...baseOrder];
  catalog.forEach((w, i) => {
    if (!newKeys.has(w.key)) return;
    let insertAt = result.length;
    for (let j = i - 1; j >= 0; j--) {
      const idx = result.indexOf(catalog[j].key);
      if (idx !== -1) {
        insertAt = idx + 1;
        break;
      }
    }
    result.splice(insertAt, 0, w.key);
  });
  return result;
}

function Dashboard() {
  const { isLoading: instancesLoading } = useServices();
  const { data: config, isLoading: configLoading } = useDashboardWidgets();

  if (instancesLoading || configLoading) {
    return (
      <div className="flex flex-col gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="mb-2 h-4 w-32" />
            <div className="flex gap-3">
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="h-52 w-32 shrink-0 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // No saved config yet — default to every catalog widget enabled, in catalog order. Catalog
  // entries added after the user last saved (like a new widget type) aren't in their saved list
  // yet — insert each one right after its nearest catalog neighbor that IS already in the saved
  // order, rather than always at the very end. A brand new widget can otherwise land dozens of
  // carousels deep on a long-customized dashboard, which on a short mobile viewport reads as "it
  // got removed" rather than "it's just at the bottom."
  const savedKeys = new Set((config ?? []).map((w) => w.key));
  const hasSavedConfig = (config?.length ?? 0) > 0;
  const newKeys = new Set(hasSavedConfig ? WIDGET_CATALOG.filter((w) => !savedKeys.has(w.key)).map((w) => w.key) : []);
  const orderedKeys = hasSavedConfig
    ? mergeNewWidgetsByCatalogPosition(config!.filter((w) => w.enabled).map((w) => w.key), WIDGET_CATALOG, newKeys)
    : WIDGET_CATALOG.map((w) => w.key);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Home</h1>
          <p className="text-sm text-muted-foreground">What’s new across your services</p>
        </div>
        <Link
          to="/settings/dashboard"
          className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Settings2 className="h-3.5 w-3.5" /> Customize
        </Link>
      </div>

      {orderedKeys.map((key) => (
        <DashboardWidget key={key} widgetKey={key} />
      ))}
    </div>
  );
}
