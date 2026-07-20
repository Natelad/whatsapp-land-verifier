import React from 'react'
import PendingSubmissions from './pages/PendingSubmissions'
import Login from './pages/Login'

function hasAdminToken() {
  if (typeof window === 'undefined') return false
  return Boolean(sessionStorage.getItem('admin_token'))
}

export default function App() {
  if (!hasAdminToken()) {
    return <Login />
  }

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <div className="admin-header-left">
          <div className="admin-logo">L</div>
          <div>
            <div className="admin-header-title">Landbot Admin</div>
            <div className="admin-header-subtitle">Land Verification Dashboard</div>
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
      <main className="admin-content">
        <PendingSubmissions />
      </main>
    </div>
  )
}
