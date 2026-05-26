import React, { useState } from 'react'
import Modal from '../shared/Modal'

const TEMPLATES = [
  { id: 'article', label: 'Article', description: 'Standard LaTeX article' },
  { id: 'beamer', label: 'Beamer', description: 'Presentation slides' },
  { id: 'thesis', label: 'Thesis', description: 'Multi-chapter thesis/report' },
]

interface Props {
  projectsRoot: string
  onClose: () => void
  onCreated: (path: string, name: string) => void
}

export default function NewProjectModal({ projectsRoot, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [template, setTemplate] = useState('article')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!name.trim()) { setError('Project name is required'); return }
    setLoading(true)
    setError(null)
    try {
      const path = await window.api.newProject({ root: projectsRoot, name: name.trim(), template })
      onCreated(path, name.trim())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="New Project" onClose={onClose}>
      <div className="form-section">
        <div className="form-field">
          <label className="form-field-label">Project Name</label>
          <input
            className="input"
            placeholder="my-paper"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <div className="form-field-hint">
            Created at <code>{projectsRoot}/{name || '…'}</code>
          </div>
        </div>

        <div className="form-field">
          <label className="form-field-label">Template</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => setTemplate(t.id)}
                className={`template-card${template === t.id ? ' selected' : ''}`}
              >
                <div className="template-card-title">{t.label}</div>
                <div className="template-card-desc">{t.description}</div>
              </button>
            ))}
          </div>
        </div>

        {error && <div className="form-error selectable">{error}</div>}

        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
            {loading ? <><div className="spinner" /> Creating…</> : 'Create Project'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
