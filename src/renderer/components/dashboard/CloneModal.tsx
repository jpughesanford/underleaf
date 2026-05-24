import React, { useState } from 'react'
import Modal from '../shared/Modal'

interface Props {
  projectsRoot: string
  onClose: () => void
  onCloned: (path: string, name: string) => void
}

export default function CloneModal({ projectsRoot, onClose, onCloned }: Props) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClone() {
    if (!url.trim()) { setError('URL is required'); return }
    setLoading(true)
    setError(null)
    try {
      const path = await window.api.cloneProject({ root: projectsRoot, url: url.trim() })
      const name = url.trim().replace(/\.git$/, '').split('/').pop() || 'project'
      onCloned(path, name)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clone repository')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Clone Repository" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>Repository URL</label>
          <input
            className="input"
            placeholder="https://git.overleaf.com/... or git@github.com:..."
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleClone()}
            autoFocus
          />
          <div style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>
            Supports Overleaf git bridge, GitHub, GitLab, Bitbucket, and self-hosted repos
          </div>
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 13 }}>
            <div className="spinner" style={{ color: 'var(--color-brand)' }} />
            Cloning repository... this may take a moment
          </div>
        )}

        {error && <div style={{ color: '#f87171', fontSize: 13 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleClone} disabled={loading || !url.trim()}>
            {loading ? 'Cloning...' : 'Clone'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
