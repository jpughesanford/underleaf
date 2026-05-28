import React, { useState } from 'react'
import { FolderPlus, FolderSearch } from 'lucide-react'
import AppIcon from '@/ui/AppIcon'
import { useTheme } from '@/theme/ThemeProvider'

interface Props {
  onComplete: () => void
}

// Subtle radial lift at the top — bg-card center fading to the app bg. Reads as a
// light vignette in light themes and a gentle glow in dark ones.
const BG_GRADIENT = 'radial-gradient(ellipse at top, var(--color-bg-card) 0%, var(--color-bg-app) 70%)'

export default function Onboarding({ onComplete }: Props) {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleChooseExisting() {
    setLoading(true)
    setError(null)
    try {
      const path = await window.api.dialog.openFolder()
      if (path) {
        await window.api.projects.setRoot(path)
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
      const path = await window.api.dialog.openFolder()
      if (path) {
        await window.api.projects.createFolder(path)
        onComplete()
      }
    } catch (e) {
      setError('Failed to create folder')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="titlebar-drag"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: BG_GRADIENT,
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div className="titlebar-no-drag" style={{ textAlign: 'center', maxWidth: 520, padding: '0 32px' }}>
        {/* Hero: logo-as-U + "nderleaf" wordmark */}
        <div style={{ marginBottom: 40 }}>
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'center',
            gap: 0,
            marginBottom: 12,
            lineHeight: 1,
          }}>
            <span style={{ display: 'inline-flex' }}>
              {/* AppIcon's fill is an SVG attribute (no var() support), so pass the
                  active theme's brand hex directly. */}
              <AppIcon size={80} color={theme.chrome.brand} />
            </span>
            <span style={{
              fontSize: 72,
              fontWeight: 700,
              color: 'var(--color-brand)',
              letterSpacing: -2,
              marginLeft: -24,
              fontFamily: '"Lato", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}>
            nderleaf
            </span>
          </div>
          <p style={{
            color: 'var(--color-text-muted)',
            marginTop: 20,
            fontSize: 15,
            letterSpacing: 0.1,
          }}>
            Offline Overleaf editor with Git integration
          </p>
        </div>

        {/* Action cards */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
          <button
            onClick={handleCreateNew}
            disabled={loading}
            style={{
              flex: 1,
              padding: '22px 18px',
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              cursor: loading ? 'wait' : 'pointer',
              color: 'var(--color-text-primary)',
              textAlign: 'center',
              transition: 'all 150ms ease',
              fontFamily: 'inherit',
              boxShadow: 'var(--shadow-sm)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--color-brand)'
              e.currentTarget.style.boxShadow = 'var(--shadow-md)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--color-border)'
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
            }}
          >
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center', color: 'var(--color-brand)' }}>
              <FolderPlus size={28} strokeWidth={1.5} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Create New Folder</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Start fresh with an empty projects folder</div>
          </button>

          <button
            onClick={handleChooseExisting}
            disabled={loading}
            style={{
              flex: 1,
              padding: '22px 18px',
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              cursor: loading ? 'wait' : 'pointer',
              color: 'var(--color-text-primary)',
              textAlign: 'center',
              transition: 'all 150ms ease',
              fontFamily: 'inherit',
              boxShadow: 'var(--shadow-sm)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--color-brand)'
              e.currentTarget.style.boxShadow = 'var(--shadow-md)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--color-border)'
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
            }}
          >
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center', color: 'var(--color-brand)' }}>
              <FolderSearch size={28} strokeWidth={1.5} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Choose Existing</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Open a folder with existing git repos</div>
          </button>
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--color-text-muted)' }}>
            <div className="spinner" style={{ color: 'var(--color-brand)' }} />
            <span>Opening folder...</span>
          </div>
        )}

        {error && (
          <div className="form-error">{error}</div>
        )}

        <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 28 }}>
          You can change the projects folder later in Settings
        </p>
      </div>
    </div>
  )
}
