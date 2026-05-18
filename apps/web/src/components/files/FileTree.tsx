'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Folder, FolderOpen } from 'lucide-react'
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
  isActive: boolean
  currentPath: string
  onNavigate: (path: string) => void
}

function TreeNode({ path, name, depth, isActive, currentPath, onNavigate }: TreeNodeProps) {
  const [open, setOpen] = useState(isActive || currentPath.startsWith(path))

  const { data } = useQuery({
    queryKey: ['files-tree', path],
    queryFn: () => filesApi.list(path),
    enabled: open,
    select: (res) => res.data.files.filter((f) => f.is_dir),
  })

  const subDirs = data ?? []

  return (
    <div>
      <button
        onClick={() => {
          onNavigate(path)
          setOpen((o) => !o)
        }}
        className={cn(
          'flex items-center gap-1.5 w-full text-left px-2 py-1 text-sm rounded transition-colors',
          'hover:bg-muted',
          currentPath === path && 'bg-primary/10 text-primary font-medium'
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        <ChevronRight
          className={cn('w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform', open && 'rotate-90')}
        />
        {open ? (
          <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
        ) : (
          <Folder className="w-4 h-4 text-amber-400 shrink-0" />
        )}
        <span className="truncate">{name}</span>
      </button>

      {open && subDirs.length > 0 && (
        <div>
          {subDirs.map((dir) => (
            <TreeNode
              key={dir.path}
              path={dir.path}
              name={dir.name}
              depth={depth + 1}
              isActive={currentPath === dir.path}
              currentPath={currentPath}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FileTree({ currentPath, onNavigate }: Props) {
  const { data } = useQuery({
    queryKey: ['files-tree', '/'],
    queryFn: () => filesApi.list('/'),
    select: (res) => res.data.files.filter((f) => f.is_dir),
  })

  const rootDirs = data ?? []

  return (
    <div className="p-1 py-2">
      <button
        onClick={() => onNavigate('/')}
        className={cn(
          'flex items-center gap-1.5 w-full text-left px-2 py-1 text-sm rounded mb-1 transition-colors',
          'hover:bg-muted',
          currentPath === '/' && 'bg-primary/10 text-primary font-medium'
        )}
      >
        <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="font-medium">/</span>
      </button>

      {rootDirs.map((dir) => (
        <TreeNode
          key={dir.path}
          path={dir.path}
          name={dir.name}
          depth={0}
          isActive={currentPath === dir.path}
          currentPath={currentPath}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  )
}
