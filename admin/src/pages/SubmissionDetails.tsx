import React, { useMemo, useState } from 'react'
import { api } from '../api'
import { Submission } from '../types'

export default function SubmissionDetails({
  submission,
  onActionDone,
}: {
  submission: Submission
  onActionDone: () => void
}) {
  const [verifying, setVerifying] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('Not verified')
  const [error, setError] = useState<string | null>(null)

  const prettyCreatedAt = useMemo(() => {
    try {
      return new Date(submission.created_at).toLocaleString()
    } catch {
      return submission.created_at
    }
  }, [submission.created_at])

  async function onVerify() {
    setError(null)
    setVerifying(true)
    try {
      const res = await api.verifySubmission(submission.id, 'Bank Admin')
      // optional: could update local state from `res`
      onActionDone()
    } catch (e: any) {
      setError(e?.message || 'Failed to verify')
    } finally {
      setVerifying(false)
    }
  }

  async function onReject() {
    setError(null)
    setRejecting(true)
    try {
      const res = await api.rejectSubmission(submission.id, rejectReason, 'Bank Admin')
      onActionDone()
    } catch (e: any) {
      setError(e?.message || 'Failed to reject')
    } finally {
      setRejecting(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Plot {submission.plot_number}</h3>
        <div style={{ fontSize: 12, color: '#666' }}>Submitted: {prettyCreatedAt}</div>
      </div>

      <div style={{ marginTop: 12, borderTop: '1px solid #eee', paddingTop: 12, display: 'grid', gap: 8 }}>
        <Row label="Owner name" value={submission.owner_name || '—'} />
        <Row label="National ID" value={submission.national_id || '—'} />
        <Row label="WhatsApp ID" value={submission.wa_id} />
        <Row label="Status" value={submission.status} />
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={onVerify}
          disabled={verifying || rejecting}
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid #0b6',
            background: '#0b6',
            color: 'white',
            cursor: 'pointer',
            opacity: verifying ? 0.8 : 1,
          }}
        >
          {verifying ? 'Verifying…' : 'Verify'}
        </button>

        <div style={{ flex: '1 1 220px', minWidth: 220 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#555', marginBottom: 6 }}>
            Rejection reason (optional)
          </label>
          <input
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }}
            placeholder="Reason"
          />
          <button
            onClick={onReject}
            disabled={verifying || rejecting}
            style={{
              marginTop: 10,
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #c33',
              background: '#c33',
              color: 'white',
              cursor: 'pointer',
              width: '100%',
              opacity: rejecting ? 0.8 : 1,
            }}
          >
            {rejecting ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </div>

      {error ? (
        <div style={{ marginTop: 12, color: 'crimson', fontWeight: 600 }}>
          {error}
        </div>
      ) : null}

      <div style={{ marginTop: 14, fontSize: 12, color: '#777' }}>
        Verification will trigger a WhatsApp message back to the user via Meta Cloud API.
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ color: '#666', fontSize: 13 }}>{label}</div>
      <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 }}>{value}</div>
    </div>
  )
}
