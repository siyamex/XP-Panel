import { apiClient } from './client'
import type { MarketplaceApp, Installation, InstallRequest } from '@/types/marketplace.types'

const BASE = '/marketplace'

export const marketplaceApi = {
  listApps: (params?: { category?: string; q?: string; featured?: boolean }) =>
    apiClient.get<{ apps: MarketplaceApp[] }>(`${BASE}/apps`, { params }),
  getApp: (slug: string) => apiClient.get<MarketplaceApp>(`${BASE}/apps/${slug}`),
  installApp: (data: InstallRequest) => apiClient.post<{ id: string; status: string; install_path: string }>(`${BASE}/install`, data),
  listInstallations: () => apiClient.get<{ installations: Installation[] }>(`${BASE}/installations`),
  uninstallApp: (id: string) => apiClient.delete(`${BASE}/installations/${id}`),
}
