'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

interface CopyButtonProps {
  value: string
  className?: string
  size?: 'sm' | 'icon'
}

export function CopyButton({ value, className, size = 'icon' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={handleCopy}
      className={cn('h-7 w-7 shrink-0', className)}
      title={copied ? 'Copied!' : 'Copy'}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  )
}
