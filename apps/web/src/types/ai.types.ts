export interface AIMessage {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  tokens_used?: number
  created_at: string
}

export interface Conversation {
  id: string
  organization_id: string
  title: string
  model: string
  messages?: AIMessage[]
  created_at: string
  updated_at: string
}

export interface ChatRequest {
  conversation_id?: string
  message: string
  model?: string
  stream?: boolean
}

export interface SSEChunk {
  id?: string
  type: 'delta' | 'done' | 'error'
  content: string
}

export interface AnalyzeRequest {
  type: 'logs' | 'config' | 'security'
  content: string
}

export const AI_MODELS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Recommended)' },
  { value: 'claude-opus-4-7', label: 'Claude Opus 4.7 (Most Capable)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Fast)' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
] as const
