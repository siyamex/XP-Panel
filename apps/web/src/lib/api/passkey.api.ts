import { api } from './client'

export interface Passkey {
  id: string
  credential_id: string
  device_name: string
  aaguid: string
  sign_count: number
  created_at: string
}

export const passkeyApi = {
  list: () => api.get<{ passkeys: Passkey[]; total: number }>('/auth/passkeys'),
  delete: (id: string) => api.delete(`/auth/passkeys/${id}`),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  beginRegistration: () => api.get<any>('/auth/passkeys/register/begin'),
  finishRegistration: (credential: unknown, deviceName?: string) =>
    api.post<{ ok: boolean; device_name: string }>('/auth/passkeys/register/finish', { ...credential as object, device_name: deviceName }),
  beginAuthentication: (email: string) =>
    api.post<Record<string, unknown>>('/auth/passkeys/authenticate/begin', { email }),
  finishAuthentication: (credential: unknown, email: string) =>
    api.post<{ ok: boolean; user_id: string }>('/auth/passkeys/authenticate/finish', { ...credential as object, email }),
}
