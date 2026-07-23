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
    }),
    {
      name: 'remotarr:ui',
      partialize: (state) => ({ theme: state.theme, devShowAllServices: state.devShowAllServices }),
    },
  ),
);
