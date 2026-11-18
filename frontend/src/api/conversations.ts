import { apiFetch } from './client'
import type { ChatCitation } from './chat'

export type ConversationSummary = {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export type ConversationMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  attachments?: { id: string; filename: string }[] | null
  citations?: ChatCitation[] | null
  created_at: string
}

export type ConversationDetail = {
  conversation: ConversationSummary
  messages: ConversationMessage[]
  documents: {
    id: string
    filename: string
    status: string
    chunks_count: number
    created_at: string
    error_message: string | null
  }[]
}

export async function listConversations(): Promise<{ conversations: ConversationSummary[] }> {
  const res = await apiFetch('/api/v1/conversations')
  return res.json()
}

export async function createConversation(
  title?: string,
): Promise<ConversationSummary> {
  const res = await apiFetch('/api/v1/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: title || null }),
  })
  return res.json()
}

export async function getConversation(id: string): Promise<ConversationDetail> {
  const res = await apiFetch(`/api/v1/conversations/${id}`)
  return res.json()
}

export async function deleteConversation(id: string): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/v1/conversations/${id}`, {
    method: 'DELETE',
  })
  return res.json()
}
