import { apiClient } from './client'
import type { BillingPlan, Subscription, Invoice, UsageStats, CreateSubscriptionRequest } from '@/types/billing.types'

const BASE = '/billing'

export const billingApi = {
  listPlans: () => apiClient.get<{ plans: BillingPlan[] }>(`${BASE}/plans`),
  getSubscription: () => apiClient.get<Subscription>(`${BASE}/subscription`),
  createSubscription: (data: CreateSubscriptionRequest) => apiClient.post<{ id: string; status: string }>(`${BASE}/subscription`, data),
  cancelSubscription: (atPeriodEnd = true) => apiClient.delete(`${BASE}/subscription`, { data: { at_period_end: atPeriodEnd } }),
  listInvoices: () => apiClient.get<{ invoices: Invoice[] }>(`${BASE}/invoices`),
  getUsage: () => apiClient.get<UsageStats>(`${BASE}/usage`),
}
