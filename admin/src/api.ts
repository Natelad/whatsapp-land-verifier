import { Submission } from './types'

declare global {
  interface Window {
    __API_BASE_URL?: string
  }
}

const API_BASE =
  (typeof window !== 'undefined' && window.__API_BASE_URL && String(window.__API_BASE_URL).trim()) ||
  'https://whatsapp-land-verifier-1.onrender.com'

function getAdminToken() {
  if (typeof window === 'undefined') return ''
  return sessionStorage.getItem('admin_token') || ''
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`
  const adminToken = getAdminToken()

  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(adminToken ? { 'x-admin-token': adminToken } : null),
      ...(init?.headers || {}),
    },
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = body?.error || `Request failed with status ${res.status}`
    throw new Error(`${msg} (url: ${url})`)
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
