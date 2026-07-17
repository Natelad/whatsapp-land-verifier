import React from 'react'
import PendingSubmissions from './pages/PendingSubmissions'

export default function App() {
  return (
    <div style={{ fontFamily: 'system-ui, Arial', padding: 24, maxWidth: 1100 }}>
      <h1 style={{ margin: 0 }}>Landbot Admin</h1>
      <p style={{ marginTop: 8, color: '#444' }}>
        Verify WhatsApp land form submissions
      </p>
      <PendingSubmissions />
    </div>
  )
}
