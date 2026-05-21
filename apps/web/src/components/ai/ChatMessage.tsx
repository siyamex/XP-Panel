'use client'

import { Bot, User, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils/cn'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  streaming?: boolean
  timestamp?: Date
}

interface ChatMessageProps {
  message: Message
  className?: string
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="relative group my-2 rounded-lg bg-muted border border-border overflow-hidden text-xs">
      {lang && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/80 border-b border-border">
          <span className="text-muted-foreground font-mono">{lang}</span>
          <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
      <pre className="p-3 overflow-x-auto font-mono text-foreground whitespace-pre-wrap break-words">
        {code}
      </pre>
    </div>
  )
}

function renderContent(content: string) {
  // Split on code blocks ```lang\ncode\n```
  const parts = content.split(/(```[\s\S]*?```)/g)
  return parts.map((part, i) => {
    if (part.startsWith('```')) {
      const lines = part.slice(3, -3).split('\n')
      const lang = lines[0]?.trim()
      const code = lines.slice(1).join('\n')
      return <CodeBlock key={i} code={code} lang={lang || undefined} />
    }
    // Render inline code with backticks
    const inlineParts = part.split(/(`[^`]+`)/g)
    return (
      <span key={i}>
        {inlineParts.map((ip, j) =>
          ip.startsWith('`') && ip.endsWith('`')
            ? <code key={j} className="px-1 py-0.5 rounded bg-muted font-mono text-xs">{ip.slice(1, -1)}</code>
            : <span key={j}>{ip}</span>
        )}
      </span>
    )
  })
}

export function ChatMessage({ message, className }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row', className)}>
      {/* Avatar */}
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
        isUser ? 'bg-primary text-primary-foreground' : 'bg-muted border border-border'
      )}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-foreground" />}
      </div>

      {/* Bubble */}
      <div className={cn(
        'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
        isUser
          ? 'bg-primary text-primary-foreground rounded-tr-sm'
          : 'bg-muted border border-border rounded-tl-sm text-foreground'
      )}>
        {message.streaming ? (
          <span className="inline-flex items-center gap-1">
            {message.content}
            <span className="w-1 h-4 bg-current animate-pulse rounded-sm" />
          </span>
        ) : (
          renderContent(message.content)
        )}
      </div>
    </div>
  )
}
