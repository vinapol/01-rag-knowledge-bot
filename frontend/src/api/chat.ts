import { apiFetch } from './client';

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
}

export async function sendChatMessage(
    message: string,
    options: { topK?: number; documentIds?: string[] } = {},
): Promise<ChatResponse> {
    const { topK = 5, documentIds } = options
    const res = await apiFetch('/api/v1/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message,
            top_k: topK,
            document_ids: documentIds?.length ? documentIds : undefined,
        }),
    })
    return res.json()
}
