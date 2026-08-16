import { Submission } from '../types'

export function formatFullName(
  first: string | null,
  last: string | null,
  fallback = '—'
): string {
  return [first, last].filter(Boolean).join(' ').trim() || fallback
}

export function getInitials(first: string | null, last: string | null): string {
  const f = first?.charAt(0) || ''
  const l = last?.charAt(0) || ''
  return (f + l) || '?'
}

export function formatLocationLine(
  sub: Pick<Submission, 'province' | 'district' | 'tenure_type'>
): string {
  const region = [sub.province, sub.district].filter(Boolean).join(' / ')
  if (region) return sub.tenure_type ? `${region} · ${sub.tenure_type}` : region
  return sub.tenure_type || ''
}
