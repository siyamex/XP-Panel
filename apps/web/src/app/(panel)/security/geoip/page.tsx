'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Globe, Plus, Trash2, Search, ShieldAlert, ShieldCheck } from 'lucide-react'
import { securityApi } from '@/lib/api/security.api'
import { toast } from 'sonner'

// ISO 3166-1 alpha-2 — common countries for quick selection
const COMMON_COUNTRIES = [
  { code: 'CN', name: 'China' },
  { code: 'RU', name: 'Russia' },
  { code: 'KP', name: 'North Korea' },
  { code: 'IR', name: 'Iran' },
  { code: 'BY', name: 'Belarus' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'BR', name: 'Brazil' },
  { code: 'IN', name: 'India' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'TR', name: 'Turkey' },
]

export default function GeoIPBlockingPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [lookupIP, setLookupIP] = useState('')
  const [lookupResult, setLookupResult] = useState<{ country_code: string; country_name: string; city: string; org: string } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['geoip-blocks'],
    queryFn: () => securityApi.listGeoIPBlocks().then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: (d: { country_code: string; country_name: string }) =>
      securityApi.addGeoIPBlock({ ...d, action: 'block' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['geoip-blocks'] })
      toast.success('Country blocked')
    },
    onError: () => toast.error('Failed to block country'),
  })

  const removeMutation = useMutation({
    mutationFn: (code: string) => securityApi.removeGeoIPBlock(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['geoip-blocks'] })
      toast.success('Country unblocked')
    },
  })

  const handleLookup = async () => {
    if (!lookupIP.trim()) return
    try {
      const { data: r } = await securityApi.lookupGeoIP(lookupIP.trim())
      setLookupResult(r)
    } catch {
      toast.error('Lookup failed')
    }
  }

  const blockedCodes = new Set(data?.blocks.map(b => b.country_code) ?? [])

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">GeoIP Blocking</h1>
        <p className="text-muted-foreground text-sm mt-1">Block or monitor traffic from specific countries</p>
      </div>

      {/* IP Lookup */}
      <div className="bg-card border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-sm">IP Lookup</h2>
        <div className="flex gap-2">
          <input value={lookupIP} onChange={e => setLookupIP(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLookup()}
            placeholder="Enter IP address..." className="flex-1 border border-input rounded-lg px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <button onClick={handleLookup} className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm hover:bg-muted transition-colors">
            <Search className="h-3.5 w-3.5" />Lookup
          </button>
        </div>
        {lookupResult && (
          <div className="text-sm bg-muted/50 rounded-lg p-3 flex items-center justify-between">
            <div>
              <span className="font-medium">{lookupResult.country_name} ({lookupResult.country_code})</span>
              <span className="text-muted-foreground ml-2">— {lookupResult.city}</span>
              {lookupResult.org && <p className="text-xs text-muted-foreground mt-0.5">{lookupResult.org}</p>}
            </div>
            {!blockedCodes.has(lookupResult.country_code) && (
              <button onClick={() => addMutation.mutate({ country_code: lookupResult.country_code, country_name: lookupResult.country_name })}
                className="flex items-center gap-1 px-2.5 py-1 bg-destructive text-destructive-foreground rounded text-xs hover:bg-destructive/90">
                <ShieldAlert className="h-3 w-3" />Block
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quick Add */}
      <div className="bg-card border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-sm">Quick Block</h2>
        <div className="flex flex-wrap gap-2">
          {COMMON_COUNTRIES.map(c => (
            <button
              key={c.code}
              onClick={() => blockedCodes.has(c.code) ? removeMutation.mutate(c.code) : addMutation.mutate({ country_code: c.code, country_name: c.name })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                blockedCodes.has(c.code)
                  ? 'bg-destructive/10 border-destructive/30 text-destructive'
                  : 'border-border hover:bg-muted'
              }`}
            >
              {blockedCodes.has(c.code) ? <ShieldAlert className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Active blocks */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-sm">Active Blocks ({data?.total ?? 0})</h2>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter..."
            className="border border-input rounded-md px-2.5 py-1 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring w-32" />
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : data?.blocks.length === 0 ? (
          <div className="p-8 text-center">
            <ShieldCheck className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No countries blocked</p>
          </div>
        ) : (
          <div className="divide-y">
            {data?.blocks
              .filter(b => !search || b.country_name.toLowerCase().includes(search.toLowerCase()) || b.country_code.includes(search.toUpperCase()))
              .map(b => (
                <div key={b.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{b.country_name}</p>
                      <p className="text-xs text-muted-foreground">{b.country_code} · {b.action}</p>
                    </div>
                  </div>
                  <button onClick={() => removeMutation.mutate(b.country_code)}
                    className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Custom add */}
      <div className="bg-card border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-sm">Add Custom Country</h2>
        <CustomCountryAdd onAdd={d => addMutation.mutate(d)} blockedCodes={blockedCodes} />
      </div>
    </div>
  )
}

function CustomCountryAdd({ onAdd, blockedCodes }: { onAdd: (d: { country_code: string; country_name: string }) => void; blockedCodes: Set<string> }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  return (
    <div className="flex gap-2">
      <input value={code} onChange={e => setCode(e.target.value.toUpperCase().slice(0, 2))} placeholder="XX" maxLength={2}
        className="w-16 border border-input rounded-lg px-3 py-2 bg-background text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-ring" />
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Country name"
        className="flex-1 border border-input rounded-lg px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      <button
        onClick={() => { if (code.length === 2 && name) { onAdd({ country_code: code, country_name: name }); setCode(''); setName('') } }}
        disabled={code.length !== 2 || !name || blockedCodes.has(code)}
        className="flex items-center gap-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors">
        <Plus className="h-3.5 w-3.5" />Block
      </button>
    </div>
  )
}
