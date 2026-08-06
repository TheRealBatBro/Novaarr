import { createFileRoute } from '@tanstack/react-router';
import { Check } from 'lucide-react';
import { SettingsTabs } from '@/components/settings/SettingsTabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useUiStore } from '@/stores/useUiStore';
import { ACCENT_PRESETS } from '@/lib/theme';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/settings/appearance')({ component: SettingsAppearance });

function SettingsAppearance() {
  const { theme, setTheme, accent, setAccent, amoled, setAmoled } = useUiStore();

  return (
    <div>
      <SettingsTabs active="appearance" />
      <h1 className="text-2xl font-bold tracking-tight">Appearance</h1>
      <p className="mb-6 text-sm text-muted-foreground">Personal to this device/browser — not shared with anyone else who signs in.</p>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Theme</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex gap-2">
              {(['dark', 'light'] as const).map((t) => (
                <Button key={t} variant={theme === t ? 'default' : 'outline'} className="flex-1 capitalize" onClick={() => setTheme(t)}>
                  {t}
                </Button>
              ))}
            </div>
            <label className={cn('flex items-center justify-between rounded-xl border border-border p-3', theme !== 'dark' && 'opacity-50')}>
              <div>
                <p className="text-sm font-medium">AMOLED black</p>
                <p className="text-xs text-muted-foreground">True black surfaces instead of dark gray — saves power on OLED screens, and just looks nice</p>
              </div>
              <Switch checked={amoled} onCheckedChange={setAmoled} disabled={theme !== 'dark'} />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Accent color</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {ACCENT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setAccent(p.id)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors',
                    accent === p.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent',
                  )}
                >
                  <span className="relative flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: p.swatch }}>
                    {accent === p.id && <Check className="h-4 w-4 text-white drop-shadow" />}
                  </span>
                  <span className="text-xs font-medium">{p.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
