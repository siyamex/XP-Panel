'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Download, Edit3, Loader2, ZoomIn, ZoomOut, RotateCw } from 'lucide-react'
import { filesApi, type FileInfo } from '@/lib/api/files.api'
import { formatBytes } from '@/lib/utils/format'

interface Props {
  file: FileInfo
  onClose: () => void
  onEdit: () => void
}

function getPreviewType(file: FileInfo): 'image' | 'text' | 'html' | 'unsupported' {
  const ext = (file.extension ?? '').toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(ext)) return 'image'
  if (['html', 'htm'].includes(ext)) return 'html'
  if (['txt', 'md', 'log', 'csv', 'json', 'yaml', 'yml', 'xml', 'env', 'conf', 'ini',
    'js', 'ts', 'tsx', 'jsx', 'go', 'py', 'php', 'sh', 'bash', 'sql'].includes(ext)
    || file.name.startsWith('.')) return 'text'
  return 'unsupported'
}

function ImagePreview({ src }: { src: string }) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  return (
    <div className="flex flex-col items-center gap-3 h-full">
      <div className="flex items-center gap-2">
        <button onClick={() => setZoom(z => Math.max(0.1, z - 0.25))} className="p-1.5 rounded hover:bg-muted transition-colors"><ZoomOut className="w-4 h-4" /></button>
        <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(5, z + 0.25))} className="p-1.5 rounded hover:bg-muted transition-colors"><ZoomIn className="w-4 h-4" /></button>
        <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-1.5 rounded hover:bg-muted transition-colors"><RotateCw className="w-4 h-4" /></button>
        <button onClick={() => { setZoom(1); setRotation(0) }} className="text-xs px-2 py-1 rounded hover:bg-muted transition-colors text-muted-foreground">Reset</button>
      </div>
      <div className="flex-1 overflow-auto flex items-center justify-center bg-checkerboard rounded-lg w-full">
        <img
          src={src}
          alt="preview"
          style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, transition: 'transform 0.2s', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          className="rounded"
        />
      </div>
    </div>
  )
}

function TextPreview({ content, ext }: { content: string; ext: string }) {
  return (
    <pre className="h-full overflow-auto bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm p-4 rounded-lg leading-relaxed whitespace-pre-wrap break-words">
      <code>{content}</code>
    </pre>
  )
}

function HtmlPreview({ content }: { content: string }) {
  const blob = new Blob([content], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  return (
    <iframe
      src={url}
      className="w-full h-full rounded-lg border border-border bg-white"
      sandbox="allow-scripts"
      title="HTML Preview"
    />
  )
}

export function PreviewModal({ file, onClose, onEdit }: Props) {
  const previewType = getPreviewType(file)
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(previewType === 'text' || previewType === 'html')

  useEffect(() => {
    if (previewType === 'text' || previewType === 'html') {
      filesApi.read(file.path)
        .then(r => setContent(r.data.content))
        .catch(() => setContent('Failed to load file content.'))
        .finally(() => setLoading(false))
    }
  }, [file.path, previewType])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const downloadUrl = filesApi.downloadUrl(file.path)
  const imageUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/files/download?path=${encodeURIComponent(file.path)}`

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-card border border-border rounded-xl shadow-2xl flex flex-col"
        style={{ width: '90vw', maxWidth: '1100px', height: '85vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-medium truncate">{file.name}</span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">
              {file.is_dir ? 'DIR' : (file.extension?.toUpperCase() || 'FILE')}
            </span>
            {!file.is_dir && (
              <span className="text-xs text-muted-foreground shrink-0">{formatBytes(file.size)}</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {(previewType === 'text' || previewType === 'html') && (
              <button onClick={onEdit} className="flex items-center gap-1.5 h-7 px-2.5 rounded text-xs border border-border hover:bg-muted transition-colors">
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
            )}
            <a href={downloadUrl} download={file.name}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded text-xs border border-border hover:bg-muted transition-colors">
              <Download className="w-3.5 h-3.5" /> Download
            </a>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-muted transition-colors ml-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : previewType === 'image' ? (
            <ImagePreview src={imageUrl} />
          ) : previewType === 'html' && content !== null ? (
            <HtmlPreview content={content} />
          ) : previewType === 'text' && content !== null ? (
            <TextPreview content={content} ext={file.extension ?? ''} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
              <p>No preview available for this file type.</p>
              <a href={downloadUrl} download={file.name}
                className="flex items-center gap-2 px-4 py-2 rounded-md border border-border hover:bg-muted transition-colors text-sm">
                <Download className="w-4 h-4" /> Download file
              </a>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
