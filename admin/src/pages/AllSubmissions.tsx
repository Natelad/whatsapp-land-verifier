import React, { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import { Submission, SubmissionFilters, REJECTION_TEMPLATES } from '../types'
import SubmissionDetails from './SubmissionDetails'

export default function AllSubmissions() {
  const [items, setItems] = useState<Submission[]>([])
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    status: 'all',
    search: '',
    date_from: '',
    date_to: '',
    sort_by: 'created_at',
    sort_order: 'desc',
    page: 1,
    limit: 20,
  })
  const [searchInput, setSearchInput] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const result = await api.listAllSubmissions(filters)
      setItems(result.items)
      setTotal(result.total)
    } catch (e: any) {
      setError(e?.message || 'Failed to load submissions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [filters])

  const totalPages = Math.ceil(total / filters.limit)

  function handleSearch() {
    setFilters(prev => ({ ...prev, search: searchInput, page: 1 }))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch()
  }

  function handleExport() {
    const url = api.getExportUrl(filters)
    window.open(url, '_blank')
  }

  async function onActionDone() {
    await load()
    setSelected(null)
  }

  function getStatusClass(status: string) {
    switch (status?.toLowerCase()) {
      case 'verified': return 'status-verified'
      case 'rejected': return 'status-rejected'
      default: return 'status-pending'
    }
  }

  return (
    <div className="all-submissions-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">All Submissions</h1>
          <p className="page-subtitle">{total} total submissions</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="refresh-btn" onClick={handleExport}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
          <button className="refresh-btn" onClick={load} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, ID, plot number, phone..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <select
          value={filters.status}
          onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
        >
          <option value="all">All Status</option>
          <option value="Pending">Pending</option>
          <option value="Verified">Verified</option>
          <option value="Rejected">Rejected</option>
        </select>

        <input
          type="date"
          value={filters.date_from}
          onChange={(e) => setFilters(prev => ({ ...prev, date_from: e.target.value, page: 1 }))}
          placeholder="From date"
          title="From date"
        />

        <input
          type="date"
          value={filters.date_to}
          onChange={(e) => setFilters(prev => ({ ...prev, date_to: e.target.value, page: 1 }))}
          placeholder="To date"
          title="To date"
        />

        <select
          value={`${filters.sort_by}-${filters.sort_order}`}
          onChange={(e) => {
            const [sort_by, sort_order] = e.target.value.split('-')
            setFilters(prev => ({ ...prev, sort_by, sort_order, page: 1 }))
          }}
        >
          <option value="created_at-desc">Newest First</option>
          <option value="created_at-asc">Oldest First</option>
          <option value="plot_number-asc">Plot (A-Z)</option>
          <option value="plot_number-desc">Plot (Z-A)</option>
        </select>
      </div>

      <div className="submissions-table-layout">
        {/* Table */}
        <div className="submissions-table-panel">
          {loading && items.length === 0 ? (
            <div className="loading-state">
              <div className="spinner" />
              <p>Loading submissions...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <p style={{ color: '#e53e3e' }}>{error}</p>
            </div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#a0aec0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <p>No submissions found</p>
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="submissions-table">
                  <thead>
                    <tr>
                      <th>Plot #</th>
                      <th>Applicant</th>
                      <th>National ID</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr
                        key={it.id}
                        onClick={() => setSelected(it)}
                        className={selected?.id === it.id ? 'selected' : ''}
                      >
                        <td>
                          <span className="plot-badge">{it.plot_number}</span>
                        </td>
                        <td>
                          {[it.first_name, it.last_name].filter(Boolean).join(' ') || '—'}
                        </td>
                        <td className="cell-muted">{it.national_id || '—'}</td>
                        <td>
                          <span className={`status-chip ${getStatusClass(it.status)}`}>
                            {it.status}
                          </span>
                        </td>
                        <td className="cell-muted">
                          {new Date(it.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="pagination">
                <span className="pagination-info">
                  Page {filters.page} of {totalPages} ({total} total)
                </span>
                <div className="pagination-controls">
                  <button
                    className="btn btn-outline btn-sm"
                    disabled={filters.page <= 1}
                    onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                  >
                    Previous
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    disabled={filters.page >= totalPages}
                    onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Detail Panel */}
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
              <p className="select-desc">Click on a row to view details and take action.</p>
            </div>
          ) : (
            <SubmissionDetails submission={selected} onActionDone={onActionDone} />
          )}
        </div>
      </div>
    </div>
  )
}
