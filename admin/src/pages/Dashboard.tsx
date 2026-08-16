import React, { useEffect, useState } from 'react'
import { api } from '../api'
import { DashboardStats } from '../types'
import { CheckCircleIcon, ClockIcon, DocumentIcon, RefreshIcon, XCircleIcon } from '../components/icons'

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
          <RefreshIcon />
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card stat-total">
          <div className="stat-icon">
            <DocumentIcon size={24} detailed />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats?.total ?? 0}</div>
            <div className="stat-label">Total Submissions</div>
          </div>
        </div>

        <div className="stat-card stat-pending">
          <div className="stat-icon">
            <ClockIcon size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats?.pending ?? 0}</div>
            <div className="stat-label">Pending Review</div>
          </div>
        </div>

        <div className="stat-card stat-verified">
          <div className="stat-icon">
            <CheckCircleIcon size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats?.verified ?? 0}</div>
            <div className="stat-label">Verified</div>
          </div>
        </div>

        <div className="stat-card stat-rejected">
          <div className="stat-icon">
            <XCircleIcon size={24} />
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
