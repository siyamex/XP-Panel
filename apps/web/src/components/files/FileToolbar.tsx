'use client'

import { useRef, useState } from 'react'
import {
  ChevronLeft, Home, RefreshCw, FolderPlus, Upload, Trash2,
  Copy, Scissors, ClipboardPaste, Archive, Download, Search, X,
  FilePlus, Eye, EyeOff, Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface Props {
  currentPath: string
  selectedCount: number
  hasClipboard: boolean
  showHidden: boolean
  searchQuery: string
  onNavigate: (path: string) => void
  onDelete: () => void
  onNewFolder: () => void
  onNewFile: () => void
  onUpload: () => void
  onRefresh: () => void
  onToggleHidden: () => void
  onSearch: (q: string) => void
  onPaste: () => void
  onCopy: () => void
  onCut: () => void
  onDownload: () => void
  onCompress: () => void
}

function Breadcrumb({ path, onNavigate }: { path: string; onNavigate: (p: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(path)
  const inputRef = useRef<HTMLInputElement>(null)

  const parts = path.split('/').filter(Boolean)

  const commit = (val: string) => {
    const clean = val.startsWith('/') ? val : '/' + val
    onNavigate(clean || '/')
    setEditing(false)
  }

  if (editing) return (
    <input
      ref={inputRef}
      autoFocus
      value={editVal}
      onChange={e => setEditVal(e.target.value)}
      onBlur={() => commit(editVal)}
      onKeyDown={e => { if (e.key === 'Enter') commit(editVal); if (e.key === 'Escape') setEditing(false) }}
      className="flex-1 bg-transparent text-sm font-mono focus:outline-none px-1"
    />
  )

  return (
    <div
      className="flex items-center gap-0.5 text-sm min-w-0 overflow-x-auto cursor-text"
      onClick={() => { setEditVal(path); setEditing(true) }}
    >
      <button
        onClick={e => { e.stopPropagation(); onNavigate('/') }}
        className="shrink-0 hover:text-primary transition-colors text-muted-foreground p-0.5 rounded hover:bg-muted"
      >
        <Home className="w-3.5 h-3.5" />
      </button>
      {parts.map((part, i) => {
        const partPath = '/' + parts.slice(0, i + 1).join('/')
        const isLast = i === parts.length - 1
        return (
          <span key={partPath} className="flex items-center gap-0.5 shrink-0">
            <span className="text-muted-foreground/50 mx-0.5">/</span>
            <button
              onClick={e => { e.stopPropagation(); if (!isLast) onNavigate(partPath) }}
              className={cn(
                'px-0.5 rounded transition-colors',
                isLast ? 'text-foreground font-medium cursor-default' : 'text-muted-foreground hover:text-primary hover:bg-muted'
              )}
            >
              {part}
            </button>
          </span>
        )
      })}
      {parts.length === 0 && <span className="text-muted-foreground text-sm">root</span>}
    </div>
  )
}

export function FileToolbar({
  currentPath, selectedCount, hasClipboard, showHidden, searchQuery,
  onNavigate, onDelete, onNewFolder, onNewFile, onUpload, onRefresh,
  onToggleHidden, onSearch, onPaste, onCopy, onCut, onDownload, onCompress,
}: Props) {
  const [showSearch, setShowSearch] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const goUp = () => {
    const parts = currentPath.split('/').filter(Boolean)
    onNavigate(parts.length === 0 ? '/' : '/' + parts.slice(0, -1).join('/') || '/')
  }

  const QUICK = [
    { label: 'public_html', path: '/public_html' },
    { label: '.htaccess', path: '/.htaccess' },
    { label: 'logs', path: '/logs' },
  ]

  return (
    <div className="flex flex-col border-b border-border bg-muted/10">
      {/* Row 1: navigation + path */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={goUp} disabled={currentPath === '/'} title="Go up"
          className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-30 shrink-0">
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0 bg-background border border-border rounded-md px-2 py-1.5 flex items-center gap-2">
          {showSearch ? (
            <div className="flex items-center gap-1 flex-1">
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                ref={searchRef}
                autoFocus
                value={searchQuery}
                onChange={e => onSearch(e.target.value)}
                placeholder="Search files..."
                className="flex-1 bg-transparent text-sm focus:outline-none"
              />
              {searchQuery && (
                <button onClick={() => { onSearch(''); searchRef.current?.focus() }} className="shrink-0">
                  <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
              <button onClick={() => { setShowSearch(false); onSearch('') }} className="shrink-0 text-xs text-muted-foreground hover:text-foreground ml-1">
                Cancel
              </button>
            </div>
          ) : (
            <Breadcrumb path={currentPath} onNavigate={onNavigate} />
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => { setShowSearch(v => !v); if (!showSearch) setTimeout(() => searchRef.current?.focus(), 50) }}
            title="Search" className={cn('p-1.5 rounded hover:bg-muted transition-colors', showSearch && 'bg-primary/10 text-primary')}>
            <Search className="w-4 h-4" />
          </button>
          <button onClick={onRefresh} title="Refresh" className="p-1.5 rounded hover:bg-muted transition-colors">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={onToggleHidden} title={showHidden ? 'Hide hidden files' : 'Show hidden files'}
            className={cn('p-1.5 rounded hover:bg-muted transition-colors', showHidden && 'text-primary')}>
            {showHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
          </button>

          <div className="w-px h-5 bg-border mx-0.5" />

          <button onClick={onNewFile} title="New file" className="p-1.5 rounded hover:bg-muted transition-colors">
            <FilePlus className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={onNewFolder} title="New folder" className="p-1.5 rounded hover:bg-muted transition-colors">
            <FolderPlus className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={onUpload}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
            <Upload className="w-3.5 h-3.5" /> Upload
          </button>
        </div>
      </div>

      {/* Row 2: bulk actions + quick links */}
      <div className="flex items-center gap-1 px-3 pb-1.5 justify-between">
        <div className="flex items-center gap-1">
          {/* Quick access */}
          <span className="text-xs text-muted-foreground mr-1">Quick:</span>
          {QUICK.map(q => (
            <button key={q.path} onClick={() => onNavigate(q.path)}
              className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground">
              {q.label}
            </button>
          ))}
        </div>

        {selectedCount > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">{selectedCount} selected</span>
            <div className="w-px h-4 bg-border mx-0.5" />
            <button onClick={onCopy} title="Copy" className="flex items-center gap-1 h-6 px-2 rounded text-xs hover:bg-muted transition-colors">
              <Copy className="w-3 h-3" /> Copy
            </button>
            <button onClick={onCut} title="Cut" className="flex items-center gap-1 h-6 px-2 rounded text-xs hover:bg-muted transition-colors">
              <Scissors className="w-3 h-3" /> Cut
            </button>
            {hasClipboard && (
              <button onClick={onPaste} title="Paste" className="flex items-center gap-1 h-6 px-2 rounded text-xs hover:bg-muted transition-colors text-primary">
                <ClipboardPaste className="w-3 h-3" /> Paste
              </button>
            )}
            <button onClick={onDownload} title="Download" className="flex items-center gap-1 h-6 px-2 rounded text-xs hover:bg-muted transition-colors">
              <Download className="w-3 h-3" /> Download
            </button>
            <button onClick={onCompress} title="Compress" className="flex items-center gap-1 h-6 px-2 rounded text-xs hover:bg-muted transition-colors">
              <Archive className="w-3 h-3" /> Compress
            </button>
            <button onClick={onDelete}
              className="flex items-center gap-1 h-6 px-2 rounded bg-destructive/10 text-destructive text-xs hover:bg-destructive/20 transition-colors">
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        )}
        {!selectedCount && hasClipboard && (
          <button onClick={onPaste} className="flex items-center gap-1 h-6 px-2 rounded text-xs text-primary hover:bg-muted transition-colors">
            <ClipboardPaste className="w-3 h-3" /> Paste here
          </button>
        )}
      </div>
    </div>
  )
}
