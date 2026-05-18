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

  verifyMFA: async (tempToken: string, code: string) => {
    const { data } = await apiClient.post<{
      data?: TokenPair;
      message?: string;
    }>("/auth/mfa/verify", { tempToken, code });
    return data;
  },

  disableMFA: async (code: string) => {
    const { data } = await apiClient.post("/auth/mfa/disable", { code });
    return data;
  },
};
