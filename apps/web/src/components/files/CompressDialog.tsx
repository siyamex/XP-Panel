'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Archive, X, Loader2 } from 'lucide-react'
import { filesApi } from '@/lib/api/files.api'
import { toast } from 'sonner'

interface Props {
  paths: string[]
  currentPath: string
  onClose: () => void
  onSuccess: () => void
}

type Format = 'zip' | 'tar.gz' | 'tar' | 'gz' | 'bz2'

const FORMATS: { value: Format; label: string; desc: string }[] = [
  { value: 'zip', label: 'ZIP', desc: 'Universal, Windows-compatible' },
  { value: 'tar.gz', label: 'TAR.GZ', desc: 'Linux standard, compressed' },
  { value: 'tar', label: 'TAR', desc: 'Linux standard, uncompressed' },
  { value: 'gz', label: 'GZ', desc: 'Single file gzip compression' },
  { value: 'bz2', label: 'BZ2', desc: 'Better compression, slower' },
]

export function CompressDialog({ paths, currentPath, onClose, onSuccess }: Props) {
  const defaultName = paths.length === 1
    ? paths[0].split('/').pop() ?? 'archive'
    : 'archive'

  const [format, setFormat] = useState<Format>('zip')
  const [name, setName] = useState(defaultName)
  const [loading, setLoading] = useState(false)

  const outputPath = (currentPath.endsWith('/') ? currentPath : currentPath + '/') + name + '.' + format

  const handleCompress = async () => {
    if (!name.trim()) { toast.error('Enter output filename'); return }
    setLoading(true)
    try {
      await filesApi.compress(paths, outputPath, format)
      toast.success(`Compressed to ${name}.${format}`)
      onSuccess()
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Compression failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold">Compress Files</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-sm text-muted-foreground">
            Compressing <span className="font-medium text-foreground">{paths.length}</span> item(s)
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Output filename</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="archive"
              className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Format</label>
            <div className="grid grid-cols-2 gap-1.5">
              {FORMATS.map(f => (
                <button key={f.value} onClick={() => setFormat(f.value)}
                  className={`text-left px-3 py-2 rounded-md border text-sm transition-colors ${
                    format === f.value ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50 hover:bg-muted'
                  }`}>
                  <span className="font-bold">.{f.value}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">{f.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-md font-mono truncate">
            → {outputPath}
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">
              Cancel
            </button>
            <button onClick={handleCompress} disabled={loading || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Compressing…' : 'Compress'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
