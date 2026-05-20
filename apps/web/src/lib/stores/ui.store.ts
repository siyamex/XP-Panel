import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIStore {
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  activeServerId: string | null;
  locale: 'en' | 'ar';
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (v: boolean) => void;
  setActiveServer: (id: string | null) => void;
  setLocale: (locale: 'en' | 'ar') => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      commandPaletteOpen: false,
      activeServerId: null,
      locale: 'en' as const,

      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),

      toggleCommandPalette: () =>
        set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
      setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),

      setActiveServer: (id) => set({ activeServerId: id }),
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: "xp-ui",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        activeServerId: state.activeServerId,
        locale: state.locale,
      }),
    }
  )
);
