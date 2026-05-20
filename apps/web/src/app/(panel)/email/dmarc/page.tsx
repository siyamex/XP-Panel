'use client'

import { useState } from 'react'
import { Shield, Copy, CheckCircle2 } from 'lucide-react'
import { mailApi } from '@/lib/api/mail.api'
import { toast } from 'sonner'

const POLICIES = [
  { value: 'none', label: 'None (Monitor only)', desc: 'Emails pass but failures are reported. Good for initial setup.' },
  { value: 'quarantine', label: 'Quarantine', desc: 'Failed emails go to spam/quarantine folder.' },
  { value: 'reject', label: 'Reject', desc: 'Failed emails are rejected outright. Strictest option.' },
]

export default function DMARCPage() {
  const [domain, setDomain] = useState('')
  const [policy, setPolicy] = useState<'none' | 'quarantine' | 'reject'>('none')
  const [result, setResult] = useState<{
    dns_name: string; dns_type: string; dns_value: string; guidelines: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const generate = async () => {
    if (!domain.trim()) return
    try {
      const { data } = await mailApi.getDMARCRecord(domain.trim(), policy)
      setResult(data)
    } catch {
      toast.error('Failed to generate DMARC record')
    }
  }

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Copied to clipboard')
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">DMARC Configuration</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate a DMARC DNS record to protect your domain from email spoofing
        </p>
      </div>

      <div className="bg-card border rounded-xl p-6 space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Domain</label>
          <input
            value={domain}
            onChange={e => setDomain(e.target.value)}
            placeholder="example.com"
            className="w-full border border-input rounded-lg px-3 py-2.5 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Policy</label>
          <div className="space-y-2">
            {POLICIES.map(p => (
              <label key={p.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${policy === p.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                <input type="radio" name="policy" value={p.value} checked={policy === p.value}
                  onChange={() => setPolicy(p.value as 'none' | 'quarantine' | 'reject')} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <button onClick={generate} disabled={!domain.trim()}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
          <Shield className="h-4 w-4" />
          Generate DMARC Record
        </button>
      </div>

      {result && (
        <div className="bg-card border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Add this DNS record
          </h2>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Type</p>
              <p className="font-mono font-medium">TXT</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Host / Name</p>
              <p className="font-mono font-medium">{result.dns_name}</p>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Value</p>
            <div className="flex items-start gap-2">
              <code className="flex-1 text-xs font-mono bg-muted rounded-lg p-3 break-all">{result.dns_value}</code>
              <button onClick={() => copy(result.dns_value)}
                className="p-2 border rounded-lg hover:bg-muted transition-colors shrink-0">
                {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
            {result.guidelines}
          </div>
        </div>
      )}
    </div>
  )
}
