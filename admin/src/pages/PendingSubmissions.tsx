import React, { useEffect, useState } from 'react'
import { api } from '../api'
import { Submission } from '../types'
import SubmissionDetails from './SubmissionDetails'

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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
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
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e53e3e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <p>{error}</p>
              <button className="retry-btn" onClick={load}>Try Again</button>
            </div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#a0aec0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      Plot {it.plot_number}
                    </div>
                    <div className="submission-meta">
                      {(it.first_name || it.last_name)
                        ? `${it.first_name || ''} ${it.last_name || ''}`.trim()
                        : '—'}
                    </div>
                    {(it.province || it.district || it.tenure_type) && (
                      <div className="submission-meta-secondary">
                        {it.province || it.district ? `${it.province || ''}${it.province && it.district ? ' / ' : ''}${it.district || ''}` : ''}
                        {it.province || it.district ? (it.tenure_type ? ` · ${it.tenure_type}` : '') : it.tenure_type || ''}
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
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#a0aec0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
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
