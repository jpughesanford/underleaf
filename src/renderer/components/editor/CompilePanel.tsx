import React, { useState } from 'react'

interface CompileError {
  type: 'error' | 'warning'
  file: string
  line: number | null
  message: string
}

interface CompileResult {
  success: boolean
  errors: CompileError[]
  warnings: CompileError[]
  rawLog: string
}

interface Props {
  result: CompileResult | null
  compiling: boolean
  onJumpToError: (file: string, line: number | null) => void
}

export default function CompilePanel({ result, compiling, onJumpToError }: Props) {
  const [tab, setTab] = useState<'parsed' | 'raw'>('parsed')

  const totalErrors = result?.errors.length ?? 0
  const totalWarnings = result?.warnings.length ?? 0

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Section header — matches the "Files" and "Source Control" headers
          on the other sidebar tabs so all three panels share one chrome.
          Status (Compiling / Successful / Failed) sits right-justified here. */}
      <div style={{
        height: 'var(--header-h)',
        padding: '0 10px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Compilation
        </span>
        {compiling ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-text-secondary)', fontSize: 12 }}>
            <div className="spinner" style={{ width: 12, height: 12, color: 'var(--color-brand)' }} />
            Compiling…
          </span>
        ) : result ? (
          result.success ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-success)', fontSize: 12 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Successful
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-error)', fontSize: 12 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Failed
            </span>
          )
        ) : null}
      </div>

      {/* Counts + view toggle — no divider, sits flush against the error list */}
      {result && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
            {totalErrors > 0 && (
              <span className="badge badge-red" style={{ whiteSpace: 'nowrap' }}>{totalErrors} error{totalErrors !== 1 ? 's' : ''}</span>
            )}
            {totalWarnings > 0 && (
              <span className="badge badge-yellow" style={{ whiteSpace: 'nowrap' }}>{totalWarnings} warning{totalWarnings !== 1 ? 's' : ''}</span>
            )}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setTab('parsed')}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11, color: tab === 'parsed' ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
            >
              Parsed
            </button>
            <button
              onClick={() => setTab('raw')}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11, color: tab === 'raw' ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
            >
              Raw Log
            </button>
          </div>
        </div>
      )}

      {/* Panel content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        {result && tab === 'parsed' && (
          <div>
            {result.errors.length === 0 && result.warnings.length === 0 ? (
              <div style={{ padding: '12px 16px', color: 'var(--color-text-accent)', fontSize: 12 }}>
                No errors or warnings.
              </div>
            ) : (
              <>
                {result.errors.map((err, i) => (
                  <ErrorRow key={`e${i}`} item={err} onClick={() => onJumpToError(err.file, err.line)} />
                ))}
                {result.warnings.map((w, i) => (
                  <ErrorRow key={`w${i}`} item={w} onClick={() => onJumpToError(w.file, w.line)} />
                ))}
              </>
            )}
          </div>
        )}

        {result && tab === 'raw' && (
          <pre
            className="selectable"
            style={{
              padding: '8px 12px',
              color: 'var(--color-text-secondary)',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {result.rawLog}
          </pre>
        )}
      </div>
    </div>
  )
}

function ErrorRow({ item, onClick }: { item: CompileError; onClick: () => void }) {
  const isError = item.type === 'error'
  const jumpable = !!item.line
  const [hovered, setHovered] = useState(false)
  const [jumped, setJumped] = useState(false)

  const accentColor = isError ? 'var(--color-error)' : 'var(--color-warning)'
  const accentDim   = isError ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.15)'
  const accentGlow  = isError ? 'rgba(239,68,68,0.07)' : 'rgba(245,158,11,0.06)'

  function handleClick() {
    if (!jumpable) return
    onClick()
    setJumped(true)
    setTimeout(() => setJumped(false), 600)
  }

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => { if (jumpable) setHovered(true) }}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        cursor: jumpable ? 'pointer' : 'default',
        background: hovered ? accentGlow : 'transparent',
        transition: 'background 140ms ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Left accent rail */}
      <div style={{
        width: hovered && jumpable ? 3 : 2,
        flexShrink: 0,
        background: jumpable
          ? (hovered ? accentColor : accentDim)
          : 'var(--color-border)',
        transition: 'width 140ms ease, background 140ms ease',
      }} />

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 10px', minWidth: 0 }}>
        {/* Severity icon */}
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{
            flexShrink: 0, marginTop: 1,
            color: jumpable ? accentColor : 'var(--color-text-muted)',
            transition: 'color 140ms',
          }}
        >
          {isError
            ? <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>
            : <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>
          }
        </svg>

        {/* Location pill + message */}
        <div style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
          {(item.file || item.line) && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 2,
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: hovered && jumpable ? accentColor : 'var(--color-text-muted)',
              background: 'var(--color-bg-input)',
              border: `1px solid ${hovered && jumpable ? accentDim : 'var(--color-border)'}`,
              borderRadius: 4, padding: '1px 5px',
              marginRight: 7, verticalAlign: 'middle',
              transition: 'color 140ms, border-color 140ms',
              textDecoration: hovered && jumpable ? 'underline' : 'none',
              flexShrink: 0,
            }}>
              {item.file && <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.file}</span>}
              {item.line && <span>:{item.line}</span>}
            </span>
          )}
          <span
            className="selectable"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            style={{
              color: jumpable
                ? (hovered ? 'var(--color-text-primary)' : 'var(--color-text-secondary)')
                : 'var(--color-text-muted)',
              transition: 'color 140ms',
              fontSize: 12,
            }}
          >
            {item.message}
          </span>
        </div>

        {/* Jump affordance */}
        <div style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 3,
          opacity: jumped ? 1 : hovered ? 1 : 0,
          transform: hovered || jumped ? 'translateX(0)' : 'translateX(6px)',
          transition: 'opacity 160ms ease, transform 160ms ease',
          color: jumped ? 'var(--color-success)' : accentColor,
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          letterSpacing: '0.03em',
          pointerEvents: 'none',
        }}>
          {jumped ? (
            <>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              done
            </>
          ) : (
            <>
              jump
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
