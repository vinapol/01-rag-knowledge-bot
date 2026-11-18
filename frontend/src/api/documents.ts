import { apiFetch } from './client'

export type UploadDocumentResponse = {
  id: string
  filename: string
  status: string
  size_bytes: number
  chunks_count: number
  error_message: string | null
  conversation_id: string
}

export async function uploadDocuments(
  file: File,
  conversationId: string,
): Promise<UploadDocumentResponse> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('conversation_id', conversationId)
  const res = await apiFetch('/api/v1/documents', {
    method: 'POST',
    body: formData,
  })
  return res.json()
}

export async function listDocuments(conversationId?: string) {
  const qs = conversationId
    ? `?conversation_id=${encodeURIComponent(conversationId)}`
    : ''
  const res = await apiFetch(`/api/v1/documents${qs}`, {
    method: 'GET',
  })
  return res.json()
}

export async function deleteDocument(id: string) {
  const res = await apiFetch(`/api/v1/documents/${id}`, {
    method: 'DELETE',
  })
  return res.json()
}
