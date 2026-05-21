import apiClient from './client'

export interface Notification {
  id: string
  type: 'alert' | 'info' | 'warning' | 'success' | 'billing' | 'security' | 'backup'
  title: string
  message: string
  read: boolean
  action_url?: string
  resource_type?: string
  resource_id?: string
  created_at: string
}

export const notificationsApi = {
  list: (params?: { unread_only?: boolean; type?: string; page?: number; per_page?: number }) =>
    apiClient.get<{ notifications: Notification[]; total: number; unread_count: number }>(
      '/notifications',
      { params }
    ).then(r => r.data),

  markRead: (id: string) =>
    apiClient.patch<{ message: string }>(`/notifications/${id}/read`).then(r => r.data),

  markAllRead: () =>
    apiClient.post<{ marked: number }>('/notifications/read-all').then(r => r.data),

  delete: (id: string) =>
    apiClient.delete(`/notifications/${id}`).then(r => r.data),

  deleteAll: () =>
    apiClient.delete('/notifications').then(r => r.data),

  getUnreadCount: () =>
    apiClient.get<{ count: number }>('/notifications/unread-count').then(r => r.data),
}
