import React, { useEffect, useState } from 'react'
import { api } from '../api'
import { Submission } from '../types'
import SubmissionDetails from './SubmissionDetails'
import { formatFullName, formatLocationLine } from '../utils/format'
import { DocumentIcon, EyeIcon, PinIcon, RefreshIcon, XCircleIcon } from '../components/icons'

export default function PendingSubmissions() {
  const [items, setItems] = useState<Submission[]>([])
  const [selected, setSelected] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const rows = await api.listPendingSubmissions()
      setItems(rows)
    } catch (e: any) {
      setError(e?.message || 'Failed to load submissions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function onActionDone() {
    await load()
    setSelected(null)
  }

  return (
    <div className="pending-submissions-layout">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Pending Verifications</h1>
          <p className="page-subtitle">Review and verify land ownership submissions</p>
        </div>
        <button className="refresh-btn" onClick={load} disabled={loading}>
          <RefreshIcon />
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="submissions-grid">
        {/* Left panel: Submission list */}
        <div className="submissions-list-panel">
          <div className="panel-header">
            <h2 className="panel-title">All Submissions</h2>
            <span className="badge-count">{items.length} pending</span>
          </div>

          {loading && items.length === 0 ? (
            <div className="loading-state">
              <div className="spinner" />
              <p>Loading submissions...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <XCircleIcon size={40} stroke="#e53e3e" strokeWidth={1.5} />
              <p>{error}</p>
              <button className="retry-btn" onClick={load}>Try Again</button>
            </div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <DocumentIcon size={48} stroke="#a0aec0" strokeWidth={1.5} detailed />
              <p className="empty-title">No Pending Submissions</p>
              <p className="empty-desc">All land submissions have been reviewed.</p>
            </div>
          ) : (
            <div className="submissions-list">
              {items.map((it) => (
                <button
                  key={it.id}
                  onClick={() => setSelected(it)}
                  className={`submission-item ${selected?.id === it.id ? 'selected' : ''}`}
                >
                  <div className="submission-item-main">
                    <div className="submission-plot-badge">
                      <PinIcon size={16} />
                      Plot {it.plot_number}
                    </div>
                    <div className="submission-meta">
                      {formatFullName(it.first_name, it.last_name)}
                    </div>
                    {formatLocationLine(it) && (
                      <div className="submission-meta-secondary">
                        {formatLocationLine(it)}
                      </div>
                    )}
                  </div>
                  <div className="submission-item-footer">
                    <span className="submission-id-label">{it.national_id || 'No ID'}</span>
                    <span className="submission-date">{new Date(it.created_at).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right panel: Details */}
        <div className="submissions-detail-panel">
          <div className="panel-header">
            <h2 className="panel-title">Submission Details</h2>
          </div>
          {!selected ? (
            <div className="select-prompt">
              <EyeIcon size={48} stroke="#a0aec0" strokeWidth={1.5} />
              <p className="select-title">Select a submission</p>
              <p className="select-desc">Click on a pending submission to view its details and take action.</p>
            </div>
          ) : (
            <SubmissionDetails submission={selected} onActionDone={onActionDone} />
          )}
        </div>
      </div>
    </div>
  )
}
