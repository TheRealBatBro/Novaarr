import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('remotarr:theme', theme);
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
    }),
    {
      name: 'remotarr:ui',
      partialize: (state) => ({
        theme: state.theme,
        devShowAllServices: state.devShowAllServices,
        plexRecommendationUserId: state.plexRecommendationUserId,
        plexRecommendationRefreshMinutes: state.plexRecommendationRefreshMinutes,
      }),
    },
  ),
);
