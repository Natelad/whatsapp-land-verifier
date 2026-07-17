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
