export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

export async function apiFetch(path: string, init?: RequestInit){
    const res = await fetch(`${API_BASE_URL}${path}`, init);
    if(!res.ok)throw new Error(await res.text());
    return res
}