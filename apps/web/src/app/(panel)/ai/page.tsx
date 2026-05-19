'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, Bot, User, Plus, Trash2, Loader2, Sparkles, ChevronDown } from 'lucide-react'
import { aiApi } from '@/lib/api/ai.api'
import type { AIMessage, Conversation } from '@/types/ai.types'
import { AI_MODELS } from '@/types/ai.types'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'

interface LocalMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

export default function AIPage() {
  const [activeConvID, setActiveConvID] = useState<string | null>(null)
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [input, setInput] = useState('')
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [isStreaming, setIsStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  const { data: conversations } = useQuery({
    queryKey: ['ai-conversations'],
    queryFn: () => aiApi.listConversations(),
    select: (r) => r.data?.conversations ?? [],
  })

  const { data: convDetail } = useQuery({
    queryKey: ['ai-conversation', activeConvID],
    queryFn: () => aiApi.getConversation(activeConvID!),
    select: (r) => r.data,
    enabled: !!activeConvID,
  })

  useEffect(() => {
    if (convDetail?.messages) {
      setMessages(convDetail.messages.map((m: AIMessage) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })))
    }
  }, [convDetail])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const deleteMutation = useMutation({
    mutationFn: (id: string) => aiApi.deleteConversation(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['ai-conversations'] })
      if (activeConvID === id) { setActiveConvID(null); setMessages([]) }
      toast.success('Conversation deleted')
    },
  })

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return
    const userMsg: LocalMessage = { id: Date.now().toString(), role: 'user', content: input.trim() }
    const pendingMsg: LocalMessage = { id: 'pending', role: 'assistant', content: '', streaming: true }
    setMessages((prev) => [...prev, userMsg, pendingMsg])
    const text = input.trim()
    setInput('')
    setIsStreaming(true)

    try {
      const apiURL = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(`${apiURL}/api/v1/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: activeConvID ?? undefined,
          message: text,
          model,
          stream: true,
        }),
      })

      if (!res.ok || !res.body) {
        throw new Error('Request failed')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let newConvID: string | null = null

      newConvID = res.headers.get('X-Conversation-ID')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'delta') {
              fullContent += data.content
              setMessages((prev) => prev.map((m) => m.id === 'pending' ? { ...m, content: fullContent } : m))
            } else if (data.type === 'done') {
              setMessages((prev) => prev.map((m) => m.id === 'pending' ? { ...m, id: data.id ?? 'done', streaming: false } : m))
              if (newConvID && !activeConvID) {
                setActiveConvID(newConvID)
                qc.invalidateQueries({ queryKey: ['ai-conversations'] })
              }
            }
          } catch {}
        }
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== 'pending'))
      toast.error('Failed to send message')
    } finally {
      setIsStreaming(false)
    }
  }

  const startNewConversation = () => {
    setActiveConvID(null)
    setMessages([])
  }

  const SUGGESTIONS = [
    'How do I optimize NGINX for high traffic?',
    'Check my server for security issues',
    'Help me set up SSL certificates',
    'Why is my CPU usage so high?',
  ]

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-border flex flex-col bg-card/50">
        <div className="p-3 border-b border-border">
          <button onClick={startNewConversation} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {(conversations ?? []).map((conv: Conversation) => (
            <div key={conv.id} className={cn('group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors', activeConvID === conv.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50')}>
              <button className="flex-1 text-left min-w-0" onClick={() => setActiveConvID(conv.id)}>
                <div className="text-xs font-medium truncate">{conv.title}</div>
                <div className="text-xs text-muted-foreground">{new Date(conv.updated_at).toLocaleDateString()}</div>
              </button>
              <button onClick={() => deleteMutation.mutate(conv.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 transition-all">
                <Trash2 className="w-3 h-3 text-destructive" />
              </button>
            </div>
          ))}
          {!conversations?.length && (
            <div className="text-center text-xs text-muted-foreground py-8">No conversations yet</div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">XP-Panel AI</span>
          </div>
          <div className="relative">
            <select value={model} onChange={(e) => setModel(e.target.value)} className="h-8 pl-3 pr-8 rounded-md border border-border bg-background text-xs appearance-none focus:outline-none focus:ring-1 focus:ring-primary">
              {AI_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
              <div>
                <Bot className="w-12 h-12 text-primary/40 mx-auto mb-3" />
                <h3 className="font-semibold text-lg">XP-Panel AI</h3>
                <p className="text-sm text-muted-foreground mt-1">Your intelligent server management assistant</p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-w-lg w-full">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => { setInput(s) }} className="px-3 py-2.5 text-left text-xs bg-muted/50 hover:bg-muted rounded-lg border border-border transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div className={cn('max-w-[75%] rounded-xl px-4 py-3 text-sm', msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm')}>
                <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                {msg.streaming && <span className="inline-block w-1 h-4 bg-current ml-0.5 animate-pulse" />}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border">
          <div className="flex items-end gap-3 bg-muted/50 border border-border rounded-xl px-4 py-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder="Ask anything about your server..."
              rows={1}
              className="flex-1 bg-transparent text-sm resize-none focus:outline-none max-h-32 overflow-auto"
              style={{ minHeight: '24px' }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming}
              className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">Shift+Enter for new line · Enter to send</p>
        </div>
      </div>
    </div>
  )
}
