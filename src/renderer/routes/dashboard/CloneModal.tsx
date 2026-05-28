import React, { useState } from 'react'
import Modal from '@/ui/Modal'
import { extractGitUrl, repoNameFromUrl } from '@shared/git-url'

interface Props {
  projectsRoot: string
  onClose: () => void
  onCloned: (path: string, name: string) => void
}

export default function CloneModal({ projectsRoot, onClose, onCloned }: Props) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleUrlChange(value: string) {
    const parsed = extractGitUrl(value)
    setUrl(parsed)
    if (!nameTouched) setName(repoNameFromUrl(parsed))
  }

  async function handleClone() {
    const finalUrl = url.trim()
    const finalName = name.trim() || repoNameFromUrl(finalUrl)
    if (!finalUrl) { setError('URL is required'); return }
    if (!finalName) { setError('Project name is required'); return }
    setLoading(true)
    setError(null)
    try {
      const path = await window.api.projects.clone({ root: projectsRoot, url: finalUrl, name: finalName })
      onCloned(path, finalName)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clone repository')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Clone Repository" onClose={onClose}>
      <div className="form-section">
        <div className="form-field">
          <label className="form-field-label">Repository URL</label>
          <input
            className="input"
            placeholder="https://git.overleaf.com/… or git@github.com:…"
            value={url}
            onChange={e => handleUrlChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleClone()}
            autoFocus
          />
          <div className="form-field-hint">
            Supports Overleaf, GitHub, GitLab, Bitbucket, and self-hosted repositories.
          </div>
        </div>

        <div className="form-field">
          <label className="form-field-label">Project Name</label>
          <input
            className="input"
            placeholder="my-paper"
            value={name}
            onChange={e => { setName(e.target.value); setNameTouched(true) }}
            onKeyDown={e => e.key === 'Enter' && handleClone()}
          />
          <div className="form-field-hint">
            Cloned into <code>{projectsRoot}/{name || '…'}</code>
          </div>
        </div>

        {loading && (
          <div className="form-loading">
            <div className="spinner" style={{ color: 'var(--color-brand)' }} />
            Cloning repository… this may take a moment
          </div>
        )}

        {error && <div className="form-error selectable">{error}</div>}

        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleClone} disabled={loading || !url.trim() || !name.trim()}>
            {loading ? 'Cloning…' : 'Clone'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
