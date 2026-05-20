'use client'

import { useState } from 'react'
import { Search, CheckCircle2, XCircle, Clock, Globe } from 'lucide-react'
import { dnsApi } from '@/lib/api/dns.api'

const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS']

type PropResult = {
  resolver: string
  location: string
  values: string[]
  error?: string
  ok: boolean
}

export default function DNSPropagationPage() {
  const [domain, setDomain] = useState('')
  const [type, setType] = useState('A')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{
    domain: string
    type: string
    results: PropResult[]
    propagated: number
    total: number
    percentage: string
  } | null>(null)

  const check = async () => {
    if (!domain.trim()) return
    setLoading(true)
    try {
      const { data } = await dnsApi.checkPropagation(domain.trim(), type)
      setResults(data)
    } catch {
      // fallback
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">DNS Propagation Checker</h1>
        <p className="text-muted-foreground text-sm mt-1">Check if your DNS changes have propagated across global resolvers</p>
      </div>

      <div className="bg-card border rounded-xl p-6 space-y-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={domain}
              onChange={e => setDomain(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && check()}
              placeholder="example.com"
              className="w-full border border-input rounded-lg px-3 py-2.5 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="border border-input rounded-lg px-3 py-2.5 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {RECORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button
            onClick={check}
            disabled={loading || !domain.trim()}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? <Clock className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Check
          </button>
        </div>
      </div>

      {results && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">
              Results for <span className="text-primary">{results.domain}</span> ({results.type})
            </h2>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 min-w-[120px] bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: results.percentage }}
                />
              </div>
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                {results.propagated}/{results.total} propagated ({results.percentage})
              </span>
            </div>
          </div>

          <div className="bg-card border rounded-xl divide-y">
            {results.results.map(r => (
              <div key={r.resolver} className="flex items-start gap-4 p-4">
                <div className="mt-0.5">
                  {r.ok && r.values?.length > 0
                    ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                    : <XCircle className="h-5 w-5 text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium text-sm">{r.resolver}</span>
                    <span className="text-xs text-muted-foreground">({r.location})</span>
                  </div>
                  {r.error && <p className="text-xs text-destructive mt-1">{r.error}</p>}
                  {r.values && r.values.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {r.values.map((v, i) => (
                        <p key={i} className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded inline-block mr-1">{v}</p>
                      ))}
                    </div>
                  )}
                  {(!r.values || r.values.length === 0) && !r.error && (
                    <p className="text-xs text-muted-foreground mt-1">No records found</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
