'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Lock, X } from 'lucide-react'
import { type FileInfo } from '@/lib/api/files.api'
import { cn } from '@/lib/utils/cn'

interface Props {
  file: FileInfo
  onClose: () => void
  onApply: (mode: string) => void
}

interface Perm { read: boolean; write: boolean; execute: boolean }

function parseMode(modeStr: string): [Perm, Perm, Perm] {
  // modeStr like "-rwxr-xr--" or "drwxr-xr-x"
  const s = modeStr.replace(/^[d\-lscbp]/, '')
  const parse = (chunk: string): Perm => ({
    read: chunk[0] === 'r',
    write: chunk[1] === 'w',
    execute: chunk[2] === 'x' || chunk[2] === 's' || chunk[2] === 't',
  })
  return [
    parse(s.slice(0, 3)),
    parse(s.slice(3, 6)),
    parse(s.slice(6, 9)),
  ]
}

function permToOctal(p: Perm) {
  return (p.read ? 4 : 0) + (p.write ? 2 : 0) + (p.execute ? 1 : 0)
}

const PRESETS = [
  { label: '644', desc: 'Files (rw-r--r--)' },
  { label: '755', desc: 'Dirs/Scripts (rwxr-xr-x)' },
  { label: '600', desc: 'Private (rw-------)' },
  { label: '777', desc: 'Full access (rwxrwxrwx)' },
  { label: '400', desc: 'Read-only (r--------)' },
  { label: '664', desc: 'Group write (rw-rw-r--)' },
]

export function ChmodDialog({ file, onClose, onApply }: Props) {
  const initial = parseMode(file.mode)
  const [owner, setOwner] = useState<Perm>(initial[0])
  const [group, setGroup] = useState<Perm>(initial[1])
  const [other, setOther] = useState<Perm>(initial[2])

  const octal = `${permToOctal(owner)}${permToOctal(group)}${permToOctal(other)}`

  const modeStr = (p: Perm) =>
    (p.read ? 'r' : '-') + (p.write ? 'w' : '-') + (p.execute ? 'x' : '-')

  const setFromOctal = (s: string) => {
    if (!/^\d{3}$/.test(s)) return
    const toP = (n: number): Perm => ({ read: !!(n & 4), write: !!(n & 2), execute: !!(n & 1) })
    setOwner(toP(parseInt(s[0])))
    setGroup(toP(parseInt(s[1])))
    setOther(toP(parseInt(s[2])))
  }

  const PermRow = ({ label, perm, onChange }: { label: string; perm: Perm; onChange: (p: Perm) => void }) => (
    <div className="flex items-center gap-3">
      <span className="w-14 text-sm font-medium">{label}</span>
      {(['read', 'write', 'execute'] as const).map(bit => (
        <label key={bit} className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={perm[bit]}
            onChange={e => onChange({ ...perm, [bit]: e.target.checked })}
            className="rounded border-border cursor-pointer"
          />
          <span className="text-sm capitalize text-muted-foreground">{bit.charAt(0).toUpperCase()}</span>
        </label>
      ))}
      <span className="ml-auto font-mono text-sm text-muted-foreground">{modeStr(perm)}</span>
      <span className="font-mono text-sm w-4 text-center">{permToOctal(perm)}</span>
    </div>
  )

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold">Permissions</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-sm text-muted-foreground truncate">
            <span className="font-mono text-foreground">{file.name}</span>
          </div>

          {/* Octal input */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Numeric mode:</span>
            <input
              value={octal}
              onChange={e => setFromOctal(e.target.value)}
              maxLength={3}
              className="w-16 h-9 text-center font-mono text-lg border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="font-mono text-sm text-muted-foreground">
              {modeStr(owner)}{modeStr(group)}{modeStr(other)}
            </span>
          </div>

          {/* Visual checkboxes */}
          <div className="bg-muted/30 rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-3 pb-1 border-b border-border text-xs text-muted-foreground">
              <span className="w-14" />
              <span className="w-16 text-center">Read</span>
              <span className="w-16 text-center">Write</span>
              <span className="w-20 text-center">Execute</span>
              <span className="ml-auto">Symbolic</span>
              <span className="w-4 text-center">Oct</span>
            </div>
            <PermRow label="Owner" perm={owner} onChange={setOwner} />
            <PermRow label="Group" perm={group} onChange={setGroup} />
            <PermRow label="Other" perm={other} onChange={setOther} />
          </div>

          {/* Presets */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Common presets:</p>
            <div className="grid grid-cols-3 gap-1.5">
              {PRESETS.map(p => (
                <button key={p.label} onClick={() => setFromOctal(p.label)}
                  className={cn(
                    'text-left px-2 py-1.5 rounded border text-xs transition-colors',
                    octal === p.label ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50 hover:bg-muted'
                  )}>
                  <span className="font-mono font-bold">{p.label}</span>
                  <span className="block text-muted-foreground truncate">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">
              Cancel
            </button>
            <button onClick={() => onApply(octal)}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              Apply {octal}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
