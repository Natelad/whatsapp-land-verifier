import { Submission, DashboardStats, PaginatedResult, SubmissionFilters } from './types'

declare global {
  interface ImportMetaEnv {
    VITE_API_BASE_URL?: string
  }
}

const API_BASE = (() => {
  const v = String(import.meta.env.VITE_API_BASE_URL || '').trim()
  if (!v) {
    throw new Error('Missing VITE_API_BASE_URL. Set it in Render for the Admin UI service.')
  }
  return v
})()

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

  async listAllSubmissions(filters: Partial<SubmissionFilters>): Promise<PaginatedResult> {
    const params = new URLSearchParams()
    if (filters.status && filters.status !== 'all') params.set('status', filters.status)
    if (filters.search) params.set('search', filters.search)
    if (filters.date_from) params.set('date_from', filters.date_from)
    if (filters.date_to) params.set('date_to', filters.date_to)
    if (filters.sort_by) params.set('sort_by', filters.sort_by)
    if (filters.sort_order) params.set('sort_order', filters.sort_order)
    if (filters.page) params.set('page', String(filters.page))
    if (filters.limit) params.set('limit', String(filters.limit))
    
    const qs = params.toString()
    return request<PaginatedResult>(`/admin/submissions${qs ? `?${qs}` : ''}`)
  },

  async getDashboardStats(): Promise<DashboardStats> {
    const data = await request<{ ok: boolean; stats: DashboardStats }>('/admin/stats')
    return data.stats
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

  async sendMessage(id: string, message: string): Promise<void> {
    await request(`/admin/submissions/${id}/message`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    })
  },

  getExportUrl(filters: Partial<SubmissionFilters>): string {
    const params = new URLSearchParams()
    if (filters.status && filters.status !== 'all') params.set('status', filters.status)
    if (filters.search) params.set('search', filters.search)
    if (filters.date_from) params.set('date_from', filters.date_from)
    if (filters.date_to) params.set('date_to', filters.date_to)
    const adminToken = getAdminToken()
    if (adminToken) params.set('token', adminToken)
    const qs = params.toString()
    return `${API_BASE}/admin/export${qs ? `?${qs}` : ''}`
  },
}
