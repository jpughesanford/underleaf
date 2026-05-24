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
  onClose: () => void
  onJumpToError: (file: string, line: number | null) => void
}

export default function CompilePanel({ result, compiling, onClose, onJumpToError }: Props) {
  const [tab, setTab] = useState<'parsed' | 'raw'>('parsed')

  const totalErrors = result?.errors.length ?? 0
  const totalWarnings = result?.warnings.length ?? 0

  return (
    <div style={{
      height: 200,
      borderTop: '1px solid var(--color-border)',
      background: '#0f172a',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Panel header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderBottom: '1px solid var(--color-border)',
        background: '#0d1526',
        flexShrink: 0,
      }}>
        {compiling ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12 }}>
            <div className="spinner" style={{ width: 12, height: 12, color: 'var(--color-brand)' }} />
            Compiling...
          </div>
        ) : result ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', overflow: 'hidden' }}>
            {result.success ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#4ade80', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Successful
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f87171', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                Failed
              </span>
            )}
            {totalErrors > 0 && (
              <span className="badge badge-red" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{totalErrors} error{totalErrors !== 1 ? 's' : ''}</span>
            )}
            {totalWarnings > 0 && (
              <span className="badge badge-yellow" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{totalWarnings} warning{totalWarnings !== 1 ? 's' : ''}</span>
            )}
          </div>
        ) : null}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          {result && (
            <>
              <button
                onClick={() => setTab('parsed')}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, color: tab === 'parsed' ? '#e2e8f0' : '#64748b' }}
              >
                Parsed
              </button>
              <button
                onClick={() => setTab('raw')}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, color: tab === 'raw' ? '#e2e8f0' : '#64748b' }}
              >
                Raw Log
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="btn btn-ghost btn-icon"
            style={{ color: '#64748b', width: 22, height: 22 }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        {result && tab === 'parsed' && (
          <div>
            {result.errors.length === 0 && result.warnings.length === 0 ? (
              <div style={{ padding: '12px 16px', color: '#4ade80', fontSize: 12 }}>
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
          <pre style={{
            padding: '8px 12px',
            color: '#94a3b8',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {result.rawLog}
          </pre>
        )}
      </div>
    </div>
  )
}

function ErrorRow({ item, onClick }: { item: CompileError; onClick: () => void }) {
  const isError = item.type === 'error'
  return (
    <div
      onClick={item.line ? onClick : undefined}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '5px 12px',
        cursor: item.line ? 'pointer' : 'default',
        borderBottom: '1px solid rgba(45,63,85,0.5)',
        fontSize: 12,
      }}
      onMouseEnter={e => { if (item.line) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1, color: isError ? '#f87171' : '#fbbf24' }}>
        {isError
          ? <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>
          : <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>
        }
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ color: isError ? '#f87171' : '#fbbf24' }}>
          {item.file && <span style={{ color: '#64748b' }}>{item.file}</span>}
          {item.line && <span style={{ color: '#64748b' }}>:{item.line}</span>}
          {item.file && ' '}
        </span>
        <span style={{ color: '#e2e8f0' }}>{item.message}</span>
      </div>
    </div>
  )
}
