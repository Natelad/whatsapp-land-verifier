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
    <div style={{ fontFamily: 'system-ui, Arial', padding: 24, maxWidth: 1100 }}>
      <h1 style={{ margin: 0 }}>Landbot Admin</h1>
      <p style={{ marginTop: 8, color: '#444' }}>Verify WhatsApp land form submissions</p>
      <PendingSubmissions />
    </div>
  )
}
