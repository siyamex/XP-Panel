'use client'

import { useAuthStore } from '@/lib/stores/auth.store'

export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken
}

export function isAuthenticated(): boolean {
  return useAuthStore.getState().isAuthenticated
}

export function getCurrentUser() {
  return useAuthStore.getState().user
}

export function clearSession() {
  useAuthStore.getState().logout()
}

export function hasRole(role: string): boolean {
  const user = useAuthStore.getState().user
  return user?.roles?.includes(role) ?? false
}

export function hasPermission(permission: string): boolean {
  const user = useAuthStore.getState().user
  if (!user?.roles) return false
  return user.roles.includes('super_admin') || user.roles.includes(permission)
}
