export interface BillingPlan {
  id: string
  name: string
  slug: string
  price_monthly: number
  price_yearly: number
  currency: string
  features: Record<string, any>
  limits: Record<string, any>
  is_active: boolean
}

export interface Subscription {
  id: string
  organization_id: string
  plan_id: string
  plan?: BillingPlan
  status: 'active' | 'cancelled' | 'past_due' | 'trialing' | 'paused'
  billing_cycle: 'monthly' | 'yearly'
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  trial_ends_at: string | null
  created_at: string
}

export interface Invoice {
  id: string
  organization_id: string
  number: string
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'
  amount_due: number
  amount_paid: number
  currency: string
  period_start: string | null
  period_end: string | null
  due_date: string | null
  paid_at: string | null
  pdf_url: string
  created_at: string
}

export interface UsageStats {
  domains: { used: number; limit: number }
  disk_gb: { used: number; limit: number }
  bandwidth_gb: { used: number; limit: number }
  email_accounts: { used: number; limit: number }
  databases: { used: number; limit: number }
}

export interface CreateSubscriptionRequest {
  plan_slug: string
  billing_cycle: 'monthly' | 'yearly'
}
