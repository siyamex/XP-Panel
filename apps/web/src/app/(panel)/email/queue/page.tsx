'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Inbox, Trash2, RefreshCw, AlertTriangle } from 'lucide-react'
import { mailQueueApi, type MailQueueEntry } from '@/lib/api/hosting.api'
import { toast } from 'sonner'

export default function MailQueuePage() {
  const qc = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['mail-queue'],
    queryFn: () => mailQueueApi.list().then(r => r.data),
    refetchInterval: 10000,
  })

  const flushMutation = useMutation({
    mutationFn: () => mailQueueApi.flush(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mail-queue'] }); toast.success('Mail queue flushed') },
    onError: () => toast.error('Flush failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mailQueueApi.deleteEntry(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mail-queue'] }); toast.success('Message removed') },
  })

  const deleteAllMutation = useMutation({
    mutationFn: () => mailQueueApi.deleteAll(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mail-queue'] }); toast.success('Mail queue cleared') },
    onError: () => toast.error('Failed to clear queue'),
  })

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mail Queue</h1>
          <p className="text-muted-foreground text-sm mt-1">View and manage the Postfix mail queue</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg hover:bg-muted transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />Refresh
          </button>
          <button onClick={() => flushMutation.mutate()} disabled={flushMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg hover:bg-muted transition-colors">
            <Inbox className="h-3.5 w-3.5" />Flush Queue
          </button>
          {(data?.total ?? 0) > 0 && (
            <button onClick={() => deleteAllMutation.mutate()} disabled={deleteAllMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-destructive/50 text-destructive rounded-lg hover:bg-destructive/10 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />Clear All
            </button>
          )}
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <span className="font-semibold text-sm">Queue ({data?.total ?? 0} messages)</span>
          {(data?.total ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-xs text-amber-500">
              <AlertTriangle className="h-3 w-3" />{data?.total} pending
            </span>
          )}
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : !data?.entries.length ? (
          <div className="p-8 text-center">
            <Inbox className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Mail queue is empty</p>
          </div>
        ) : (
          <div className="divide-y">
            <div className="grid grid-cols-[1fr_1fr_1fr_80px_40px] px-5 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/30">
              <span>Queue ID</span><span>Sender</span><span>Recipient</span><span>Size</span><span></span>
            </div>
            {data.entries.map((e: MailQueueEntry) => (
              <div key={e.id} className="grid grid-cols-[1fr_1fr_1fr_80px_40px] px-5 py-3 items-center text-sm">
                <span className="font-mono text-xs text-muted-foreground">{e.id}</span>
                <span className="truncate">{e.sender}</span>
                <span className="truncate text-muted-foreground">{e.rcpt}</span>
                <span className="text-xs text-muted-foreground">{e.size}</span>
                <button onClick={() => deleteMutation.mutate(e.id)} className="text-muted-foreground hover:text-destructive transition-colors justify-self-end">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
