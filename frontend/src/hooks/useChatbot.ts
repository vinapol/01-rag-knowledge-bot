import { useState } from 'react'
import type { PendingFileItem, ChatMessage } from '../types'
import { uploadDocuments } from '../api/documents'
import { sendChatMessage } from '../api/chat'

export function useChatbot() {
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<PendingFileItem[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = (file: File | null) => {
    if (!file) return
    setFiles((prev) => {
      if (prev.length >= 5) return prev
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          filename: file.name,
          status: 'pending',
          file,
        },
      ]
    })
  }

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const handleSend = async () => {
    const text = message.trim()
    const pending = files.filter((f) => f.status === 'pending')
    if (!text && pending.length === 0) return

    const attachments = pending.map(({ id, filename }) => ({ id, filename }))
    const toUpload = [...pending]

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        attachments: attachments.length ? attachments : undefined,
      },
    ])
    setMessage('')
    setFiles([])
    setLoading(true)
    setError(null)

    try {
      const documentIds: string[] = []
      for (const item of toUpload) {
        const uploaded = await uploadDocuments(item.file)
        if (uploaded.status === 'indexed') {
          documentIds.push(uploaded.id)
        }
      }

      if (text) {
        const res = await sendChatMessage(text, { documentIds })
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: res.answer,
            citations: res.citations,
          },
        ])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return {
    message,
    setMessage,
    files,
    messages,
    loading,
    error,
    handleFileSelect,
    handleRemoveFile,
    handleSend,
  }
}
