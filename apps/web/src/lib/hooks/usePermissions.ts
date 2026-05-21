import { useAuthStore } from '@/lib/stores/auth.store'
import { canDo } from '@/lib/utils/permissions'

/**
 * Returns a `can(action)` checker bound to the current user's roles.
 * Also exposes `role` (highest-privilege role) and `isAdmin`, `isSuperAdmin`.
 */
export function usePermissions() {
  const { user } = useAuthStore()
  const roles: string[] = user?.roles ?? []

  const isSuperAdmin = roles.includes('super_admin')
  const isAdmin = isSuperAdmin || roles.includes('admin')
  const isReseller = isAdmin || roles.includes('reseller')

  function can(action: string): boolean {
    if (isSuperAdmin) return true
    return roles.some(role => canDo(role, action))
  }

  function canAny(...actions: string[]): boolean {
    return actions.some(can)
  }

  function canAll(...actions: string[]): boolean {
    return actions.every(can)
  }

  const role = isSuperAdmin
    ? 'super_admin'
    : isAdmin
    ? 'admin'
    : isReseller
    ? 'reseller'
    : roles[0] ?? 'user'

  return { can, canAny, canAll, role, isAdmin, isSuperAdmin, isReseller, roles }
}
