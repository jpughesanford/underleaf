import React, { useState, useEffect, useCallback } from 'react'
import ProjectCard, { ProjectInfo } from '../components/dashboard/ProjectCard'
import NewProjectModal from '../components/dashboard/NewProjectModal'
import CloneModal from '../components/dashboard/CloneModal'
import SettingsModal from '../components/dashboard/SettingsModal'
import AppIcon from '../components/shared/AppIcon'

interface ContextMenuState {
  x: number
  y: number
  project: ProjectInfo
}

interface Props {
  onOpenProject: (path: string, name: string) => void
  onResetRoot: () => void
}

export default function Dashboard({ onOpenProject, onResetRoot }: Props) {
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchingAll, setFetchingAll] = useState(false)
  const [latexmkAvailable, setLatexmkAvailable] = useState(true)
  const [projectsRoot, setProjectsRoot] = useState<string>('')
  const [showNew, setShowNew] = useState(false)
  const [showClone, setShowClone] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [search, setSearch] = useState('')
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [actionProject, setActionProject] = useState<string | null>(null)
  const [resetConfirm, setResetConfirm] = useState<ProjectInfo | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [projs, root, latex] = await Promise.all([
        window.api.scanProjects(),
        window.api.getProjectsRoot(),
        window.api.checkLatexmk(),
      ])
      setProjects(projs)
      setProjectsRoot(root || '')
      setLatexmkAvailable(latex)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [contextMenu])

  const handleFetchAll = async () => {
    setFetchingAll(true)
    const withRemote = projects.filter(p => p.hasRemote)
    await Promise.allSettled(withRemote.map(p => window.api.gitFetch(p.path)))
    await load()
    setFetchingAll(false)
  }

  const handleContextMenu = (e: React.MouseEvent, project: ProjectInfo) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, project })
  }

  const handleFetch = async (project: ProjectInfo) => {
    setContextMenu(null)
    setActionProject(project.id)
    await window.api.gitFetch(project.path)
    await load()
    setActionProject(null)
  }

  const handleResetToRemote = async (project: ProjectInfo) => {
    setContextMenu(null)
    setResetConfirm(project)
  }

  const confirmResetToRemote = async () => {
    if (!resetConfirm) return
    const project = resetConfirm
    setResetConfirm(null)
    setActionProject(project.id)
    await window.api.gitResetToRemote(project.path)
    await load()
    setActionProject(null)
  }

  const handleDelete = async (project: ProjectInfo) => {
    setContextMenu(null)
    const deleted = await window.api.deleteProject(project.path)
    if (deleted) await load()
  }

  const filtered = search
    ? projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : projects

  const hasRemoteProjects = projects.some(p => p.hasRemote)

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--color-bg-app)' }}
      onClick={() => setContextMenu(null)}
    >
      {/* Titlebar */}
      <div
        className="titlebar-drag"
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 96,
          paddingRight: 16,
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg-panel)',
          flexShrink: 0,
          gap: 12,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 15, color: '#e2e8f0' }}>
          <AppIcon size={22} />
          Underleaf
        </span>

        <div className="titlebar-no-drag" style={{ flex: 1, maxWidth: 320, marginLeft: 8 }}>
          <input
            className="input"
            placeholder="Search projects..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ height: 28, padding: '4px 10px', fontSize: 12 }}
          />
        </div>

        <div className="titlebar-no-drag" style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings(true)} title="Settings">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>

          {hasRemoteProjects && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleFetchAll}
              disabled={fetchingAll}
              title="Fetch all repositories"
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}
            >
              {fetchingAll ? (
                <div className="spinner" style={{ width: 12, height: 12, color: 'var(--color-brand)' }} />
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
              )}
              Fetch All
            </button>
          )}

          <button className="btn btn-secondary btn-sm" onClick={() => setShowClone(true)}>
            Clone Repository
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
            + New Project
          </button>
        </div>
      </div>

      {/* TeX Live warning */}
      {!latexmkAvailable && (
        <div style={{
          background: 'rgba(245,158,11,0.12)',
          borderBottom: '1px solid rgba(245,158,11,0.3)',
          padding: '8px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: '#fbbf24',
          fontSize: 13,
          flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>TeX Live not detected — compilation will be unavailable.</span>
          <span style={{ color: 'rgba(251,191,36,0.4)' }}>·</span>
          <button
            style={{
              background: 'rgba(245,158,11,0.15)',
              border: '1px solid rgba(245,158,11,0.4)',
              borderRadius: 5,
              color: '#fbbf24',
              fontSize: 12,
              padding: '2px 10px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
            onClick={async () => {
              const path = await window.api.openFile({
                title: 'Locate latexmk',
                filters: [{ name: 'latexmk', extensions: ['*'] }],
              })
              if (path) {
                await window.api.setLatexmkPath(path)
                const ok = await window.api.checkLatexmk()
                if (ok) setLatexmkAvailable(true)
              }
            }}
          >
            Set Path Manually…
          </button>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '32px 40px' }}>
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Projects</h2>
          <div style={{ color: '#64748b', fontSize: 13 }}>
            {projectsRoot && <span>📂 {projectsRoot}</span>}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 64, color: '#64748b' }}>
            <div className="spinner" style={{ color: 'var(--color-brand)', width: 24, height: 24 }} />
            <span style={{ marginLeft: 12 }}>Scanning projects...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0', color: '#475569' }}>
            {search ? (
              <p>No projects match &ldquo;{search}&rdquo;</p>
            ) : (
              <>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
                <p style={{ fontSize: 16, color: '#64748b', marginBottom: 8 }}>No projects yet</p>
                <p style={{ fontSize: 13 }}>
                  Create a new project or clone an existing repository to get started.
                </p>
              </>
            )}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
          }}>
            {filtered.map(project => (
              <div key={project.id} style={{ position: 'relative' }}>
                {actionProject === project.id && (
                  <div style={{
                    position: 'absolute', inset: 0, zIndex: 2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(15,23,42,0.55)',
                    borderRadius: 10,
                    backdropFilter: 'blur(2px)',
                  }}>
                    <div className="spinner" style={{ width: 20, height: 20, color: 'var(--color-brand)' }} />
                  </div>
                )}
                <ProjectCard
                  project={project}
                  onOpen={() => onOpenProject(project.path, project.name)}
                  onContextMenu={e => handleContextMenu(e, project)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: 'var(--color-bg-panel)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: '4px 0',
            zIndex: 9999,
            minWidth: 190,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ padding: '4px 12px 6px', fontSize: 11, color: '#475569', fontWeight: 600, borderBottom: '1px solid var(--color-border)', marginBottom: 4 }}>
            {contextMenu.project.name}
          </div>

          {contextMenu.project.hasRemote && (
            <button
              onClick={() => handleFetch(contextMenu.project)}
              style={menuItemStyle}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              Fetch
            </button>
          )}

          {contextMenu.project.hasRemote && (
            <>
              <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
              <button
                onClick={() => handleResetToRemote(contextMenu.project)}
                style={{ ...menuItemStyle, color: '#f87171' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
                </svg>
                Reset to Remote…
              </button>
            </>
          )}

          {contextMenu.project.hasRemote && <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />}
          <button
            onClick={() => handleDelete(contextMenu.project)}
            style={{ ...menuItemStyle, color: '#f87171' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
            Delete from Disk…
          </button>
        </div>
      )}

      {/* Reset to Remote confirmation */}
      {resetConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
          }}
          onClick={() => setResetConfirm(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--color-bg-panel)',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              padding: 24,
              maxWidth: 400,
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'rgba(248,113,113,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, color: '#f87171',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#e2e8f0' }}>Reset to Remote</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>{resetConfirm.name}</div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5, marginBottom: 20 }}>
              This will discard all local commits and changes, replacing them with the remote version. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setResetConfirm(null)}>
                Cancel
              </button>
              <button
                onClick={confirmResetToRemote}
                style={{
                  background: 'rgba(248,113,113,0.15)',
                  border: '1px solid rgba(248,113,113,0.4)',
                  borderRadius: 6,
                  color: '#f87171',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '5px 14px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Reset to Remote
              </button>
            </div>
          </div>
        </div>
      )}

      {showNew && (
        <NewProjectModal
          projectsRoot={projectsRoot}
          onClose={() => setShowNew(false)}
          onCreated={(path, name) => {
            setShowNew(false)
            load()
            onOpenProject(path, name)
          }}
        />
      )}

      {showClone && (
        <CloneModal
          projectsRoot={projectsRoot}
          onClose={() => setShowClone(false)}
          onCloned={(path, name) => {
            setShowClone(false)
            load()
            onOpenProject(path, name)
          }}
        />
      )}

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onChangeRoot={() => { setShowSettings(false); onResetRoot() }}
        />
      )}
    </div>
  )
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  background: 'transparent',
  border: 'none',
  color: '#cbd5e1',
  fontSize: 13,
  padding: '6px 12px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'left',
  transition: 'background 100ms',
}
