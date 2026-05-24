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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>Project Name</label>
          <input
            className="input"
            placeholder="my-paper"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
        </div>

        <div>
          <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>Template</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => setTemplate(t.id)}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  borderRadius: 8,
                  border: `1px solid ${template === t.id ? 'var(--color-brand)' : 'var(--color-border)'}`,
                  background: template === t.id ? 'rgba(76,175,80,0.1)' : 'var(--color-bg-input)',
                  color: template === t.id ? '#4CAF50' : '#94a3b8',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t.label}</div>
                <div style={{ fontSize: 11, marginTop: 2, opacity: 0.7 }}>{t.description}</div>
              </button>
            ))}
          </div>
        </div>

        {error && <div style={{ color: '#f87171', fontSize: 13 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
            {loading ? <><div className="spinner" /> Creating...</> : 'Create Project'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
