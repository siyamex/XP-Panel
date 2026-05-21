// RBAC permission map — mirrors services/auth RBAC constants
const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ['super:*'],
  admin: [
    'domains:read', 'domains:write', 'domains:delete',
    'dns:read', 'dns:write',
    'mail:read', 'mail:write',
    'files:read', 'files:write',
    'db:read', 'db:write',
    'backup:read', 'backup:write', 'backup:restore',
    'security:read', 'security:write',
    'monitoring:read', 'monitoring:write',
    'billing:read', 'billing:write',
    'devops:read', 'devops:write',
    'docker:read', 'docker:write',
    'ai:use',
    'marketplace:read', 'marketplace:install',
    'admin:users', 'admin:servers',
  ],
  reseller: [
    'domains:read', 'domains:write',
    'dns:read', 'dns:write',
    'mail:read', 'mail:write',
    'db:read', 'db:write',
    'backup:read', 'backup:write',
    'monitoring:read',
    'billing:read', 'billing:write',
    'ai:use',
    'marketplace:read', 'marketplace:install',
    'admin:users',
  ],
  user: [
    'domains:read', 'domains:write',
    'dns:read', 'dns:write',
    'mail:read', 'mail:write',
    'files:read', 'files:write',
    'db:read', 'db:write',
    'backup:read', 'backup:write', 'backup:restore',
    'monitoring:read',
    'billing:read',
    'ai:use',
    'marketplace:read', 'marketplace:install',
  ],
  developer: [
    'domains:read', 'domains:write',
    'dns:read', 'dns:write',
    'mail:read', 'mail:write',
    'files:read', 'files:write',
    'db:read', 'db:write',
    'backup:read', 'backup:write', 'backup:restore',
    'monitoring:read',
    'billing:read',
    'devops:read', 'devops:write',
    'docker:read', 'docker:write',
    'ai:use',
    'marketplace:read', 'marketplace:install',
  ],
  auditor: [
    'domains:read', 'dns:read', 'mail:read',
    'db:read', 'backup:read', 'security:read',
    'monitoring:read', 'billing:read',
    'devops:read', 'docker:read', 'marketplace:read',
  ],
}

/**
 * Check if a role has a given permission.
 * Supports wildcard: 'super:*' grants everything.
 */
export function canDo(role: string, action: string): boolean {
  const perms = ROLE_PERMISSIONS[role] ?? []
  if (perms.includes('super:*')) return true
  if (perms.includes(action)) return true
  // Wildcard namespace: 'domains:*' grants 'domains:read', 'domains:write', etc.
  const ns = action.split(':')[0]
  return perms.includes(`${ns}:*`)
}

/**
 * Check if any of the given roles can perform the action.
 */
export function rolesCanDo(roles: string[], action: string): boolean {
  return roles.some(r => canDo(r, action))
}

/** Human-readable label for a role. */
export function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    super_admin: 'Super Admin',
    admin:       'Admin',
    reseller:    'Reseller',
    user:        'User',
    developer:   'Developer',
    auditor:     'Auditor',
  }
  return labels[role] ?? role
}
