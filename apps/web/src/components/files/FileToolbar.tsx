'use client'

import {
  ChevronLeft, ChevronRight, Home, RefreshCw,
  FolderPlus, Upload, Trash2, Copy, Scissors,
  Archive, MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface Props {
  currentPath: string
  selectedCount: number
  onNavigate: (path: string) => void
  onDelete: () => void
  onNewFolder: () => void
  onUpload: () => void
  onRefresh: () => void
}

function PathBreadcrumb({ path, onNavigate }: { path: string; onNavigate: (p: string) => void }) {
  const parts = path.split('/').filter(Boolean)

  return (
    <div className="flex items-center gap-1 text-sm min-w-0 overflow-x-auto">
      <button
        onClick={() => onNavigate('/')}
        className="shrink-0 hover:text-primary transition-colors text-muted-foreground"
      >
        <Home className="w-3.5 h-3.5" />
      </button>
      {parts.map((part, i) => {
        const partPath = '/' + parts.slice(0, i + 1).join('/')
        const isLast = i === parts.length - 1
        return (
          <div key={partPath} className="flex items-center gap-1 shrink-0">
            <span className="text-muted-foreground">/</span>
            <button
              onClick={() => !isLast && onNavigate(partPath)}
              className={cn(
                'transition-colors',
                isLast ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-primary'
              )}
            >
              {part}
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function FileToolbar({
  currentPath, selectedCount, onNavigate, onDelete, onNewFolder, onUpload, onRefresh
}: Props) {
  const goUp = () => {
    const parts = currentPath.split('/').filter(Boolean)
    if (parts.length === 0) return
    const parent = '/' + parts.slice(0, -1).join('/')
    onNavigate(parent || '/')
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/20">
      {/* Navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={goUp}
          disabled={currentPath === '/'}
          className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-30"
          title="Go up"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Breadcrumb */}
      <div className="flex-1 min-w-0 bg-background border border-border rounded-md px-2 py-1">
        <PathBreadcrumb path={currentPath} onNavigate={onNavigate} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onRefresh}
          className="p-1.5 rounded hover:bg-muted transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>

        <button
          onClick={onNewFolder}
          className="p-1.5 rounded hover:bg-muted transition-colors"
          title="New folder"
        >
          <FolderPlus className="w-4 h-4 text-muted-foreground" />
        </button>

        <button
          onClick={onUpload}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          title="Upload files"
        >
          <Upload className="w-3.5 h-3.5" />
          Upload
        </button>

        {selectedCount > 0 && (
          <>
            <div className="w-px h-5 bg-border mx-1" />
            <span className="text-xs text-muted-foreground">{selectedCount} selected</span>
            <button
              onClick={onDelete}
              className="flex items-center gap-1 h-7 px-2.5 rounded bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  )
}
