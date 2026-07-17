import { Submission } from './types'

const metaEnv = (import.meta as any).env || {}
const API_BASE = metaEnv.VITE_API_BASE_URL && String(metaEnv.VITE_API_BASE_URL).trim()
  ? String(metaEnv.VITE_API_BASE_URL).trim()
  : 'http://localhost:8080'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = body?.error || `Request failed with status ${res.status}`
    throw new Error(msg)
  }
  return body as T
}

export const api = {
  async listPendingSubmissions(): Promise<Submission[]> {
    const data = await request<{ ok: boolean; items: Submission[] }>(
      `/admin/submissions?status=Pending`
    )
    return data.items
  },

  async verifySubmission(id: string, admin_name?: string): Promise<Submission> {
    const data = await request<{ ok: boolean; submission: Submission }>(
      `/admin/submissions/${id}/verify`,
      {
        method: 'POST',
        body: JSON.stringify({ admin_name }),
      }
    )
    return data.submission
  },

  async rejectSubmission(id: string, rejection_reason: string, admin_name?: string): Promise<Submission> {
    const data = await request<{ ok: boolean; submission: Submission }>(
      `/admin/submissions/${id}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({ rejection_reason, admin_name }),
      }
    )
    return data.submission
  },
}
