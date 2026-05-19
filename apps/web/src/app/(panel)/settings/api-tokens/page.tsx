'use client'

import { useState } from 'react'
import { Plus, Copy, Trash2, Key, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'

interface ApiToken {
  id: string
  name: string
  token: string
  permissions: string[]
  last_used: Date | null
  created_at: Date
  expires_at: Date | null
}

const MOCK_TOKENS: ApiToken[] = [
  { id: '1', name: 'CI/CD Pipeline', token: 'xp_live_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890', permissions: ['domains:read', 'backups:write'], last_used: new Date(Date.now() - 3600000), created_at: new Date(Date.now() - 86400000 * 7), expires_at: null },
  { id: '2', name: 'Monitoring Bot', token: 'xp_live_ZyXwVuTsRqPoNmLkJiHgFeDcBa0987654321', permissions: ['monitoring:read'], last_used: new Date(Date.now() - 300000), created_at: new Date(Date.now() - 86400000 * 14), expires_at: new Date(Date.now() + 86400000 * 30) },
]

const ALL_PERMISSIONS = ['domains:read', 'domains:write', 'dns:read', 'dns:write', 'mail:read', 'mail:write', 'files:read', 'files:write', 'db:read', 'db:write', 'backup:read', 'backup:write', 'monitoring:read', 'security:read']

export default function ApiTokensPage() {
  const [tokens, setTokens] = useState(MOCK_TOKENS)
  const [showCreate, setShowCreate] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [selectedPerms, setSelectedPerms] = useState<string[]>([])
  const [visibleTokens, setVisibleTokens] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState<string | null>(null)

  const handleCreate = () => {
    if (!name) return
    const token = 'xp_live_' + Math.random().toString(36).slice(2).padEnd(32, '0')
    const created: ApiToken = { id: Date.now().toString(), name, token, permissions: selectedPerms, last_used: null, created_at: new Date(), expires_at: null }
    setTokens(t => [created, ...t])
    setNewToken(token)
    setShowCreate(false)
    setName('')
    setSelectedPerms([])
  }

  const handleDelete = (id: string) => setTokens(t => t.filter(x => x.id !== id))

  const copyToken = (token: string, id: string) => {
    void navigator.clipboard.writeText(token)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const toggleVisibility = (id: string) => {
    setVisibleTokens(v => { const n = new Set(v); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const maskToken = (token: string) => token.slice(0, 10) + '•'.repeat(20) + token.slice(-4)

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">API Tokens</h1>
          <p className="text-muted-foreground text-sm mt-1">Create tokens for programmatic API access</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 h-9 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />New Token
        </button>
      </div>

      {/* New token reveal */}
      <AnimatePresence>
        {newToken && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium text-sm">
              <CheckCircle2 className="h-4 w-4" />Token created — copy it now, you won't see it again
            </div>
            <div className="flex items-center gap-2 bg-background rounded-md border px-3 py-2">
              <code className="flex-1 text-xs font-mono break-all">{newToken}</code>
              <button onClick={() => copyToken(newToken, 'new')} className="shrink-0 text-muted-foreground hover:text-foreground">
                {copied === 'new' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <button onClick={() => setNewToken(null)} className="text-xs text-muted-foreground hover:underline">Dismiss</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tokens list */}
      <div className="bg-card border rounded-xl divide-y">
        {tokens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Key className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No API tokens yet</p>
            <button onClick={() => setShowCreate(true)} className="text-sm text-primary hover:underline">Create your first token</button>
          </div>
        ) : tokens.map(token => (
          <div key={token.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5 min-w-0">
                <p className="font-medium text-sm">{token.name}</p>
                <p className="text-xs text-muted-foreground">
                  Created {format(token.created_at, 'MMM d, yyyy')}
                  {token.last_used && ` · Last used ${format(token.last_used, 'MMM d, HH:mm')}`}
                  {token.expires_at && ` · Expires ${format(token.expires_at, 'MMM d, yyyy')}`}
                </p>
              </div>
              <button onClick={() => handleDelete(token.id)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
              <code className="flex-1 text-xs font-mono truncate">
                {visibleTokens.has(token.id) ? token.token : maskToken(token.token)}
              </code>
              <button onClick={() => toggleVisibility(token.id)} className="text-muted-foreground hover:text-foreground shrink-0">
                {visibleTokens.has(token.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              <button onClick={() => copyToken(token.token, token.id)} className="text-muted-foreground hover:text-foreground shrink-0">
                {copied === token.id ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>

            <div className="flex flex-wrap gap-1">
              {token.permissions.map(p => (
                <span key={p} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">{p}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-card border rounded-xl p-6 w-full max-w-md space-y-5">
              <h3 className="font-semibold text-lg">Create API Token</h3>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Token Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. CI/CD Pipeline"
                  className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Permissions</label>
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                  {ALL_PERMISSIONS.map(perm => (
                    <label key={perm} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={selectedPerms.includes(perm)}
                        onChange={e => setSelectedPerms(p => e.target.checked ? [...p, perm] : p.filter(x => x !== perm))}
                        className="rounded border" />
                      <span className="text-xs font-mono">{perm}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowCreate(false)} className="flex-1 h-9 border rounded-md text-sm hover:bg-muted transition-colors">Cancel</button>
                <button onClick={handleCreate} disabled={!name}
                  className="flex-1 h-9 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  Create Token
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
