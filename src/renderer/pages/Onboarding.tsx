import React, { useState } from 'react'
import AppIcon from '../components/shared/AppIcon'

interface Props {
  onComplete: () => void
}

export default function Onboarding({ onComplete }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleChooseExisting() {
    setLoading(true)
    setError(null)
    try {
      const path = await window.api.openFolder()
      if (path) {
        await window.api.setProjectsRoot(path)
        onComplete()
      }
    } catch (e) {
      setError('Failed to select folder')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateNew() {
    setLoading(true)
    setError(null)
    try {
      const path = await window.api.openFolder()
      if (path) {
        await window.api.createFolder(path)
        onComplete()
      }
    } catch (e) {
      setError('Failed to create folder')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1a2332 60%, #162030 100%)',
      WebkitAppRegion: 'drag' as const,
    }}>
      <div style={{ WebkitAppRegion: 'no-drag' as const, textAlign: 'center', maxWidth: 480, padding: '0 32px' }}>
        {/* Logo */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <div style={{
              width: 80, height: 80,
              borderRadius: 20,
              background: 'rgba(46,125,50,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(46,125,50,0.25)',
            }}>
              <AppIcon size={52} />
            </div>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#e2e8f0', letterSpacing: -0.5 }}>Underleaf</h1>
          <p style={{ color: '#64748b', marginTop: 8, fontSize: 15 }}>
            Offline LaTeX IDE with Overleaf-style editing and git integration
          </p>
        </div>

        {/* Action cards */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <button
            onClick={handleCreateNew}
            disabled={loading}
            style={{
              flex: 1,
              padding: '20px 16px',
              background: 'rgba(76,175,80,0.1)',
              border: '1px solid rgba(76,175,80,0.3)',
              borderRadius: 12,
              cursor: 'pointer',
              color: '#e2e8f0',
              textAlign: 'center',
              transition: 'all 150ms ease',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(76,175,80,0.18)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(76,175,80,0.1)')}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Create New Folder</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Start fresh with an empty projects folder</div>
          </button>

          <button
            onClick={handleChooseExisting}
            disabled={loading}
            style={{
              flex: 1,
              padding: '20px 16px',
              background: 'rgba(59,130,246,0.1)',
              border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: 12,
              cursor: 'pointer',
              color: '#e2e8f0',
              textAlign: 'center',
              transition: 'all 150ms ease',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.18)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.1)')}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Choose Existing</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Open a folder with existing git repos</div>
          </button>
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#64748b' }}>
            <div className="spinner" style={{ color: 'var(--color-brand)' }} />
            <span>Opening folder...</span>
          </div>
        )}

        {error && (
          <div style={{ color: '#f87171', fontSize: 13 }}>{error}</div>
        )}

        <p style={{ color: '#475569', fontSize: 12, marginTop: 24 }}>
          You can change the projects folder later in Settings
        </p>
      </div>
    </div>
  )
}
