'use client'

import { useRef, useState } from 'react'
import {
  Folder, FileText, FileCode, FileImage, FileArchive,
  FileAudio, FileVideo, File, Loader2, ChevronUp, ChevronDown, ChevronsUpDown, Search,
} from 'lucide-react'
import { type FileInfo } from '@/lib/api/files.api'
import { type SortKey, type SortDir } from './FileExplorer'
import { formatBytes, formatRelative } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

interface Props {
  files: FileInfo[]
  currentPath: string
  selected: string[]
  isLoading: boolean
  error?: string
  sortKey: SortKey
  sortDir: SortDir
  renaming: string | null
  isSearching: boolean
  onSelect: (paths: string[]) => void
  onOpen: (file: FileInfo) => void
  onNavigate: (path: string) => void
  onContextMenu: (e: React.MouseEvent, file: FileInfo | null) => void
  onSort: (key: SortKey) => void
  onRenameSubmit: (oldPath: string, newName: string) => void
}

export function FileIcon({ file, size = 'md' }: { file: FileInfo; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
  if (file.is_dir) return <Folder className={cn(sz, 'text-amber-400 shrink-0')} />
  const ext = (file.extension ?? '').toLowerCase()
  if (['ts', 'tsx', 'js', 'jsx', 'go', 'py', 'php', 'rb', 'rs', 'java', 'c', 'cpp', 'h', 'sh', 'bash'].includes(ext))
    return <FileCode className={cn(sz, 'text-blue-400 shrink-0')} />
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(ext))
    return <FileImage className={cn(sz, 'text-green-400 shrink-0')} />
  if (['zip', 'tar', 'gz', 'bz2', 'rar', '7z', 'xz'].includes(ext))
    return <FileArchive className={cn(sz, 'text-purple-400 shrink-0')} />
  if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext))
    return <FileAudio className={cn(sz, 'text-pink-400 shrink-0')} />
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext))
    return <FileVideo className={cn(sz, 'text-rose-400 shrink-0')} />
  if (['txt', 'md', 'log', 'csv', 'json', 'yaml', 'yml', 'xml', 'html', 'htm', 'css', 'env', 'conf', 'ini', 'htaccess'].includes(ext)
    || file.name.startsWith('.'))
    return <FileText className={cn(sz, 'text-muted-foreground shrink-0')} />
  return <File className={cn(sz, 'text-muted-foreground shrink-0')} />
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 text-muted-foreground/40 ml-1 inline" />
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 text-primary ml-1 inline" />
    : <ChevronDown className="w-3 h-3 text-primary ml-1 inline" />
}

function RenameInput({ path, initialName, onSubmit }: { path: string; initialName: string; onSubmit: (oldPath: string, name: string) => void }) {
  const [val, setVal] = useState(initialName)
  const ref = useRef<HTMLInputElement>(null)
  return (
    <input
      ref={ref}
      autoFocus
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => onSubmit(path, val)}
      onKeyDown={e => {
        if (e.key === 'Enter') onSubmit(path, val)
        if (e.key === 'Escape') onSubmit(path, initialName)
        e.stopPropagation()
      }}
      onClick={e => e.stopPropagation()}
      className="flex-1 bg-primary/10 border border-primary rounded px-1 text-sm focus:outline-none min-w-0"
    />
  )
}

export function FileList({
  files, selected, isLoading, error, sortKey, sortDir, renaming, isSearching,
  onSelect, onOpen, onContextMenu, onSort, onRenameSubmit,
}: Props) {
  const lastClickRef = useRef<string | null>(null)

  const toggleSelect = (path: string, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickRef.current) {
      const paths = files.map(f => f.path)
      const a = paths.indexOf(lastClickRef.current)
      const b = paths.indexOf(path)
      const range = paths.slice(Math.min(a, b), Math.max(a, b) + 1)
      onSelect([...new Set([...selected, ...range])])
    } else if (e.ctrlKey || e.metaKey) {
      onSelect(selected.includes(path) ? selected.filter(p => p !== path) : [...selected, path])
    } else {
      onSelect(selected.includes(path) && selected.length === 1 ? [] : [path])
    }
    lastClickRef.current = path
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center h-48 text-destructive text-sm">{error}</div>
  )

  if (files.length === 0) return (
    <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm gap-2">
      {isSearching ? <Search className="w-10 h-10 opacity-20" /> : <Folder className="w-10 h-10 opacity-20" />}
      {isSearching ? 'No files match your search' : 'Empty directory'}
    </div>
  )

  const col = (key: SortKey, label: string, cls = '') => (
    <th
      className={cn('px-4 py-2.5 font-medium text-muted-foreground text-left cursor-pointer select-none hover:text-foreground transition-colors', cls)}
      onClick={() => onSort(key)}
    >
      {label}<SortIcon col={key} sortKey={sortKey} sortDir={sortDir} />
    </th>
  )

  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 z-10">
        <tr className="border-b border-border bg-muted/40 backdrop-blur-sm">
          <th className="px-4 py-2.5 w-8">
            <input
              type="checkbox"
              checked={selected.length === files.length && files.length > 0}
              onChange={e => onSelect(e.target.checked ? files.map(f => f.path) : [])}
              className="rounded border-border cursor-pointer"
            />
          </th>
          {col('name', 'Name')}
          {col('size', 'Size', 'w-28')}
          {col('extension', 'Type', 'w-20')}
          {col('modified_at', 'Modified', 'w-36')}
          <th className="px-4 py-2.5 font-medium text-muted-foreground w-24">Permissions</th>
        </tr>
      </thead>
      <tbody>
        {files.map(file => (
          <tr
            key={file.path}
            onClick={e => toggleSelect(file.path, e)}
            onDoubleClick={() => onOpen(file)}
            onContextMenu={e => { e.preventDefault(); if (!selected.includes(file.path)) onSelect([file.path]); onContextMenu(e, file) }}
            draggable
            className={cn(
              'border-b border-border last:border-0 cursor-pointer transition-colors group select-none',
              selected.includes(file.path) ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-muted/30'
            )}
          >
            <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={selected.includes(file.path)}
                onChange={e => { const ev = e.nativeEvent as MouseEvent; toggleSelect(file.path, { shiftKey: ev.shiftKey, ctrlKey: true, metaKey: true } as React.MouseEvent) }}
                className="rounded border-border cursor-pointer"
              />
            </td>
            <td className="px-4 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <FileIcon file={file} />
                {renaming === file.path ? (
                  <RenameInput path={file.path} initialName={file.name} onSubmit={onRenameSubmit} />
                ) : (
                  <span className={cn('truncate', file.is_dir && 'font-medium')} title={file.name}>
                    {file.name}
                    {isSearching && (
                      <span className="ml-2 text-xs text-muted-foreground font-normal">
                        {file.path.split('/').slice(0, -1).join('/') || '/'}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </td>
            <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
              {file.is_dir ? '—' : formatBytes(file.size)}
            </td>
            <td className="px-4 py-2.5 text-muted-foreground uppercase text-xs tracking-wide">
              {file.is_dir ? 'DIR' : (file.extension?.toUpperCase() || '—')}
            </td>
            <td className="px-4 py-2.5 text-muted-foreground text-xs">
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
