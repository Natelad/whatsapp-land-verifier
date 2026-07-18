import React, { useState } from 'react'
import { api } from '../api'

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
    <div style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial', padding: 24 }}>
      <div
        style={{
          maxWidth: 520,
          margin: '72px auto',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 16,
          padding: 26,
          boxShadow: '0 6px 18px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <h1 style={{ margin: 0, fontSize: 22, letterSpacing: -0.2 }}>Admin Login</h1>
          <span style={{ color: '#6b7280', fontSize: 12 }}>Secure access</span>
        </div>

        <p style={{ margin: '10px 0 0', color: '#4b5563', lineHeight: 1.5 }}>
          Enter your admin access token to view and verify submissions.
        </p>

        <form
          onSubmit={onSubmit}
          style={{
            marginTop: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>Admin token</span>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              type="password"
              autoComplete="current-password"
              style={{
                padding: '12px 12px',
                borderRadius: 12,
                border: '1px solid #e5e7eb',
                outline: 'none',
                fontSize: 14,
                background: '#fff',
              }}
              placeholder="Enter token"
              required
            />
          </label>

          {error ? (
            <div
              style={{
                color: '#b91c1c',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                padding: '10px 12px',
                borderRadius: 12,
                fontSize: 13,
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid #111827',
              background: loading ? '#f3f4f6' : '#111827',
              color: loading ? '#6b7280' : '#ffffff',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {loading ? 'Checking…' : 'Login'}
          </button>

          <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>
            Token is stored only in this browser (sessionStorage).
          </div>
        </form>
      </div>
    </div>
  )
}
