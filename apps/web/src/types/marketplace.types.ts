export interface MarketplaceApp {
  id: string
  slug: string
  name: string
  description: string
  category: string
  icon_url: string
  version: string
  author: string
  homepage: string
  install_count: number
  rating: number
  tags: string[]
  requirements: Record<string, any>
  is_featured: boolean
  is_active: boolean
}

export interface Installation {
  id: string
  organization_id: string
  app_id: string
  app?: Pick<MarketplaceApp, 'slug' | 'name' | 'category' | 'version'>
  domain_id: string | null
  install_path: string
  status: 'installing' | 'active' | 'updating' | 'failed' | 'removed'
  version: string
  config: Record<string, any>
  installed_at: string
}

export interface InstallRequest {
  app_slug: string
  domain_id?: string
  install_path?: string
  admin_user?: string
  admin_pass?: string
  admin_email?: string
  site_name?: string
}

export const APP_CATEGORIES = [
  { value: 'all', label: 'All Apps' },
  { value: 'cms', label: 'CMS' },
  { value: 'framework', label: 'Frameworks' },
  { value: 'storage', label: 'Storage' },
  { value: 'automation', label: 'Automation' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'community', label: 'Community' },
] as const
