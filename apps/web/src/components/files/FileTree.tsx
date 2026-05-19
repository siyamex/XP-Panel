'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Folder, FolderOpen, Globe, Mail, Database, FileText, Server } from 'lucide-react'
import { filesApi } from '@/lib/api/files.api'
import { cn } from '@/lib/utils/cn'

interface Props {
  currentPath: string
  onNavigate: (path: string) => void
}

interface TreeNodeProps {
  path: string
  name: string
  depth: number
  currentPath: string
  onNavigate: (path: string) => void
}

function TreeNode({ path, name, depth, currentPath, onNavigate }: TreeNodeProps) {
  const [open, setOpen] = useState(currentPath === path || currentPath.startsWith(path + '/'))

  const { data } = useQuery({
    queryKey: ['files-tree', path],
    queryFn: () => filesApi.list(path),
    enabled: open,
    select: r => r.data.files.filter(f => f.is_dir),
    staleTime: 30_000,
  })

  return (
    <div>
      <button
        onClick={() => { onNavigate(path); setOpen(o => !o) }}
        className={cn(
          'flex items-center gap-1.5 w-full text-left py-1 text-sm rounded transition-colors',
          'hover:bg-muted',
          currentPath === path && 'bg-primary/10 text-primary font-medium'
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        <ChevronRight className={cn('w-3 h-3 text-muted-foreground shrink-0 transition-transform', open && 'rotate-90')} />
        {open ? <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" /> : <Folder className="w-4 h-4 text-amber-400 shrink-0" />}
        <span className="truncate">{name}</span>
      </button>
      {open && (data ?? []).map(dir => (
        <TreeNode key={dir.path} path={dir.path} name={dir.name} depth={depth + 1} currentPath={currentPath} onNavigate={onNavigate} />
      ))}
    </div>
  )
}

const QUICK_LINKS = [
  { label: 'public_html', path: '/public_html', icon: Globe, color: 'text-blue-400' },
  { label: 'www', path: '/www', icon: Globe, color: 'text-blue-400' },
  { label: 'mail', path: '/mail', icon: Mail, color: 'text-pink-400' },
  { label: 'logs', path: '/logs', icon: FileText, color: 'text-amber-400' },
  { label: 'tmp', path: '/tmp', icon: Server, color: 'text-muted-foreground' },
]

export function FileTree({ currentPath, onNavigate }: Props) {
  const { data } = useQuery({
    queryKey: ['files-tree', '/'],
    queryFn: () => filesApi.list('/'),
    select: r => r.data.files.filter(f => f.is_dir),
    staleTime: 30_000,
  })

  const rootDirs = data ?? []
  const existingPaths = new Set(rootDirs.map(d => d.path))

  return (
    <div className="p-1 py-2 space-y-0.5">
      {/* Quick access */}
      <div className="px-2 py-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">Quick Access</p>
        {QUICK_LINKS.filter(q => existingPaths.has(q.path)).map(q => {
          const Icon = q.icon
          return (
            <button key={q.path} onClick={() => onNavigate(q.path)}
              className={cn(
                'flex items-center gap-2 w-full text-left px-2 py-1 text-xs rounded transition-colors hover:bg-muted',
                currentPath === q.path && 'bg-primary/10 text-primary font-medium'
              )}>
              <Icon className={cn('w-3.5 h-3.5 shrink-0', q.color)} />
              {q.label}
            </button>
          )
        })}
      </div>

      <div className="h-px bg-border mx-2 my-1" />

      {/* Root */}
      <button onClick={() => onNavigate('/')}
        className={cn(
          'flex items-center gap-1.5 w-full text-left px-2 py-1 text-sm rounded transition-colors hover:bg-muted',
          currentPath === '/' && 'bg-primary/10 text-primary font-medium'
        )}>
        <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="font-medium">/ (root)</span>
      </button>

      {rootDirs.map(dir => (
        <TreeNode key={dir.path} path={dir.path} name={dir.name} depth={0} currentPath={currentPath} onNavigate={onNavigate} />
      ))}
    </div>
  )
}
