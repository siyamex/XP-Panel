import { apiClient } from './client'
import type { Conversation, ChatRequest, AnalyzeRequest } from '@/types/ai.types'

const BASE = '/ai'

export const aiApi = {
  listConversations: () => apiClient.get<{ conversations: Conversation[] }>(`${BASE}/conversations`),
  getConversation: (id: string) => apiClient.get<Conversation>(`${BASE}/conversations/${id}`),
  deleteConversation: (id: string) => apiClient.delete(`${BASE}/conversations/${id}`),
  chat: (data: ChatRequest) => apiClient.post<{ conversation_id: string; message: { id: string; role: string; content: string } }>(`${BASE}/chat`, data),
  analyze: (data: AnalyzeRequest) => apiClient.post<{ analysis: string; type: string }>(`${BASE}/analyze`, data),

  // Returns a URL for SSE streaming — call with EventSource or fetch
  chatStreamUrl: () => `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/v1/ai/chat`,
}
