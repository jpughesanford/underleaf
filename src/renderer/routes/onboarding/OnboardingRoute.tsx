import React, { useState } from 'react'
import { FolderPlus, FolderSearch } from 'lucide-react'
import AppIcon from '@/ui/AppIcon'

interface Props {
  onComplete: () => void
}

const BRAND_DARK = '#2f6446'
const BRAND = '#4caf50'
const BRAND_DEEPER = '#1e4d34'
const BG = '#f2f2f2'
const TEXT = '#1a1a1a'
const TEXT_MUTED = '#6b6b6b'
const BORDER = '#d0d0d0'

export default function Onboarding({ onComplete }: Props) {
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
        background: `radial-gradient(ellipse at top, #ffffff 0%, ${BG} 70%)`,
        color: TEXT,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif',
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
              <AppIcon size={80} color={BRAND_DEEPER} />
            </span>
            <span style={{
              fontSize: 72,
              fontWeight: 700,
              color: BRAND_DEEPER,
              letterSpacing: -2,
              marginLeft: -24,
              fontFamily: '"Lato", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}>
            nderleaf
            </span>
          </div>
          <p style={{
            color: TEXT_MUTED,
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
              background: '#ffffff',
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              cursor: loading ? 'wait' : 'pointer',
              color: TEXT,
              textAlign: 'center',
              transition: 'all 150ms ease',
              fontFamily: 'inherit',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = BRAND
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(47,100,70,0.12)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = BORDER
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center', color: BRAND_DARK }}>
              <FolderPlus size={28} strokeWidth={1.5} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Create New Folder</div>
            <div style={{ fontSize: 12, color: TEXT_MUTED }}>Start fresh with an empty projects folder</div>
          </button>

          <button
            onClick={handleChooseExisting}
            disabled={loading}
            style={{
              flex: 1,
              padding: '22px 18px',
              background: '#ffffff',
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              cursor: loading ? 'wait' : 'pointer',
              color: TEXT,
              textAlign: 'center',
              transition: 'all 150ms ease',
              fontFamily: 'inherit',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = BRAND
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(47,100,70,0.12)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = BORDER
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center', color: BRAND_DARK }}>
              <FolderSearch size={28} strokeWidth={1.5} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Choose Existing</div>
            <div style={{ fontSize: 12, color: TEXT_MUTED }}>Open a folder with existing git repos</div>
          </button>
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: TEXT_MUTED }}>
            <div className="spinner" style={{ color: BRAND_DARK }} />
            <span>Opening folder...</span>
          </div>
        )}

        {error && (
          <div style={{ color: '#c62828', fontSize: 13 }}>{error}</div>
        )}

        <p style={{ color: '#909090', fontSize: 12, marginTop: 28 }}>
          You can change the projects folder later in Settings
        </p>
      </div>
    </div>
  )
}
