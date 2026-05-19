'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard, CheckCircle2, Loader2, TrendingUp, HardDrive, Globe, Mail, Database } from 'lucide-react'
import { billingApi } from '@/lib/api/billing.api'
import type { CreateSubscriptionRequest } from '@/types/billing.types'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'
import Link from 'next/link'

const STATUS_COLOR: Record<string, string> = {
  active:    'bg-green-500/10 text-green-500',
  trialing:  'bg-blue-500/10 text-blue-500',
  past_due:  'bg-amber-500/10 text-amber-500',
  cancelled: 'bg-muted text-muted-foreground',
  paused:    'bg-muted text-muted-foreground',
}

export default function BillingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const qc = useQueryClient()

  const { data: plans, isLoading: loadingPlans } = useQuery({
    queryKey: ['billing-plans'],
    queryFn: () => billingApi.listPlans(),
    select: (r) => r.data?.plans ?? [],
  })

  const { data: subscription, isLoading: loadingSub } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => billingApi.getSubscription(),
    select: (r) => r.data,
  })

  const { data: usage } = useQuery({
    queryKey: ['billing-usage'],
    queryFn: () => billingApi.getUsage(),
    select: (r) => r.data,
  })

  const subscribeMutation = useMutation({
    mutationFn: (data: CreateSubscriptionRequest) => billingApi.createSubscription(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subscription'] }); toast.success('Plan updated!') },
    onError: () => toast.error('Failed to update plan'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => billingApi.cancelSubscription(true),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subscription'] }); toast.success('Subscription will cancel at period end') },
    onError: () => toast.error('Failed to cancel subscription'),
  })

  const usageItems = usage ? [
    { label: 'Domains', icon: Globe, used: usage.domains.used, limit: usage.domains.limit },
    { label: 'Disk', icon: HardDrive, used: usage.disk_gb.used, limit: usage.disk_gb.limit, unit: 'GB' },
    { label: 'Bandwidth', icon: TrendingUp, used: usage.bandwidth_gb.used, limit: usage.bandwidth_gb.limit, unit: 'GB' },
    { label: 'Email Accounts', icon: Mail, used: usage.email_accounts.used, limit: usage.email_accounts.limit },
    { label: 'Databases', icon: Database, used: usage.databases.used, limit: usage.databases.limit },
  ] : []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Subscriptions, usage, and invoices</p>
        </div>
        <Link href="/billing/invoices" className="text-sm text-primary hover:underline">View invoices →</Link>
      </div>

      {/* Current subscription */}
      {!loadingSub && subscription && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Current Plan</h3>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', STATUS_COLOR[subscription.status] ?? STATUS_COLOR.active)}>
              {subscription.status}
            </span>
          </div>
          <div className="flex items-end gap-4">
            <div>
              <div className="text-3xl font-black">{subscription.plan?.name}</div>
              <div className="text-sm text-muted-foreground mt-1">
                ${subscription.billing_cycle === 'yearly' ? subscription.plan?.price_yearly : subscription.plan?.price_monthly}
                /{subscription.billing_cycle === 'yearly' ? 'yr' : 'mo'}
              </div>
            </div>
            {subscription.current_period_end && (
              <div className="text-xs text-muted-foreground ml-auto">
                {subscription.cancel_at_period_end ? 'Cancels' : 'Renews'} {new Date(subscription.current_period_end).toLocaleDateString()}
              </div>
            )}
          </div>
          {!subscription.cancel_at_period_end && (
            <button onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending} className="mt-4 text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50">
              Cancel subscription
            </button>
          )}
        </div>
      )}

      {/* Usage */}
      {usageItems.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Resource Usage</h3>
          <div className="space-y-3">
            {usageItems.map(({ label, icon: Icon, used, limit, unit }) => {
              const pct = limit === -1 ? 0 : Math.min((used / limit) * 100, 100)
              return (
                <div key={label}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Icon className="w-3.5 h-3.5" />{label}
                    </div>
                    <span className="text-xs">
                      {used}{unit ? ` ${unit}` : ''} / {limit === -1 ? '∞' : `${limit}${unit ? ` ${unit}` : ''}`}
                    </span>
                  </div>
                  {limit !== -1 && (
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', pct > 80 ? 'bg-destructive' : pct > 60 ? 'bg-amber-500' : 'bg-primary')}
                        style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Plan selector */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Change Plan</h3>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {(['monthly', 'yearly'] as const).map((c) => (
              <button key={c} onClick={() => setBillingCycle(c)} className={cn('px-3 py-1 text-xs rounded-md capitalize transition-colors', billingCycle === c ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>
                {c}{c === 'yearly' && <span className="ml-1 text-green-500 font-medium">-20%</span>}
              </button>
            ))}
          </div>
        </div>
        {loadingPlans ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {(plans ?? []).map((plan) => {
              const isCurrent = subscription?.plan_id === plan.id
              const price = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly
              return (
                <div key={plan.id} className={cn('bg-card border rounded-xl p-5 flex flex-col', isCurrent ? 'border-primary' : 'border-border')}>
                  {isCurrent && <div className="text-xs text-primary font-medium mb-2">Current plan</div>}
                  <div className="font-bold text-lg">{plan.name}</div>
                  <div className="text-2xl font-black mt-1">${price}<span className="text-sm font-normal text-muted-foreground">/{billingCycle === 'yearly' ? 'yr' : 'mo'}</span></div>
                  <div className="flex-1 space-y-1.5 mt-4 mb-4">
                    {Object.entries(plan.features ?? {}).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                        <span className="capitalize">{key.replace(/_/g, ' ')}: {String(val)}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => subscribeMutation.mutate({ plan_slug: plan.slug, billing_cycle: billingCycle })}
                    disabled={isCurrent || subscribeMutation.isPending}
                    className={cn('w-full py-2 rounded-lg text-sm font-medium transition-colors', isCurrent ? 'bg-muted text-muted-foreground cursor-default' : 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50')}
                  >
                    {isCurrent ? 'Current' : 'Select Plan'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
