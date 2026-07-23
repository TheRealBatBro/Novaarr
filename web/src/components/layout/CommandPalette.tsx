import { useEffect, useMemo, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Search } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useUiStore } from '@/stores/useUiStore';
import { useVisibleServices } from '@/lib/visibility';
import { getServiceIcon } from '@/lib/serviceIcons';

/** Uses Radix's own data-state-driven CSS animation, not framer-motion's AnimatePresence +
 * forceMount — see AppDrawer.tsx for why that combo can leave a full-screen invisible
 * click-blocking overlay stuck in the DOM when a result selection closes the palette and
 * navigates in the same tick (exactly what `select()` below does). */
export function CommandPalette() {
  const { paletteOpen, setPaletteOpen } = useUiStore();
  const navigate = useNavigate();
  const visible = useVisibleServices();
  const [query, setQuery] = useState('');

  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
      }
    }
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [paletteOpen, setPaletteOpen]);

  useEffect(() => {
    if (!paletteOpen) setQuery('');
  }, [paletteOpen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = visible.map(({ definition, instance }) => ({ def: definition, instance }));
    if (!q) return base;
    return base.filter(
      ({ def, instance }) => def.displayName.toLowerCase().includes(q) || instance?.displayName.toLowerCase().includes(q),
    );
  }, [query, visible]);

  function select(serviceId: string) {
    setPaletteOpen(false);
    navigate({ to: '/service/$serviceId', params: { serviceId } });
  }

  return (
    <DialogPrimitive.Root open={paletteOpen} onOpenChange={setPaletteOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm duration-150 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed left-1/2 top-24 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl duration-150 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2"
        >
          <DialogPrimitive.Title className="sr-only">Jump to service</DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Jump to a service…"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">Esc</kbd>
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {results.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches.</p>}
            {results.map(({ def, instance }) => {
              const Icon = getServiceIcon(def.id);
              return (
                <button
                  key={def.id}
                  onClick={() => select(def.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                    style={{ backgroundColor: `${def.brandColor}22`, color: def.brandColor }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{def.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">{instance ? instance.displayName : 'Not configured'}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
