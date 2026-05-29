import React, { useState } from 'react'
import Modal from '@/ui/Modal'

interface Props {
  projectPath: string
  onClose: () => void
  onAdded: () => void
}

export default function AddRemoteModal({ projectPath, onClose, onAdded }: Props) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsForcePush, setNeedsForcePush] = useState(false)

  async function handleAdd() {
    if (!url.trim()) { setError('URL is required'); return }
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.git.addRemote(projectPath, url.trim())
      if (result.success) {
        if (result.needsForcePush) {
          setNeedsForcePush(true)
        } else {
          onAdded()
        }
      } else {
        setError(result.error || 'Failed to add remote')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleForcePush() {
    setLoading(true)
    try {
      const result = await window.api.git.forcePush(projectPath)
      if (result.success) {
        onAdded()
      } else {
        setError(result.error || 'Force push failed')
      }
    } finally {
      setLoading(false)
    }
  }

  if (needsForcePush) {
    return (
      <Modal title="Connect to Remote" onClose={onClose}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            padding: 12,
            background: 'var(--badge-warn-bg)',
            border: '1px solid var(--badge-warn-border)',
            borderRadius: 8,
            fontSize: 13,
            color: 'var(--badge-warn-color)',
          }}>
            Remote has only an empty initialization commit. Push your local work and overwrite it?
          </div>
          {error && <div className="form-error">{error}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-danger" onClick={handleForcePush} disabled={loading}>
              {loading ? 'Pushing...' : 'Overwrite Remote'}
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Connect to Remote" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', color: 'var(--color-text-secondary)', fontSize: 12, marginBottom: 6 }}>Remote URL</label>
          <input
            className="input"
            placeholder="https://git.overleaf.com/... or git@github.com:..."
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            autoFocus
          />
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
            Supports Overleaf git bridge, GitHub, GitLab, Bitbucket
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAdd} disabled={loading || !url.trim()}>
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
