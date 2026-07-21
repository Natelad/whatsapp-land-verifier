export type LandSubmissionStatus = 'Pending' | 'Verified' | 'Rejected'

export type Submission = {
  id: string
  plot_number: string

  // Separate name & surname (instead of a single owner_name string)
  first_name: string | null
  last_name: string | null

  // Farm details
  farm_name: string | null
  gender: string | null

  national_id: string | null
  wa_id: string
  from_phone: string | null

  status: LandSubmissionStatus
  verified_by: string | null
  verified_at: string | null

  rejected_by: string | null
  rejected_at: string | null
  rejection_reason: string | null

  wa_message_id: string | null
  wa_flow_token: string | null

  created_at: string
  updated_at: string
}

export type DashboardStats = {
  total: number
  pending: number
  verified: number
  rejected: number
  approvalRate: number
  rejectionRate: number
  avgTurnaroundHours: number | null
}

export type SubmissionFilters = {
  status: string
  search: string
  date_from: string
  date_to: string
  sort_by: string
  sort_order: string
  page: number
  limit: number
}

export type PaginatedResult = {
  ok: boolean
  items: Submission[]
  total: number
  page: number
  limit: number
}

export const REJECTION_TEMPLATES = [
  { value: 'Illegible document', label: 'Illegible Document' },
  { value: 'Coordinates out of bounds', label: 'Coordinates Out of Bounds' },
  { value: 'ID mismatch', label: 'ID / National ID Mismatch' },
  { value: 'Duplicate submission', label: 'Duplicate Submission' },
  { value: 'Incomplete information', label: 'Incomplete Information' },
  { value: 'Plot not found in registry', label: 'Plot Not Found in Registry' },
  { value: 'Invalid documentation', label: 'Invalid Documentation' },
  { value: 'custom', label: 'Custom Reason...' },
]
