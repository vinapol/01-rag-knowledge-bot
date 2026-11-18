import type { ChatCitation } from '../api/chat'

export type PendingFileItem = {
  id: string
  filename: string
  status: 'pending' | 'processing' | 'indexed' | 'error'
  file: File
}

export type ChatAttachment = {
  id: string
  filename: string
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  attachments?: ChatAttachment[]
  citations?: ChatCitation[]
}