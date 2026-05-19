import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export const apiClient = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT access token to every request
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("xp-auth");
      if (stored) {
        const { state } = JSON.parse(stored);
        if (state?.accessToken) {
          config.headers.Authorization = `Bearer ${state.accessToken}`;
        }
      }
    } catch {
      // ignore
    }
  }
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

// Auto-refresh on 401
apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    const is403Perms = error.response?.status === 403 &&
      (error.response?.data as any)?.error?.message?.includes("insufficient permissions");

    if ((error.response?.status === 401 || is403Perms) && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(original));
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const stored = localStorage.getItem("xp-auth");
        if (!stored) throw new Error("no stored auth");
        const { state } = JSON.parse(stored);
        const refreshToken = state?.refreshToken;
        if (!refreshToken) throw new Error("no refresh token");

        const { data } = await axios.post(`${API_BASE}/api/v1/auth/refresh`, {
          refreshToken,
        });

        const newToken = data.data.accessToken;
        const newRefresh = data.data.refreshToken ?? state.refreshToken;

        // Decode new JWT to get updated permissions
        let newUser = state.user;
        try {
          const payload = JSON.parse(atob(newToken.split(".")[1]));
          newUser = {
            id: payload.sub,
            email: payload.email,
            username: payload.username,
            orgId: payload.org,
            roles: payload.roles ?? [],
            permissions: payload.perms ?? [],
          };
        } catch {}

        // Update persisted store
        const newState = { ...state, accessToken: newToken, refreshToken: newRefresh, user: newUser, isAuthenticated: true };
        localStorage.setItem("xp-auth", JSON.stringify({ state: newState, version: 0 }));

        refreshQueue.forEach((cb) => cb(newToken));
        refreshQueue = [];

        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      } catch {
        refreshQueue = [];
        localStorage.removeItem("xp-auth");
        window.location.href = "/login";
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Alias so both `import { api }` and `import { apiClient }` work
export const api = apiClient;

export default apiClient;
