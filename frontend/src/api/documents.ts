import { apiFetch } from './client';

export type UploadDocumentResponse = {
    id: string
    filename: string
    status: string
    size_bytes: number
    chunks_count: number
    error_message: string | null
}

export async function uploadDocuments(file: File): Promise<UploadDocumentResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiFetch('/api/v1/documents', {
        method: 'POST',
        body: formData,
    });
    return res.json();
}

export async function listDocuments() {
    const res = await apiFetch('/api/v1/documents', {
        method: 'GET',
    });
    return res.json();
}

export async function deleteDocument(id: string) {
    const res = await apiFetch(`/api/v1/documents/${id}`, {
        method: 'DELETE',
    });
    return res.json();
}
