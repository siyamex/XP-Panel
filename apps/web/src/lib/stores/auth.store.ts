import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserState {
  id?: string;
  email?: string;
  username?: string;
  orgId?: string;
  roles?: string[];
  permissions?: string[];
}

interface AuthStore {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserState | null;
  isAuthenticated: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: UserState) => void;
  logout: () => void;
  hasPermission: (perm: string) => boolean;
  hasRole: (role: string) => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      setTokens: (accessToken, refreshToken) => {
        // Decode user info from JWT payload (client-side, no verification)
        try {
          const payload = JSON.parse(atob(accessToken.split(".")[1]));
          set({
            accessToken,
            refreshToken,
            isAuthenticated: true,
            user: {
              id: payload.sub,
              email: payload.email,
              username: payload.username,
              orgId: payload.org,
              roles: payload.roles ?? [],
              permissions: payload.perms ?? [],
            },
          });
        } catch {
          set({ accessToken, refreshToken, isAuthenticated: true });
        }
      },

      setUser: (user) => set({ user }),

      logout: () => {
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
        });
        window.location.href = "/login";
      },

      hasPermission: (perm) => {
        const { user } = get();
        if (!user?.permissions) return false;
        return (
          user.permissions.includes("super:*") ||
          user.permissions.includes(perm)
        );
      },

      hasRole: (role) => {
        const { user } = get();
        if (!user?.roles) return false;
        return user.roles.includes("super_admin") || user.roles.includes(role);
      },
    }),
    {
      name: "xp-auth",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
