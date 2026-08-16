import React, { useEffect, useState, useRef } from 'react'
import { api } from '../api'
import { Submission } from '../types'
import SubmissionDetails from './SubmissionDetails'
import { getStatusClass, getStatusDotClass, getStatusLineClass } from '../utils/status'
import { formatFullName, formatLocationLine, getInitials } from '../utils/format'
import { CheckCircleIcon, ClockIcon, DocumentIcon, PinIcon, RefreshIcon, XCircleIcon, EyeIcon } from '../components/icons'

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
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  function handleSearchChange(value: string) {
    setSearchInput(value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: value, page: 1 }))
    }, 500)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      setFilters(prev => ({ ...prev, search: searchInput, page: 1 }))
    }
  }

  function handleExport() {
    const url = api.getExportUrl(filters)
    window.open(url, '_blank')
  }

  async function onActionDone() {
    await load()
    setSelected(null)
  }

  function hasActiveFilters(): boolean {
    return filters.status !== 'all' || filters.search !== '' || filters.date_from !== '' || filters.date_to !== ''
  }

  function getActiveFilterCount(): number {
    let count = 0
    if (filters.status !== 'all') count++
    if (filters.search !== '') count++
    if (filters.date_from !== '') count++
    if (filters.date_to !== '') count++
    return count
  }

  function clearAllFilters() {
    setSearchInput('')
    setFilters(prev => ({
      ...prev,
      status: 'all',
      search: '',
      date_from: '',
      date_to: '',
      page: 1,
    }))
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'Pending': return 'Pending'
      case 'Verified': return 'Verified'
      case 'Rejected': return 'Rejected'
      default: return status
    }
  }

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  return (
    <div className="all-submissions-page">
      {/* Page Header */}
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
            <RefreshIcon />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Summary Stats Bar */}
      <div className="submissions-stats-bar">
        <div className="submissions-stat-item">
          <div className="submissions-stat-icon stat-total-icon">
            <DocumentIcon size={18} />
          </div>
          <div className="submissions-stat-info">
            <div className="submissions-stat-value">{total}</div>
            <div className="submissions-stat-label">Total</div>
          </div>
        </div>
        <div className="submissions-stat-item">
          <div className="submissions-stat-icon stat-pending-icon">
            <ClockIcon size={18} />
          </div>
          <div className="submissions-stat-info">
            <div className="submissions-stat-value">{items.filter(i => i.status === 'Pending').length}</div>
            <div className="submissions-stat-label">Pending</div>
          </div>
        </div>
        <div className="submissions-stat-item">
          <div className="submissions-stat-icon stat-verified-icon">
            <CheckCircleIcon size={18} />
          </div>
          <div className="submissions-stat-info">
            <div className="submissions-stat-value">{items.filter(i => i.status === 'Verified').length}</div>
            <div className="submissions-stat-label">Verified</div>
          </div>
        </div>
        <div className="submissions-stat-item">
          <div className="submissions-stat-icon stat-rejected-icon">
            <XCircleIcon size={18} />
          </div>
          <div className="submissions-stat-info">
            <div className="submissions-stat-value">{items.filter(i => i.status === 'Rejected').length}</div>
            <div className="submissions-stat-label">Rejected</div>
          </div>
        </div>
      </div>

      {/* Active Filters Bar */}
      {hasActiveFilters() && (
        <div className="active-filters-bar">
          <span className="active-filters-label">Active Filters ({getActiveFilterCount()}):</span>
          {filters.status !== 'all' && (
            <span className="active-filter-chip">
              Status: {getStatusLabel(filters.status)}
            </span>
          )}
          {filters.search !== '' && (
            <span className="active-filter-chip">
              Search: "{filters.search}"
            </span>
          )}
          {filters.date_from !== '' && (
            <span className="active-filter-chip">
              From: {filters.date_from}
            </span>
          )}
          {filters.date_to !== '' && (
            <span className="active-filter-chip">
              To: {filters.date_to}
            </span>
          )}
          <button className="clear-filters-link" onClick={clearAllFilters}>
            Clear all filters
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, ID, plot number, province, district, tenure type, phone..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
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
        {/* Table Panel */}
        <div className="submissions-table-panel">
          {loading && items.length === 0 ? (
            <div className="loading-state">
              <div className="spinner" />
              <p>Loading submissions...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <p>{error}</p>
              <button className="retry-btn" onClick={load}>Try Again</button>
            </div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <DocumentIcon size={48} strokeWidth={1.5} />
              <p className="empty-title">No submissions found</p>
              {hasActiveFilters() ? (
                <p className="empty-desc">Try adjusting your search or filter criteria.</p>
              ) : (
                <p className="empty-desc">No submissions have been received yet.</p>
              )}
            </div>
          ) : (
            <>
              {loading && (
                <div style={{ padding: '8px 16px', background: 'var(--primary-light)', fontSize: 13, color: 'var(--primary)', fontWeight: 500, textAlign: 'center', borderBottom: '1px solid var(--gray-100)' }}>
                  Refreshing...
                </div>
              )}
              <div className="table-wrapper">
                <table className="submissions-table">
                  <thead>
                    <tr>
                      <th style={{ width: 3, padding: 0 }}></th>
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
                        <td className="table-row-indicator">
                          <span className={`status-line ${getStatusLineClass(it.status)}`} />
                        </td>
                        <td>
                          <span className="plot-badge-large">
                            <PinIcon size={12} />
                            {it.plot_number}
                          </span>
                        </td>
                        <td>
                          <div className="applicant-cell">
                            <div className="applicant-avatar">
                              {getInitials(it.first_name, it.last_name)}
                            </div>
                            <div>
                              <div className="applicant-name">
                                {formatFullName(it.first_name, it.last_name)}
                              </div>
                              {it.farm_name && (
                                <div className="applicant-id">{it.farm_name}</div>
                              )}
                              {formatLocationLine(it) && (
                                <div className="applicant-id" style={{ color: 'var(--gray-500)', fontSize: 12, marginTop: 2 }}>
                                  {formatLocationLine(it)}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="cell-muted">{it.national_id || '—'}</td>
                        <td>
                          <span className={`status-chip ${getStatusClass(it.status)}`}>
                            <span className={`status-dot ${getStatusDotClass(it.status)}`} />
                            {it.status}
                          </span>
                        </td>
                        <td className="cell-muted">
                          {new Date(it.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="pagination">
                <span className="pagination-info">
                  Showing page <strong>{filters.page}</strong> of <strong>{totalPages}</strong> · <strong>{total}</strong> total submissions
                </span>
                <div className="pagination-controls">
                  <button
                    className="btn btn-outline btn-sm"
                    disabled={filters.page <= 1}
                    onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    Previous
                  </button>
                  <span className="pagination-page-indicator">{filters.page} / {totalPages}</span>
                  <button
                    className="btn btn-outline btn-sm"
                    disabled={filters.page >= totalPages}
                    onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                  >
                    Next
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
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
            {selected && (
              <button className="close-panel-btn" onClick={() => setSelected(null)} title="Close details">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          {!selected ? (
            <div className="select-prompt">
              <EyeIcon size={48} strokeWidth={1.5} />
              <p className="select-title">Select a submission</p>
              <p className="select-desc">Click on a row to view full details and take action.</p>
            </div>
          ) : (
            <SubmissionDetails submission={selected} onActionDone={onActionDone} />
          )}
        </div>
      </div>
    </div>
  )
}
