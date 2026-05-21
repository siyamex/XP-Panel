import apiClient from "./client";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  tokenType: string;
}

export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await apiClient.post<{
      data?: TokenPair;
      mfaRequired?: boolean;
      tempToken?: string;
    }>("/auth/login", { email, password });
    return data;
  },

  register: async (input: {
    orgName: string;
    orgSlug: string;
    email: string;
    username: string;
    password: string;
  }) => {
    const { data } = await apiClient.post<{ data: TokenPair; message: string }>(
      "/auth/register",
      input
    );
    return data;
  },

  refresh: async (refreshToken: string) => {
    const { data } = await apiClient.post<{ data: TokenPair }>(
      "/auth/refresh",
      { refreshToken }
    );
    return data;
  },

  logout: async () => {
    await apiClient.post("/auth/logout");
  },

  me: async () => {
    const { data } = await apiClient.get<{
      data: {
        id: string;
        email: string;
        username: string;
        roles: string[];
        orgId: string;
        mfaEnabled: boolean;
        passkeyEnabled: boolean;
      };
    }>("/auth/me");
    return data.data;
  },

  setupTOTP: async () => {
    const { data } = await apiClient.post<{
      data: { secret: string; qrCodeUrl: string };
    }>("/auth/mfa/totp/setup");
    return data.data;
  },

  confirmTOTP: async (code: string) => {
    const { data } = await apiClient.post("/auth/mfa/totp/confirm", { code });
    return data;
  },

  verifyMFA: async (params: { mfa_session_id: string; code: string; backup?: boolean }) => {
    const { data } = await apiClient.post<{
      data?: TokenPair;
      message?: string;
    }>("/auth/mfa/verify", params);
    return data;
  },

  disableMFA: async (code: string) => {
    const { data } = await apiClient.post("/auth/mfa/disable", { code });
    return data;
  },

  listSessions: async () => {
    const { data } = await apiClient.get<{
      sessions: Array<{
        id: string;
        ip_address: string | null;
        user_agent: string | null;
        created_at: string;
        last_active_at: string;
        expires_at: string;
        is_current: boolean;
      }>;
    }>("/auth/sessions");
    return data.sessions;
  },

  revokeSession: async (id: string) => {
    await apiClient.delete(`/auth/sessions/${id}`);
  },

  revokeAllSessions: async () => {
    const { data } = await apiClient.delete<{ revoked: number }>("/auth/sessions");
    return data;
  },

  updateProfile: async (input: {
    firstName?: string;
    lastName?: string;
    timezone?: string;
    language?: string;
  }) => {
    const { data } = await apiClient.patch("/auth/me", input);
    return data;
  },

  forgotPassword: async (email: string) => {
    const { data } = await apiClient.post<{ message: string }>(
      "/auth/forgot-password",
      { email }
    );
    return data;
  },

  resetPassword: async (token: string, password: string) => {
    const { data } = await apiClient.post<{ message: string }>(
      "/auth/reset-password",
      { token, password }
    );
    return data;
  },

  oauthRedirect: (provider: "github" | "google" | "gitlab") => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
    window.location.href = `${apiBase}/api/v1/auth/oauth/${provider}`;
  },
};
