'use client'

import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Upload, X, File, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { filesApi } from '@/lib/api/files.api'
import { formatBytes } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

interface Props {
  currentPath: string
  onClose: () => void
}

interface FileState {
  file: File
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

export function FileUpload({ currentPath, onClose }: Props) {
  const [files, setFiles] = useState<FileState[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((newFiles: File[]) => {
    setFiles((prev) => [
      ...prev,
      ...newFiles.map((f) => ({ file: f, status: 'pending' as const })),
    ])
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    addFiles(droppedFiles)
  }, [addFiles])

  const upload = async () => {
    if (files.length === 0) return
    setUploading(true)

    // Create a FileList-like object from the pending files
    const pendingFiles = files.filter((f) => f.status === 'pending').map((f) => f.file)

    // Upload in batches of 5
    const batchSize = 5
    for (let i = 0; i < pendingFiles.length; i += batchSize) {
      const batch = pendingFiles.slice(i, i + batchSize)
      const dt = new DataTransfer()
      batch.forEach((f) => dt.items.add(f))

      try {
        setFiles((prev) =>
          prev.map((f) =>
            batch.includes(f.file) ? { ...f, status: 'uploading' } : f
          )
        )
        await filesApi.upload(currentPath, dt.files)
        setFiles((prev) =>
          prev.map((f) =>
            batch.includes(f.file) ? { ...f, status: 'done' } : f
          )
        )
      } catch {
        setFiles((prev) =>
          prev.map((f) =>
            batch.includes(f.file) ? { ...f, status: 'error', error: 'Upload failed' } : f
          )
        )
      }
    }

    setUploading(false)
  }

  const allDone = files.length > 0 && files.every((f) => f.status === 'done' || f.status === 'error')
  const pendingCount = files.filter((f) => f.status === 'pending').length

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-base">Upload Files</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
            )}
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">Drop files here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">Uploading to: {currentPath}</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && addFiles(Array.from(e.target.files))}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted/30 text-sm">
                  {f.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />}
                  {f.status === 'done' && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                  {f.status === 'error' && <XCircle className="w-4 h-4 text-destructive shrink-0" />}
                  {f.status === 'pending' && <File className="w-4 h-4 text-muted-foreground shrink-0" />}
                  <span className="flex-1 truncate">{f.file.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{formatBytes(f.file.size)}</span>
                  {f.status === 'error' && (
                    <span className="text-xs text-destructive shrink-0">{f.error}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={allDone ? onClose : () => setFiles([])}
              className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors"
            >
              {allDone ? 'Done' : 'Clear'}
            </button>
            {!allDone && (
              <button
                onClick={upload}
                disabled={uploading || pendingCount === 0}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {uploading ? 'Uploading...' : `Upload ${pendingCount} file${pendingCount !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
