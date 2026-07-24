import { useEffect } from 'react';

// AppShell resets scroll on route change, but switching an in-page tab (library/queue/history,
// etc.) doesn't change the route — it's local component state — so the shared <main> scroll
// container was carrying over whatever position the previous tab was left at. Call this with the
// active tab value from any screen that has this kind of internal tab state.
export function useResetScrollOnChange(dep: unknown) {
  useEffect(() => {
    document.querySelector('main')?.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
}
