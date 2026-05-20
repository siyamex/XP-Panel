'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HardDrive, Folder, File, ChevronRight, ChevronDown } from 'lucide-react'
import { bandwidthApi } from '@/lib/api/hosting.api'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function pct(bytes: number, total: number) {
  return total > 0 ? Math.round((bytes / total) * 100) : 0
}

interface TreeNode {
  path: string
  bytes: number
  type: 'dir' | 'file'
  children?: TreeNode[]
}

function TreeRow({ node, total, depth = 0 }: { node: TreeNode; total: number; depth?: number }) {
  const [open, setOpen] = useState(depth < 2)
  const hasChildren = node.children && node.children.length > 0
  const percent = pct(node.bytes, total)

  return (
    <div>
      <div
        className="flex items-center gap-2 px-4 py-2 hover:bg-muted/30 transition-colors cursor-pointer"
        style={{ paddingLeft: `${16 + depth * 20}px` }}
        onClick={() => hasChildren && setOpen(o => !o)}
      >
        <span className="text-muted-foreground w-4 shrink-0">
          {hasChildren ? (open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />) : null}
        </span>
        {node.type === 'dir'
          ? <Folder className="h-4 w-4 text-blue-400 shrink-0" />
          : <File className="h-4 w-4 text-muted-foreground shrink-0" />}
        <span className="text-sm flex-1">{node.path}</span>
        <div className="flex items-center gap-3">
          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${percent}%` }} />
          </div>
          <span className="text-xs text-muted-foreground w-16 text-right">{percent}%</span>
          <span className="text-xs font-medium w-20 text-right">{formatBytes(node.bytes)}</span>
        </div>
      </div>
      {open && node.children?.map((child, i) => (
        <TreeRow key={i} node={child} total={total} depth={depth + 1} />
      ))}
    </div>
  )
}

export default function DiskUsagePage() {
  const [domain, setDomain] = useState('example.com')
  const [inputDomain, setInputDomain] = useState('example.com')

  const { data, isLoading } = useQuery({
    queryKey: ['disk-usage', domain],
    queryFn: () => bandwidthApi.getDomainDiskUsage(domain).then(r => r.data),
    enabled: !!domain,
  })

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Disk Usage</h1>
        <p className="text-muted-foreground text-sm mt-1">Visualize disk usage by directory</p>
      </div>

      <div className="flex gap-2">
        <input value={inputDomain} onChange={e => setInputDomain(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && setDomain(inputDomain)}
          placeholder="example.com" className="flex-1 border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        <button onClick={() => setDomain(inputDomain)} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
          Analyze
        </button>
      </div>

      {data && (
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <HardDrive className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{data.root}</p>
            <p className="text-xs text-muted-foreground">Total: {formatBytes(data.total_bytes)}</p>
          </div>
        </div>
      )}

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b grid grid-cols-[1fr_24px_24px_60px_80px_100px] text-xs font-medium text-muted-foreground">
          <span>Path</span><span /><span /><span className="text-right">Usage</span><span className="text-right">%</span><span className="text-right">Size</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Analyzing...</div>
        ) : !data?.tree.length ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No data</div>
        ) : (
          <div>
            {(data.tree as TreeNode[]).map((node, i) => (
              <TreeRow key={i} node={node} total={data.total_bytes} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
