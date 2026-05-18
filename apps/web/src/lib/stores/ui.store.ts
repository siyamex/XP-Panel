import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIStore {
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  activeServerId: string | null;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (v: boolean) => void;
  setActiveServer: (id: string | null) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      commandPaletteOpen: false,
      activeServerId: null,

      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),

      toggleCommandPalette: () =>
        set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
      setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),

      setActiveServer: (id) => set({ activeServerId: id }),
    }),
    {
      name: "xp-ui",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        activeServerId: state.activeServerId,
      }),
    }
  )
);
