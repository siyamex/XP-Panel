'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { filesApi, type FileInfo } from '@/lib/api/files.api'
import { FileTree } from './FileTree'
import { FileList } from './FileList'
import { FileToolbar } from './FileToolbar'
import { CodeEditor } from './CodeEditor'
import { FileUpload } from './FileUpload'
import { toast } from 'sonner'

interface Props {
  initialPath?: string
}

export function FileExplorer({ initialPath = '/' }: Props) {
  const [currentPath, setCurrentPath] = useState(initialPath)
  const [selected, setSelected] = useState<string[]>([])
  const [editingFile, setEditingFile] = useState<{ path: string; content: string } | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['files', currentPath],
    queryFn: () => filesApi.list(currentPath),
  })

  const deleteMutation = useMutation({
    mutationFn: (path: string) => filesApi.delete(path),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['files', currentPath] })
      setSelected([])
      toast.success('Deleted successfully')
    },
    onError: () => toast.error('Failed to delete'),
  })

  const mkdirMutation = useMutation({
    mutationFn: (path: string) => filesApi.mkdir(path),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['files', currentPath] })
      toast.success('Directory created')
    },
  })

  const navigate = useCallback((path: string) => {
    setCurrentPath(path)
    setSelected([])
  }, [])

  const handleOpen = useCallback(async (file: FileInfo) => {
    if (file.is_dir) {
      navigate(file.path)
      return
    }
    try {
      const res = await filesApi.read(file.path)
      setEditingFile({ path: file.path, content: res.data.content })
    } catch {
      toast.error('Cannot open file for editing')
    }
  }, [navigate])

  const handleDelete = useCallback(() => {
    if (selected.length === 0) return
    if (!confirm(`Delete ${selected.length} item(s)?`)) return
    selected.forEach((path) => deleteMutation.mutate(path))
  }, [selected, deleteMutation])

  const handleNewFolder = useCallback(() => {
    const name = prompt('Folder name:')
    if (!name) return
    const path = currentPath.endsWith('/') ? currentPath + name : currentPath + '/' + name
    mkdirMutation.mutate(path)
  }, [currentPath, mkdirMutation])

  const files = data?.data.files ?? []

  if (editingFile) {
    return (
      <CodeEditor
        path={editingFile.path}
        initialContent={editingFile.content}
        onClose={() => {
          setEditingFile(null)
          qc.invalidateQueries({ queryKey: ['files', currentPath] })
        }}
      />
    )
  }

  return (
    <div className="flex h-full flex-col bg-background rounded-xl border border-border overflow-hidden">
      <FileToolbar
        currentPath={currentPath}
        selectedCount={selected.length}
        onNavigate={navigate}
        onDelete={handleDelete}
        onNewFolder={handleNewFolder}
        onUpload={() => setShowUpload(true)}
        onRefresh={() => qc.invalidateQueries({ queryKey: ['files', currentPath] })}
      />

      <div className="flex flex-1 min-h-0">
        {/* Left: directory tree */}
        <div className="w-56 border-r border-border shrink-0 overflow-y-auto">
          <FileTree
            currentPath={currentPath}
            onNavigate={navigate}
          />
        </div>

        {/* Right: file list */}
        <div className="flex-1 overflow-y-auto">
          <FileList
            files={files}
            currentPath={currentPath}
            selected={selected}
            isLoading={isLoading}
            error={error?.message}
            onSelect={setSelected}
            onOpen={handleOpen}
            onNavigate={navigate}
          />
        </div>
      </div>

      {showUpload && (
        <FileUpload
          currentPath={currentPath}
          onClose={() => {
            setShowUpload(false)
            qc.invalidateQueries({ queryKey: ['files', currentPath] })
          }}
        />
      )}
    </div>
  )
}
