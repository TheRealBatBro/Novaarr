import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applyAccent, applyAmoled, type AccentId } from '@/lib/theme';

// One-time migration for the Remotarr -> Novaarr rename: carry over UI prefs saved under the
// old localStorage key before zustand's persist middleware reads from the new one, so an
// upgrading user doesn't see their theme/dashboard prefs silently reset to defaults.
if (typeof localStorage !== 'undefined' && !localStorage.getItem('novaarr:ui')) {
  const legacy = localStorage.getItem('remotarr:ui');
  if (legacy) localStorage.setItem('novaarr:ui', legacy);
}

type UiState = {
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  /** Dev-only override for showing every registry service regardless of configured/enabled
   * state — null defers to the build/env default (see visibility.ts). */
  devShowAllServices: boolean | null;
  setDevShowAllServices: (value: boolean | null) => void;
  /** Which Plex/Tautulli user's watch history feeds the "Because you watched" dashboard widget
   * — null means every user's history is considered together (the original behavior). */
  plexRecommendationUserId: string | null;
  setPlexRecommendationUserId: (value: string | null) => void;
  /** How often the "Because you watched" widget re-fetches — separate from Tautulli's own
   * refreshIntervalMinutes since that also governs the fast-moving Now Playing/Recently Watched
   * widgets, which shouldn't be slowed down just because recommendations are deliberately cached
   * longer (each refresh fans out to several Overseerr TMDB recommendation calls). */
  plexRecommendationRefreshMinutes: number;
  setPlexRecommendationRefreshMinutes: (value: number) => void;
  /** Accent color preset — see web/src/lib/theme.ts for the fixed set of options. */
  accent: AccentId;
  setAccent: (value: AccentId) => void;
  /** True-black dark theme variant (OLED-friendly) — only visually meaningful while `theme` is
   * 'dark', but the preference itself is independent so it's remembered across a light/dark toggle. */
  amoled: boolean;
  setAmoled: (value: boolean) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('novaarr:theme', theme);
        applyAccent(get().accent, theme);
        set({ theme });
      },
      paletteOpen: false,
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
      drawerOpen: false,
      setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
      devShowAllServices: null,
      setDevShowAllServices: (devShowAllServices) => set({ devShowAllServices }),
      plexRecommendationUserId: null,
      setPlexRecommendationUserId: (plexRecommendationUserId) => set({ plexRecommendationUserId }),
      plexRecommendationRefreshMinutes: 240,
      setPlexRecommendationRefreshMinutes: (plexRecommendationRefreshMinutes) => set({ plexRecommendationRefreshMinutes }),
      accent: 'violet',
      setAccent: (accent) => {
        applyAccent(accent, get().theme);
        set({ accent });
      },
      amoled: false,
      setAmoled: (amoled) => {
        applyAmoled(amoled);
        set({ amoled });
      },
    }),
    {
      name: 'novaarr:ui',
      partialize: (state) => ({
        theme: state.theme,
        devShowAllServices: state.devShowAllServices,
        plexRecommendationUserId: state.plexRecommendationUserId,
        plexRecommendationRefreshMinutes: state.plexRecommendationRefreshMinutes,
        accent: state.accent,
        amoled: state.amoled,
      }),
      // Re-apply the CSS side effects on rehydrate — persist restores the plain state fields but
      // never re-runs the setters that carry the actual DOM/CSS-var work, so a page reload would
      // otherwise silently drop back to the default accent/AMOLED look until the user re-toggled it.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        applyAccent(state.accent, state.theme);
        applyAmoled(state.amoled);
      },
    },
  ),
);
