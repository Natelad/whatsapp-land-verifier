import React, { useMemo, useState } from 'react'
import { api } from '../api'
import { Submission, REJECTION_TEMPLATES } from '../types'
import { getStatusKey } from '../utils/status'

export default function SubmissionDetails({
  submission,
  onActionDone,
}: {
  submission: Submission
  onActionDone: () => void
}) {
  const [verifying, setVerifying] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const prettyCreatedAt = useMemo(() => {
    try {
      return new Date(submission.created_at).toLocaleString()
    } catch {
      return submission.created_at
    }
  }, [submission.created_at])

  const statusClass = useMemo(() => getStatusKey(submission.status), [submission.status])

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  function handleTemplateChange(value: string) {
    setSelectedTemplate(value)
    if (value !== 'custom') {
      setRejectReason(value)
    } else {
      setRejectReason('')
    }
  }

  async function onVerify() {
    setError(null)
    setVerifying(true)
    try {
      await api.verifySubmission(submission.id, 'Bank Admin')
      showToast('success', `✅ Plot ${submission.plot_number} verified successfully! The applicant has been notified via WhatsApp.`)
      onActionDone()
    } catch (e: any) {
      const msg = e?.message || 'Failed to verify'
      setError(msg)
      showToast('error', msg)
    } finally {
      setVerifying(false)
    }
  }

  async function onReject() {
    setError(null)
    setRejecting(true)
    try {
      const reason = rejectReason.trim() || (selectedTemplate !== 'custom' ? selectedTemplate : 'Not verified')
      await api.rejectSubmission(submission.id, reason, 'Bank Admin')
      showToast('success', `❌ Plot ${submission.plot_number} has been rejected. The applicant has been notified via WhatsApp.`)
      onActionDone()
    } catch (e: any) {
      const msg = e?.message || 'Failed to reject'
      setError(msg)
      showToast('error', msg)
    } finally {
      setRejecting(false)
    }
  }

  async function onSendMessage() {
    if (!messageText.trim()) return
    setSendingMsg(true)
    setError(null)
    try {
      await api.sendMessage(submission.id, messageText.trim())
      showToast('success', 'Message sent to user via WhatsApp!')
      setMessageText('')
    } catch (e: any) {
      const msg = e?.message || 'Failed to send message'
      setError(msg)
      showToast('error', msg)
    } finally {
      setSendingMsg(false)
    }
  }

  return (
    <div className="detail-content">
      {/* Header */}
      <div className="detail-header">
        <div>
          <div className="detail-title">Plot {submission.plot_number}</div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>
            Submitted {prettyCreatedAt}
          </div>
        </div>
        <div className={`detail-status ${statusClass}`}>
          <span className="detail-status-dot" />
          {submission.status}
        </div>
      </div>

      {/* Fields */}
      <div className="detail-fields">
        <div className="detail-field">
          <span className="detail-field-label">Plot Number</span>
          <span className="detail-field-value">{submission.plot_number}</span>
        </div>
        <div className="detail-field">
          <span className="detail-field-label">First Name</span>
          <span className="detail-field-value">{submission.first_name || '—'}</span>
        </div>
        <div className="detail-field">
          <span className="detail-field-label">Last Name</span>
          <span className="detail-field-value">{submission.last_name || '—'}</span>
        </div>
        <div className="detail-field">
          <span className="detail-field-label">National ID</span>
          <span className="detail-field-value">{submission.national_id || '—'}</span>
        </div>
        <div className="detail-field">
          <span className="detail-field-label">WhatsApp ID</span>
          <span className="detail-field-value">{submission.wa_id}</span>
        </div>
        <div className="detail-field">
          <span className="detail-field-label">Farm Name</span>
          <span className="detail-field-value">{submission.farm_name || '—'}</span>
        </div>
        <div className="detail-field">
          <span className="detail-field-label">Gender</span>
          <span className="detail-field-value">{submission.gender || '—'}</span>
        </div>
        <div className="detail-field">
          <span className="detail-field-label">Province</span>
          <span className="detail-field-value">{submission.province || '—'}</span>
        </div>
        <div className="detail-field">
          <span className="detail-field-label">District</span>
          <span className="detail-field-value">{submission.district || '—'}</span>
        </div>
        <div className="detail-field">
          <span className="detail-field-label">Plot Farm Particulars Tenure Type</span>
          <span className="detail-field-value">{submission.tenure_type || '—'}</span>
        </div>
        {submission.tenure_type_other ? (
          <div className="detail-field">
            <span className="detail-field-label">Tenure Type Details</span>
            <span className="detail-field-value">{submission.tenure_type_other}</span>
          </div>
        ) : null}
      </div>

      {/* Error */}
      {error ? (
        <div className="error-alert">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {error}
        </div>
      ) : null}

      {/* Action Buttons */}
      <div className="detail-actions">
        <button
          className="btn btn-success btn-lg"
          onClick={onVerify}
          disabled={verifying || rejecting}
        >
          {verifying ? (
            <>
              <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, margin: 0 }} />
              Verifying…
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Verify & Notify
            </>
          )}
        </button>
        <button
          className="btn btn-danger btn-lg"
          onClick={onReject}
          disabled={verifying || rejecting}
        >
          {rejecting ? (
            <>
              <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, margin: 0 }} />
              Rejecting…
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Reject & Notify
            </>
          )}
        </button>
      </div>

      {/* Rejection Template */}
      <div className="rejection-section">
        <label className="rejection-label">
          Rejection Reason
          <span style={{ fontWeight: 400, color: 'var(--gray-400)' }}> (sent to user)</span>
        </label>
        <select
          className="rejection-select"
          value={selectedTemplate}
          onChange={(e) => handleTemplateChange(e.target.value)}
        >
          <option value="">— Select a reason —</option>
          {REJECTION_TEMPLATES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        {selectedTemplate === 'custom' && (
          <input
            className="rejection-input"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Type custom rejection reason..."
            style={{ marginTop: 8 }}
          />
        )}
        {selectedTemplate && selectedTemplate !== 'custom' && (
          <div className="rejection-preview">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            User will see: "{rejectReason}"
          </div>
        )}
      </div>

      {/* Direct Message */}
      <div className="direct-message-section">
        <label className="rejection-label">
          Send Direct WhatsApp Message
        </label>
        <textarea
          className="direct-message-input"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder="Type a message to send directly to the user..."
          rows={3}
        />
        <button
          className="btn btn-primary btn-lg"
          onClick={onSendMessage}
          disabled={sendingMsg || !messageText.trim()}
          style={{ marginTop: 8, width: '100%' }}
        >
          {sendingMsg ? (
            <>
              <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, margin: 0 }} />
              Sending…
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              Send Message
            </>
          )}
        </button>
      </div>

      {/* WhatsApp Notice */}
      <div className="whatsapp-notice">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        <span>
          <strong>WhatsApp notification:</strong> The user will receive a message via WhatsApp Cloud API after verification, rejection, or sending a direct message.
        </span>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
