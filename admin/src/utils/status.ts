export type StatusKey = 'pending' | 'verified' | 'rejected'

export function getStatusKey(status: string | null | undefined): StatusKey {
  switch (status?.toLowerCase()) {
    case 'verified': return 'verified'
    case 'rejected': return 'rejected'
    default: return 'pending'
  }
}

export function getStatusClass(status: string): string {
  return `status-${getStatusKey(status)}`
}

export function getStatusDotClass(status: string): string {
  return `dot-${getStatusKey(status)}`
}

export function getStatusLineClass(status: string): string {
  return `status-${getStatusKey(status)}-line`
}
