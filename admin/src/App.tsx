import React, { useState } from 'react'
import PendingSubmissions from './pages/PendingSubmissions'
import AllSubmissions from './pages/AllSubmissions'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import zlcLogo from './ZLC.jpg'

type Tab = 'dashboard' | 'pending' | 'all'

function hasAdminToken() {
  if (typeof window === 'undefined') return false
  return Boolean(sessionStorage.getItem('admin_token'))
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')

  if (!hasAdminToken()) {
    return <Login />
  }

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <div className="admin-header-left">
          <img src={zlcLogo} alt="ZLC Logo" className="admin-logo-img" />
          <div>
            <div className="admin-header-title">ZLC Admin</div>
            <div className="admin-header-subtitle">Zimbabwe Land Commission Dashboard</div>
          </div>
        </div>
        <div className="admin-header-right">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              sessionStorage.removeItem('admin_token')
              window.location.reload()
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      </header>
      <nav className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          Dashboard
        </button>
        <button
          className={`admin-tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Pending Review
        </button>
        <button
          className={`admin-tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          All Submissions
        </button>
      </nav>
      <main className="admin-content">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'pending' && <PendingSubmissions />}
        {activeTab === 'all' && <AllSubmissions />}
      </main>
    </div>
  )
}
