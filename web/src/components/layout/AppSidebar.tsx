import { NavContent } from './NavContent';

/** Persistent sidebar shown at the lg breakpoint and up — AppDrawer's overlay covers narrower screens. */
export function AppSidebar() {
  return (
    <aside className="hidden h-dvh w-[280px] shrink-0 flex-col border-r border-border bg-card lg:flex">
      <NavContent />
    </aside>
  );
}
