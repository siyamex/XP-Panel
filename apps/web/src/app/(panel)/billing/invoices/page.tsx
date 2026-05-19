'use client'

import { useQuery } from '@tanstack/react-query'
import { FileText, Download, Loader2, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { billingApi } from '@/lib/api/billing.api'
import { cn } from '@/lib/utils/cn'
import Link from 'next/link'

const STATUS_CONFIG = {
  paid:           { color: 'bg-green-500/10 text-green-500',     icon: CheckCircle2 },
  open:           { color: 'bg-blue-500/10 text-blue-500',       icon: Clock },
  draft:          { color: 'bg-muted text-muted-foreground',     icon: FileText },
  void:           { color: 'bg-muted text-muted-foreground',     icon: FileText },
  uncollectible:  { color: 'bg-destructive/10 text-destructive', icon: AlertCircle },
}

export default function InvoicesPage() {
  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => billingApi.listInvoices(),
    select: (r) => r.data?.invoices ?? [],
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/billing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Billing</Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-2xl font-bold">Invoices</h1>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : !invoices?.length ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <FileText className="w-10 h-10 mb-2 opacity-30" />
            No invoices yet
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Invoice</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Period</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Due</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const cfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.draft
                const Icon = cfg.icon
                return (
                  <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-medium">{inv.number}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{new Date(inv.created_at).toLocaleDateString()}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('flex items-center gap-1 text-xs px-2 py-0.5 rounded-full w-fit capitalize font-medium', cfg.color)}>
                        <Icon className="w-3 h-3" />{inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {inv.period_start && inv.period_end
                        ? `${new Date(inv.period_start).toLocaleDateString()} – ${new Date(inv.period_end).toLocaleDateString()}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {inv.currency} {inv.amount_due.toFixed(2)}
                      {inv.amount_paid > 0 && inv.amount_paid < inv.amount_due && (
                        <div className="text-xs text-muted-foreground">Paid: {inv.amount_paid.toFixed(2)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : inv.paid_at ? `Paid ${new Date(inv.paid_at).toLocaleDateString()}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {inv.pdf_url && (
                          <a href={inv.pdf_url} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-muted transition-colors">
                            <Download className="w-3.5 h-3.5 text-muted-foreground" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
