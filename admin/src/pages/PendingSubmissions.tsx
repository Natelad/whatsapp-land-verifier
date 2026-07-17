import React, { useEffect, useState } from 'react'
import { api } from '../api'
import { Submission } from '../types'
import SubmissionDetails from './SubmissionDetails'

export default function PendingSubmissions() {
  const [items, setItems] = useState<Submission[]>([])
  const [selected, setSelected] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const rows = await api.listPendingSubmissions()
      setItems(rows)
    } catch (e: any) {
      setError(e?.message || 'Failed to load submissions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function onActionDone() {
    await load()
    setSelected(null)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Pending submissions</h2>
        {loading ? <p>Loading…</p> : null}
        {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}

        {!loading && !error ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {items.length === 0 ? <p>No pending items.</p> : null}
            {items.map((it) => (
              <button
                key={it.id}
                onClick={() => setSelected(it)}
                style={{
                  textAlign: 'left',
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid #eee',
                  background: selected?.id === it.id ? '#f3f7ff' : '#fff',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 600 }}>Plot {it.plot_number}</div>
                <div style={{ color: '#555', fontSize: 13 }}>
                  {(it.first_name || it.last_name)
                    ? `${it.first_name || ''} ${it.last_name || ''}`.trim()
                    : '—'}{' '}
                  · {it.national_id ? it.national_id : 'No ID'}
                </div>
                <div style={{ color: '#777', fontSize: 12 }}>
                  Submitted: {new Date(it.created_at).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Details</h2>
        {!selected ? <p style={{ color: '#666' }}>Select an item to verify.</p> : null}
        {selected ? (
          <SubmissionDetails submission={selected} onActionDone={onActionDone} />
        ) : null}
      </div>
    </div>
  )
}
