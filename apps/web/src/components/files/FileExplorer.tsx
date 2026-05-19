'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { filesApi, type FileInfo } from '@/lib/api/files.api'
import { FileTree } from './FileTree'
import { FileList } from './FileList'
import { FileToolbar } from './FileToolbar'
import { CodeEditor } from './CodeEditor'
import { FileUpload } from './FileUpload'
import { ContextMenu } from './ContextMenu'
import { ChmodDialog } from './ChmodDialog'
import { CompressDialog } from './CompressDialog'
import { PreviewModal } from './PreviewModal'
import { toast } from 'sonner'

export type SortKey = 'name' | 'size' | 'modified_at' | 'extension'
export type SortDir = 'asc' | 'desc'

export interface ClipboardItem { paths: string[]; op: 'copy' | 'cut' }

interface ContextMenuState {
  x: number; y: number
  file: FileInfo | null
}

export function FileExplorer({ initialPath = '/' }: { initialPath?: string }) {
  const [currentPath, setCurrentPath] = useState(initialPath)
  const [selected, setSelected] = useState<string[]>([])
  const [editingFile, setEditingFile] = useState<{ path: string; content: string } | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null)
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null)
  const [chmodTarget, setChmodTarget] = useState<FileInfo | null>(null)
  const [compressTarget, setCompressTarget] = useState<string[] | null>(null)
  const [preview, setPreview] = useState<FileInfo | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const qc = useQueryClient()

  const isSearching = searchQuery.trim().length > 1

  const { data, isLoading, error } = useQuery({
    queryKey: isSearching ? ['files-search', currentPath, searchQuery] : ['files', currentPath],
    queryFn: () => isSearching
      ? filesApi.search(currentPath, searchQuery).then(r => ({ data: { files: r.data.files, path: currentPath, total: r.data.total } }))
      : filesApi.list(currentPath),
  })

  const deleteMutation = useMutation({
    mutationFn: async (paths: string[]) => {
      for (const p of paths) await filesApi.delete(p)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['files', currentPath] })
      qc.invalidateQueries({ queryKey: ['files-tree'] })
      setSelected([])
      toast.success('Deleted')
    },
    onError: () => toast.error('Delete failed'),
  })

  const mkdirMutation = useMutation({
    mutationFn: (path: string) => filesApi.mkdir(path),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['files', currentPath] }); qc.invalidateQueries({ queryKey: ['files-tree'] }); toast.success('Folder created') },
    onError: () => toast.error('Failed to create folder'),
  })

  const newFileMutation = useMutation({
    mutationFn: (path: string) => filesApi.newFile(path),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['files', currentPath] }); toast.success('File created') },
    onError: () => toast.error('Failed to create file'),
  })

  const renameMutation = useMutation({
    mutationFn: ({ path, name }: { path: string; name: string }) => filesApi.rename(path, name),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['files', currentPath] }); qc.invalidateQueries({ queryKey: ['files-tree'] }); toast.success('Renamed') },
    onError: () => toast.error('Rename failed'),
  })

  const moveMutation = useMutation({
    mutationFn: ({ src, dst }: { src: string; dst: string }) => filesApi.move(src, dst),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['files', currentPath] }); qc.invalidateQueries({ queryKey: ['files-tree'] }); toast.success('Moved') },
    onError: () => toast.error('Move failed'),
  })

  const copyMutation = useMutation({
    mutationFn: ({ src, dst }: { src: string; dst: string }) => filesApi.copy(src, dst),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['files', currentPath] }); toast.success('Copied') },
    onError: () => toast.error('Copy failed'),
  })

  const navigate = useCallback((path: string) => {
    setCurrentPath(path)
    setSelected([])
    setSearchQuery('')
    setCtxMenu(null)
  }, [])

  const handleOpen = useCallback(async (file: FileInfo) => {
    if (file.is_dir) { navigate(file.path); return }
    const ext = (file.extension ?? '').toLowerCase()
    const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(ext)
    const isText = ['txt', 'md', 'log', 'csv', 'json', 'yaml', 'yml', 'xml', 'html', 'htm', 'css',
      'js', 'ts', 'tsx', 'jsx', 'go', 'py', 'php', 'sh', 'bash', 'conf', 'ini', 'env', 'htaccess'].includes(ext)
      || file.name.startsWith('.')
    if (isImage) { setPreview(file); return }
    if (isText || file.size < 1024 * 1024) {
      try {
        const res = await filesApi.read(file.path)
        setEditingFile({ path: file.path, content: res.data.content })
      } catch { toast.error('Cannot open file') }
    } else {
      setPreview(file)
    }
  }, [navigate])

  const handleDelete = useCallback((paths?: string[]) => {
    const targets = paths ?? selected
    if (!targets.length) return
    if (!confirm(`Delete ${targets.length} item(s)? This cannot be undone.`)) return
    deleteMutation.mutate(targets)
  }, [selected, deleteMutation])

  const handleNewFolder = useCallback(() => {
    const name = prompt('Folder name:')
    if (!name?.trim()) return
    const path = joinPath(currentPath, name.trim())
    mkdirMutation.mutate(path)
  }, [currentPath, mkdirMutation])

  const handleNewFile = useCallback(() => {
    const name = prompt('File name:')
    if (!name?.trim()) return
    const path = joinPath(currentPath, name.trim())
    newFileMutation.mutate(path)
  }, [currentPath, newFileMutation])

  const handleRename = useCallback((file: FileInfo) => {
    setRenaming(file.path)
    setCtxMenu(null)
  }, [])

  const handleRenameSubmit = useCallback((oldPath: string, newName: string) => {
    if (!newName.trim()) { setRenaming(null); return }
    renameMutation.mutate({ path: oldPath, name: newName.trim() })
    setRenaming(null)
  }, [renameMutation])

  const handleCopy = useCallback((paths: string[]) => {
    setClipboard({ paths, op: 'copy' })
    setCtxMenu(null)
    toast.success(`${paths.length} item(s) copied to clipboard`)
  }, [])

  const handleCut = useCallback((paths: string[]) => {
    setClipboard({ paths, op: 'cut' })
    setCtxMenu(null)
    toast.success(`${paths.length} item(s) cut to clipboard`)
  }, [])

  const handlePaste = useCallback(() => {
    if (!clipboard) return
    const { paths, op } = clipboard
    paths.forEach((src) => {
      const name = src.split('/').pop() ?? 'file'
      const dst = joinPath(currentPath, name)
      if (op === 'copy') copyMutation.mutate({ src, dst })
      else moveMutation.mutate({ src, dst })
    })
    if (op === 'cut') setClipboard(null)
  }, [clipboard, currentPath, copyMutation, moveMutation])

  const handleDownload = useCallback((paths: string[]) => {
    paths.forEach((p) => {
      const a = document.createElement('a')
      a.href = filesApi.downloadUrl(p)
      a.download = p.split('/').pop() ?? 'file'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    })
    setCtxMenu(null)
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent, file: FileInfo | null) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY, file })
  }, [])

  // Close context menu on outside click
  useEffect(() => {
    const handler = () => setCtxMenu(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  // Sort + filter files
  const rawFiles = data?.data?.files ?? []
  const files = rawFiles
    .filter((f) => showHidden || !f.name.startsWith('.'))
    .sort((a, b) => {
      if (!isSearching) {
        if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
      }
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortKey === 'size') cmp = a.size - b.size
      else if (sortKey === 'modified_at') cmp = a.modified_at.localeCompare(b.modified_at)
      else if (sortKey === 'extension') cmp = (a.extension ?? '').localeCompare(b.extension ?? '')
      return sortDir === 'asc' ? cmp : -cmp
    })

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) { setSortDir((d) => d === 'asc' ? 'desc' : 'asc'); return key }
      setSortDir('asc')
      return key
    })
  }, [])

  const contextTarget = ctxMenu?.file
    ? (selected.includes(ctxMenu.file.path) && selected.length > 1 ? selected : [ctxMenu.file.path])
    : selected

  if (editingFile) {
    return (
      <CodeEditor
        path={editingFile.path}
        initialContent={editingFile.content}
        onClose={() => { setEditingFile(null); qc.invalidateQueries({ queryKey: ['files', currentPath] }) }}
      />
    )
  }

  return (
    <div className="flex h-full flex-col bg-background rounded-xl border border-border overflow-hidden">
      <FileToolbar
        currentPath={currentPath}
        selectedCount={selected.length}
        hasClipboard={!!clipboard}
        showHidden={showHidden}
        searchQuery={searchQuery}
        onNavigate={navigate}
        onDelete={() => handleDelete()}
        onNewFolder={handleNewFolder}
        onNewFile={handleNewFile}
        onUpload={() => setShowUpload(true)}
        onRefresh={() => qc.invalidateQueries({ queryKey: ['files', currentPath] })}
        onToggleHidden={() => setShowHidden((v) => !v)}
        onSearch={setSearchQuery}
        onPaste={handlePaste}
        onCopy={() => handleCopy(selected)}
        onCut={() => handleCut(selected)}
        onDownload={() => handleDownload(selected)}
        onCompress={() => { if (selected.length) setCompressTarget(selected) }}
      />

      <div className="flex flex-1 min-h-0">
        <div className="w-56 border-r border-border shrink-0 overflow-y-auto">
          <FileTree currentPath={currentPath} onNavigate={navigate} />
        </div>

        <div className="flex-1 overflow-y-auto relative" onContextMenu={(e) => handleContextMenu(e, null)}>
          <FileList
            files={files}
            currentPath={currentPath}
            selected={selected}
            isLoading={isLoading}
            error={(error as Error)?.message}
            sortKey={sortKey}
            sortDir={sortDir}
            renaming={renaming}
            isSearching={isSearching}
            onSelect={setSelected}
            onOpen={handleOpen}
            onNavigate={navigate}
            onContextMenu={handleContextMenu}
            onSort={handleSort}
            onRenameSubmit={handleRenameSubmit}
          />
        </div>
      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          targets={contextTarget}
          file={ctxMenu.file}
          hasClipboard={!!clipboard}
          onOpen={() => { if (ctxMenu.file) handleOpen(ctxMenu.file); setCtxMenu(null) }}
          onDownload={() => handleDownload(contextTarget)}
          onRename={() => { if (ctxMenu.file) handleRename(ctxMenu.file) }}
          onCopy={() => handleCopy(contextTarget)}
          onCut={() => handleCut(contextTarget)}
          onPaste={handlePaste}
          onDelete={() => { handleDelete(contextTarget); setCtxMenu(null) }}
          onChmod={() => { setChmodTarget(ctxMenu.file); setCtxMenu(null) }}
          onCompress={() => { setCompressTarget(contextTarget); setCtxMenu(null) }}
          onExtract={() => { if (ctxMenu.file) { filesApi.extract(ctxMenu.file.path).then(() => { qc.invalidateQueries({ queryKey: ['files', currentPath] }); toast.success('Extracted') }).catch(() => toast.error('Extract failed')) }; setCtxMenu(null) }}
          onNewFile={handleNewFile}
          onNewFolder={handleNewFolder}
        />
      )}

      {showUpload && (
        <FileUpload
          currentPath={currentPath}
          onClose={() => { setShowUpload(false); qc.invalidateQueries({ queryKey: ['files', currentPath] }) }}
        />
      )}

      {chmodTarget && (
        <ChmodDialog
          file={chmodTarget}
          onClose={() => setChmodTarget(null)}
          onApply={(mode) => {
            filesApi.chmod(chmodTarget.path, mode)
              .then(() => { toast.success(`Permissions set to ${mode}`); qc.invalidateQueries({ queryKey: ['files', currentPath] }) })
              .catch(() => toast.error('Failed to change permissions'))
            setChmodTarget(null)
          }}
        />
      )}

      {compressTarget && (
        <CompressDialog
          paths={compressTarget}
          currentPath={currentPath}
          onClose={() => setCompressTarget(null)}
          onSuccess={() => { qc.invalidateQueries({ queryKey: ['files', currentPath] }); setCompressTarget(null) }}
        />
      )}

      {preview && (
        <PreviewModal
          file={preview}
          onClose={() => setPreview(null)}
          onEdit={() => { handleOpen(preview); setPreview(null) }}
        />
      )}
    </div>
  )
}

function joinPath(base: string, name: string) {
  return (base.endsWith('/') ? base : base + '/') + name
}
