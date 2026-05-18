'use client'

import {
  Folder, FileText, FileCode, FileImage, FileArchive,
  FileAudio, FileVideo, File, Loader2,
} from 'lucide-react'
import { type FileInfo } from '@/lib/api/files.api'
import { formatBytes, formatRelative } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

interface Props {
  files: FileInfo[]
  currentPath: string
  selected: string[]
  isLoading: boolean
  error?: string
  onSelect: (paths: string[]) => void
  onOpen: (file: FileInfo) => void
  onNavigate: (path: string) => void
}

function FileIcon({ file }: { file: FileInfo }) {
  if (file.is_dir) return <Folder className="w-5 h-5 text-amber-400 shrink-0" />

  const ext = (file.extension ?? '').toLowerCase()
  if (['ts', 'tsx', 'js', 'jsx', 'go', 'py', 'php', 'rb', 'rs', 'java', 'c', 'cpp', 'h'].includes(ext))
    return <FileCode className="w-5 h-5 text-blue-400 shrink-0" />
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext))
    return <FileImage className="w-5 h-5 text-green-400 shrink-0" />
  if (['zip', 'tar', 'gz', 'bz2', 'rar', '7z'].includes(ext))
    return <FileArchive className="w-5 h-5 text-purple-400 shrink-0" />
  if (['mp3', 'wav', 'ogg', 'flac'].includes(ext))
    return <FileAudio className="w-5 h-5 text-pink-400 shrink-0" />
  if (['mp4', 'webm', 'mov', 'avi'].includes(ext))
    return <FileVideo className="w-5 h-5 text-rose-400 shrink-0" />
  if (['txt', 'md', 'log', 'csv', 'json', 'yaml', 'yml', 'xml', 'html', 'css', 'env', 'conf', 'ini'].includes(ext))
    return <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
  return <File className="w-5 h-5 text-muted-foreground shrink-0" />
}

export function FileList({ files, selected, isLoading, error, onSelect, onOpen }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-40 text-destructive text-sm">
        {error}
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm">
        <Folder className="w-10 h-10 mb-2 opacity-30" />
        Empty directory
      </div>
    )
  }

  const toggleSelect = (path: string, multi: boolean) => {
    if (multi) {
      onSelect(selected.includes(path) ? selected.filter((p) => p !== path) : [...selected, path])
    } else {
      onSelect(selected.includes(path) && selected.length === 1 ? [] : [path])
    }
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left">
          <th className="px-4 py-2 font-medium text-muted-foreground w-8">
            <input
              type="checkbox"
              checked={selected.length === files.length && files.length > 0}
              onChange={(e) => onSelect(e.target.checked ? files.map((f) => f.path) : [])}
              className="rounded border-border"
            />
          </th>
          <th className="px-4 py-2 font-medium text-muted-foreground">Name</th>
          <th className="px-4 py-2 font-medium text-muted-foreground w-24">Size</th>
          <th className="px-4 py-2 font-medium text-muted-foreground w-36">Modified</th>
          <th className="px-4 py-2 font-medium text-muted-foreground w-24">Mode</th>
        </tr>
      </thead>
      <tbody>
        {files.map((file) => (
          <tr
            key={file.path}
            onClick={(e) => toggleSelect(file.path, e.ctrlKey || e.metaKey)}
            onDoubleClick={() => onOpen(file)}
            className={cn(
              'border-b border-border last:border-0 cursor-pointer transition-colors',
              selected.includes(file.path) ? 'bg-primary/10' : 'hover:bg-muted/30'
            )}
          >
            <td className="px-4 py-2.5">
              <input
                type="checkbox"
                checked={selected.includes(file.path)}
                onChange={(e) => {
                  e.stopPropagation()
                  toggleSelect(file.path, e.shiftKey)
                }}
                onClick={(e) => e.stopPropagation()}
                className="rounded border-border"
              />
            </td>
            <td className="px-4 py-2.5">
              <div className="flex items-center gap-2">
                <FileIcon file={file} />
                <span className={cn('truncate', file.is_dir && 'font-medium')}>{file.name}</span>
              </div>
            </td>
            <td className="px-4 py-2.5 text-muted-foreground">
              {file.is_dir ? '—' : formatBytes(file.size)}
            </td>
            <td className="px-4 py-2.5 text-muted-foreground">
              {formatRelative(file.modified_at)}
            </td>
            <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
              {file.mode}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
