import { useCallback, useEffect, useState } from 'react'
import type { PendingFileItem, ChatMessage } from '../types'
import { uploadDocuments } from '../api/documents'
import { sendChatMessage } from '../api/chat'
import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  type ConversationSummary,
} from '../api/conversations'

export function useChatbot() {
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<PendingFileItem[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)

  const refreshConversations = useCallback(async () => {
    const res = await listConversations()
    setConversations(res.conversations)
    return res.conversations
  }, [])

  const loadConversation = useCallback(async (id: string) => {
    const detail = await getConversation(id)
    setActiveConversationId(id)
    setMessages(
      detail.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        attachments: m.attachments ?? undefined,
        citations: m.citations ?? undefined,
      })),
    )
    setFiles([])
    setMessage('')
    setError(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        let list = await listConversations()
        if (cancelled) return
        if (list.conversations.length === 0) {
          const created = await createConversation()
          if (cancelled) return
          list = { conversations: [created] }
        }
        setConversations(list.conversations)
        await loadConversation(list.conversations[0].id)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Erreur de chargement')
        }
      } finally {
        if (!cancelled) setBootstrapping(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadConversation])

  const handleSelectConversation = async (id: string) => {
    if (id === activeConversationId || loading) return
    setLoading(true)
    try {
      await loadConversation(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  const handleNewConversation = async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const created = await createConversation()
      await refreshConversations()
      await loadConversation(created.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteConversation = async (id: string) => {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      await deleteConversation(id)
      const list = await refreshConversations()
      if (list.length === 0) {
        const created = await createConversation()
        const refreshed = await refreshConversations()
        setConversations(refreshed)
        await loadConversation(created.id)
      } else if (id === activeConversationId) {
        await loadConversation(list[0].id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

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
    if (!activeConversationId) {
      setError('Aucune conversation active')
      return
    }

    const conversationId = activeConversationId
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
      for (const item of toUpload) {
        await uploadDocuments(item.file, conversationId)
      }

      if (text) {
        const res = await sendChatMessage(text, {
          conversationId,
          attachments: attachments.length ? attachments : undefined,
        })
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: res.answer,
            citations: res.citations,
          },
        ])
        await refreshConversations()
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
    loading: loading || bootstrapping,
    error,
    conversations,
    activeConversationId,
    handleFileSelect,
    handleRemoveFile,
    handleSend,
    handleSelectConversation,
    handleNewConversation,
    handleDeleteConversation,
  }
}
