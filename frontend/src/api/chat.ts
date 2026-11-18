import { apiFetch } from './client'

export type ChatCitation = {
  id: number
  source: string | null
  chunk_index: number | null
  excerpt: string
  score: number
}

export type ChatResponse = {
  answer: string
  citations: ChatCitation[]
  conversation_id: string
}

export async function sendChatMessage(
  message: string,
  options: {
    conversationId: string
    topK?: number
    attachments?: { id: string; filename: string }[]
  },
): Promise<ChatResponse> {
  const { conversationId, topK = 5, attachments } = options
  const res = await apiFetch('/api/v1/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      top_k: topK,
      attachments: attachments?.length ? attachments : undefined,
    }),
  })
  return res.json()
}
