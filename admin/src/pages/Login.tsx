import React, { useState } from 'react'
import { api } from '../api'
import zlcLogo from '../ZLC.jpg'

export default function Login() {
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Persist token for subsequent API calls
      sessionStorage.setItem('admin_token', token)
      window.location.reload()
    } catch (err: any) {
      sessionStorage.removeItem('admin_token')
      setError(err?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <img src={zlcLogo} alt="ZLC Logo" className="login-logo-img" onError={(e) => { e.currentTarget.style.display = 'none' }} />
        <h1 className="login-title">ZLC Admin Portal</h1>
        <p className="login-subtitle">Zimbabwe Land Commission - Enter your admin access token to view and verify land submissions.</p>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#000', fontWeight: 600 }}>Admin Token</span>
            <input
              className="login-input"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              type="password"
              autoComplete="current-password"
              placeholder="Enter your admin token"
              required
            />
          </label>

          {error ? (
            <div className="error-alert" style={{ margin: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {error}
            </div>
          ) : null}

          <button
            className="login-btn"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Authenticating…' : 'Sign In'}
          </button>

          <p className="login-footer">
            Token is stored in your browser session only.
          </p>
        </form>
      </div>
    </div>
  )
}
