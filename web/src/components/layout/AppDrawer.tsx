import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useUiStore } from '@/stores/useUiStore';
import { NavContent } from './NavContent';

/**
 * Mobile/tablet-only slide-out overlay — hidden at the lg breakpoint, where AppSidebar takes
 * over. Uses Radix's own data-state-driven CSS animation (like ui/dialog.tsx), not framer-motion's
 * AnimatePresence + forceMount — that combo left the backdrop's exit stuck mid-fade (opacity 0 but
 * still `pointer-events: auto`, silently eating every click on the page) whenever a nav tap closed
 * the drawer and navigated in the same tick, which is the only way navigation happens below the lg
 * breakpoint. Radix's own Presence unmount timing doesn't have that failure mode.
 */
export function AppDrawer() {
  const { drawerOpen, setDrawerOpen } = useUiStore();

  return (
    <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/60 duration-150 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 lg:hidden"
        />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-y-0 left-0 z-50 flex w-[300px] max-w-[85vw] flex-col border-r border-border bg-card shadow-2xl duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left lg:hidden"
        >
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
          <NavContent onNavigate={() => setDrawerOpen(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
