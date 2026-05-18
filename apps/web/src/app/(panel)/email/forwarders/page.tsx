'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Plus, Trash2, Loader2, ArrowRight } from 'lucide-react'
import { mailApi } from '@/lib/api/mail.api'
import type { CreateForwarderRequest } from '@/types/mail.types'
import { toast } from 'sonner'
import Link from 'next/link'

export default function ForwardersPage() {
  const [showAdd, setShowAdd] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['forwarders'],
    queryFn: () => mailApi.listForwarders(),
    select: (r) => r.data,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mailApi.deleteForwarder(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['forwarders'] }); toast.success('Forwarder deleted') },
    onError: () => toast.error('Failed to delete forwarder'),
  })

  const forwarders = data?.forwarders ?? []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/email" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Email</Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-2xl font-bold">Forwarders</h1>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Add Forwarder
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : forwarders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Mail className="w-10 h-10 mb-2 opacity-30" />
            No forwarders configured
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Source</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Destinations</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {forwarders.map((f) => (
                <tr key={f.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group">
                  <td className="px-4 py-3 font-medium font-mono text-sm">{f.source}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {f.destinations.map((d) => (
                        <span key={d} className="flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded">
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />{d}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { if (confirm(`Delete forwarder ${f.source}?`)) deleteMutation.mutate(f.id) }} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AnimatePresence>
        {showAdd && <AddForwarderModal onClose={() => setShowAdd(false)} />}
      </AnimatePresence>
    </div>
  )
}

function AddForwarderModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [destinations, setDestinations] = useState('')
  const { register, handleSubmit } = useForm<{ source: string }>()

  const mutation = useMutation({
    mutationFn: (data: CreateForwarderRequest) => mailApi.createForwarder(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['forwarders'] }); toast.success('Forwarder created'); onClose() },
    onError: () => toast.error('Failed to create forwarder'),
  })

  const onSubmit = (d: { source: string }) => {
    const dest = destinations.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)
    mutation.mutate({ source: d.source, destinations: dest })
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-4 border-b border-border"><h2 className="font-semibold">Add Email Forwarder</h2></div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Source Address</label>
            <input {...register('source', { required: true })} placeholder="info@example.com" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Destinations (one per line or comma-separated)</label>
            <textarea value={destinations} onChange={(e) => setDestinations(e.target.value)} rows={3} placeholder={"admin@example.com\nbackup@gmail.com"} className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 transition-colors">{mutation.isPending ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
