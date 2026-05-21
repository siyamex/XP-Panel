import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ActiveServer {
  id: string
  hostname: string
  ip: string
  status: 'active' | 'offline' | 'maintenance'
  datacenter?: string
  os_type?: string
}

interface ServerStore {
  activeServer: ActiveServer | null
  recentServers: ActiveServer[]
  setActiveServer: (server: ActiveServer | null) => void
  addRecentServer: (server: ActiveServer) => void
  clearActiveServer: () => void
}

export const useServerStore = create<ServerStore>()(
  persist(
    (set) => ({
      activeServer: null,
      recentServers: [],

      setActiveServer: (server) =>
        set(state => ({
          activeServer: server,
          recentServers: server
            ? [server, ...state.recentServers.filter(s => s.id !== server.id)].slice(0, 5)
            : state.recentServers,
        })),

      addRecentServer: (server) =>
        set(state => ({
          recentServers: [server, ...state.recentServers.filter(s => s.id !== server.id)].slice(0, 5),
        })),

      clearActiveServer: () => set({ activeServer: null }),
    }),
    { name: 'xp-panel-server' }
  )
)
