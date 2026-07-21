import React, { useEffect, useState } from 'react'
import { api } from '../api'
import { DashboardStats } from '../types'

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadStats() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getDashboardStats()
      setStats(data)
    } catch (e: any) {
      setError(e?.message || 'Failed to load dashboard stats')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  if (loading && !stats) {
    return (
      <div className="loading-state" style={{ padding: 48, textAlign: 'center' }}>
        <div className="spinner" />
        <p>Loading dashboard...</p>
      </div>
    )
  }

  if (error && !stats) {
    return (
      <div className="error-state" style={{ padding: 48, textAlign: 'center' }}>
        <p style={{ color: '#e53e3e' }}>{error}</p>
        <button className="refresh-btn" onClick={loadStats} style={{ marginTop: 12 }}>Retry</button>
      </div>
    )
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of land verification activity</p>
        </div>
        <button className="refresh-btn" onClick={loadStats} disabled={loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card stat-total">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats?.total ?? 0}</div>
            <div className="stat-label">Total Submissions</div>
          </div>
        </div>

        <div className="stat-card stat-pending">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats?.pending ?? 0}</div>
            <div className="stat-label">Pending Review</div>
          </div>
        </div>

        <div className="stat-card stat-verified">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats?.verified ?? 0}</div>
            <div className="stat-label">Verified</div>
          </div>
        </div>

        <div className="stat-card stat-rejected">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats?.rejected ?? 0}</div>
            <div className="stat-label">Rejected</div>
          </div>
        </div>
      </div>

      <div className="stats-secondary-grid">
        <div className="stat-card-secondary">
          <div className="stat-secondary-label">Approval Rate</div>
          <div className="stat-secondary-value">{stats?.approvalRate ?? 0}%</div>
          <div className="stat-bar-track">
            <div
              className="stat-bar-fill stat-bar-success"
              style={{ width: `${stats?.approvalRate ?? 0}%` }}
            />
          </div>
        </div>

        <div className="stat-card-secondary">
          <div className="stat-secondary-label">Rejection Rate</div>
          <div className="stat-secondary-value">{stats?.rejectionRate ?? 0}%</div>
          <div className="stat-bar-track">
            <div
              className="stat-bar-fill stat-bar-danger"
              style={{ width: `${stats?.rejectionRate ?? 0}%` }}
            />
          </div>
        </div>

        <div className="stat-card-secondary">
          <div className="stat-secondary-label">Avg. Turnaround Time</div>
          <div className="stat-secondary-value">
            {stats?.avgTurnaroundHours != null
              ? `${stats.avgTurnaroundHours} hrs`
              : 'N/A'}
          </div>
          <div className="stat-secondary-desc">
            {stats?.avgTurnaroundHours != null
              ? 'Average time from submission to verification'
              : 'No verified submissions yet'}
          </div>
        </div>
      </div>
    </div>
  )
}
