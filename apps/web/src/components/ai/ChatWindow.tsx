'use client'

import { useRef, useEffect, useState } from 'react'
import { Send, Loader2, Bot, RotateCcw } from 'lucide-react'
import { ChatMessage, type Message } from './ChatMessage'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

interface ChatWindowProps {
  messages: Message[]
  onSend: (content: string) => void
  loading?: boolean
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Show an empty-state illustration when no messages */
  emptyTitle?: string
  emptyDescription?: string
  onClear?: () => void
}

const SUGGESTIONS = [
  'What is the current CPU usage?',
  'List all my domains',
  'Check if SSL certificates are expiring',
  'What are the top processes using memory?',
  'Create a backup of /var/www now',
]

export function ChatWindow({
  messages,
  onSend,
  loading = false,
  placeholder = 'Ask anything about your server…',
  disabled = false,
  className,
  emptyTitle = 'XP-Panel AI',
  emptyDescription = 'Ask me anything about your infrastructure',
  onClear,
}: ChatWindowProps) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [input])

  function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || disabled || loading) return
    onSend(trimmed)
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 gap-4">
            <div className="rounded-full bg-primary/10 p-5">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{emptyTitle}</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">{emptyDescription}</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-md mt-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => { setInput(s); textareaRef.current?.focus() }}
                  className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted/50 hover:bg-accent transition-colors text-left"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map(m => <ChatMessage key={m.id} message={m} />)}
            {loading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-muted border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                  <span className="flex gap-1">
                    {[0, 150, 300].map(d => (
                      <span
                        key={d}
                        className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                        style={{ animationDelay: `${d}ms` }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border p-3 bg-background">
        <div className="flex items-end gap-2 rounded-xl border border-input bg-muted/30 px-3 py-2 focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || loading}
            className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground min-h-[24px] max-h-[160px] py-0.5"
          />
          <div className="flex items-center gap-1 shrink-0">
            {onClear && messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={onClear}
                title="Clear conversation"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={handleSend}
              disabled={!input.trim() || disabled || loading}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-1.5">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
