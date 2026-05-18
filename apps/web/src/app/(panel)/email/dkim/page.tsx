'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { Key, Plus, Trash2, Loader2, Copy, RefreshCw, CheckCircle2 } from 'lucide-react'
import { mailApi } from '@/lib/api/mail.api'
import { toast } from 'sonner'
import Link from 'next/link'

export default function DKIMPage() {
  const [showAdd, setShowAdd] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['dkim'],
    queryFn: () => mailApi.listDKIM(),
    select: (r) => r.data,
  })

  const deleteMutation = useMutation({
    mutationFn: (domain: string) => mailApi.deleteDKIM(domain),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dkim'] }); toast.success('DKIM key deleted') },
    onError: () => toast.error('Failed to delete DKIM key'),
  })

  const regenMutation = useMutation({
    mutationFn: (domain: string) => mailApi.generateDKIM(domain),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dkim'] }); toast.success('DKIM key regenerated') },
    onError: () => toast.error('Failed to regenerate DKIM key'),
  })

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
    toast.success('Copied to clipboard')
  }

  const keys = data?.keys ?? []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/email" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Email</Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-2xl font-bold">DKIM Keys</h1>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Generate Key
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">What is DKIM?</p>
        DomainKeys Identified Mail (DKIM) adds a digital signature to outgoing emails. Add the DNS TXT record below to your domain's DNS to improve email deliverability and prevent spoofing.
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : keys.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 bg-card border border-border rounded-xl text-muted-foreground">
          <Key className="w-10 h-10 mb-2 opacity-30" />
          No DKIM keys generated yet
        </div>
      ) : (
        <div className="space-y-4">
          {keys.map((k) => (
            <motion.div key={k.domain} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{k.domain}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Selector: <span className="font-mono">{k.selector}</span></p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => regenMutation.mutate(k.domain)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors">
                    <RefreshCw className="w-3 h-3" />Regenerate
                  </button>
                  <button onClick={() => { if (confirm(`Delete DKIM key for ${k.domain}?`)) deleteMutation.mutate(k.domain) }} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-muted-foreground">DNS Record Name</p>
                  <button onClick={() => copyToClipboard(`${k.selector}._domainkey.${k.domain}`, k.domain + '-name')} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    {copied === k.domain + '-name' ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    Copy
                  </button>
                </div>
                <code className="block w-full text-xs bg-muted/50 border border-border rounded-md px-3 py-2 font-mono break-all">
                  {k.selector}._domainkey.{k.domain}
                </code>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-muted-foreground">DNS TXT Value</p>
                  <button onClick={() => copyToClipboard(k.dns_txt_value, k.domain + '-txt')} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    {copied === k.domain + '-txt' ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    Copy
                  </button>
                </div>
                <code className="block w-full text-xs bg-muted/50 border border-border rounded-md px-3 py-2 font-mono break-all leading-relaxed">
                  {k.dns_txt_value}
                </code>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showAdd && <GenerateDKIMModal onClose={() => setShowAdd(false)} />}
      </AnimatePresence>
    </div>
  )
}

function GenerateDKIMModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm<{ domain: string }>()

  const mutation = useMutation({
    mutationFn: (d: { domain: string }) => mailApi.generateDKIM(d.domain),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dkim'] }); toast.success('DKIM key generated'); onClose() },
    onError: () => toast.error('Failed to generate DKIM key'),
  })

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-4 border-b border-border"><h2 className="font-semibold">Generate DKIM Key</h2></div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Domain</label>
            <input {...register('domain', { required: true })} placeholder="example.com" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <p className="text-xs text-muted-foreground">A 2048-bit RSA key pair will be generated. Add the provided DNS TXT record to activate DKIM signing.</p>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 transition-colors">{mutation.isPending ? 'Generating...' : 'Generate'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
