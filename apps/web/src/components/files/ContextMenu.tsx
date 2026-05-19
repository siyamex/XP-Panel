'use client'

import { useEffect, useRef } from 'react'
import {
  FolderOpen, Download, Edit3, Copy, Scissors, ClipboardPaste,
  Trash2, Lock, Archive, PackageOpen, FilePlus, FolderPlus,
} from 'lucide-react'
import { type FileInfo } from '@/lib/api/files.api'
import { cn } from '@/lib/utils/cn'

interface Props {
  x: number
  y: number
  targets: string[]
  file: FileInfo | null
  hasClipboard: boolean
  onOpen: () => void
  onDownload: () => void
  onRename: () => void
  onCopy: () => void
  onCut: () => void
  onPaste: () => void
  onDelete: () => void
  onChmod: () => void
  onCompress: () => void
  onExtract: () => void
  onNewFile: () => void
  onNewFolder: () => void
}

const Item = ({ icon: Icon, label, onClick, danger, disabled }: {
  icon: React.ElementType; label: string; onClick: () => void; danger?: boolean; disabled?: boolean
}) => (
  <button
    onClick={e => { e.stopPropagation(); if (!disabled) onClick() }}
    disabled={disabled}
    className={cn(
      'flex items-center gap-2.5 w-full px-3 py-1.5 text-sm rounded transition-colors text-left',
      danger ? 'hover:bg-destructive/10 text-destructive' : 'hover:bg-muted',
      disabled && 'opacity-40 cursor-not-allowed'
    )}
  >
    <Icon className="w-4 h-4 shrink-0" />
    {label}
  </button>
)

const Sep = () => <div className="h-px bg-border my-1 mx-2" />

export function ContextMenu({
  x, y, targets, file, hasClipboard,
  onOpen, onDownload, onRename, onCopy, onCut, onPaste, onDelete,
  onChmod, onCompress, onExtract, onNewFile, onNewFolder,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // Position so menu doesn't overflow viewport
  useEffect(() => {
    if (!ref.current) return
    const { innerWidth, innerHeight } = window
    const { width, height } = ref.current.getBoundingClientRect()
    if (x + width > innerWidth) ref.current.style.left = `${innerWidth - width - 8}px`
    if (y + height > innerHeight) ref.current.style.top = `${innerHeight - height - 8}px`
  }, [x, y])

  const multi = targets.length > 1
  const hasFile = !!file
  const isArchive = file ? ['zip', 'tar', 'gz', 'bz2', 'rar', '7z'].includes(file.extension ?? '') : false

  return (
    <div
      ref={ref}
      onClick={e => e.stopPropagation()}
      className="fixed z-50 w-52 bg-popover border border-border rounded-lg shadow-xl p-1"
      style={{ left: x, top: y }}
    >
      {hasFile && !multi && (
        <>
          <Item icon={FolderOpen} label={file!.is_dir ? 'Open' : 'Edit'} onClick={onOpen} />
          <Item icon={Download} label="Download" onClick={onDownload} />
          <Item icon={Edit3} label="Rename" onClick={onRename} />
          <Sep />
        </>
      )}

      <Item icon={Copy} label={multi ? `Copy (${targets.length})` : 'Copy'} onClick={onCopy} disabled={!hasFile && targets.length === 0} />
      <Item icon={Scissors} label={multi ? `Cut (${targets.length})` : 'Cut'} onClick={onCut} disabled={!hasFile && targets.length === 0} />
      {hasClipboard && <Item icon={ClipboardPaste} label="Paste here" onClick={onPaste} />}

      <Sep />

      <Item icon={Archive} label="Compress…" onClick={onCompress} disabled={targets.length === 0} />
      {hasFile && isArchive && <Item icon={PackageOpen} label="Extract here" onClick={onExtract} />}

      {hasFile && !multi && (
        <>
          <Sep />
          <Item icon={Lock} label="Permissions (chmod)" onClick={onChmod} />
        </>
      )}

      <Sep />
      <Item icon={FilePlus} label="New file" onClick={onNewFile} />
      <Item icon={FolderPlus} label="New folder" onClick={onNewFolder} />

      <Sep />
      <Item icon={Trash2} label={multi ? `Delete (${targets.length})` : 'Delete'} onClick={onDelete} danger disabled={targets.length === 0} />
    </div>
  )
}
