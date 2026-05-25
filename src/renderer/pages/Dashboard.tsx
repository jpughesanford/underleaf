import React, { useState, useEffect, useCallback } from 'react'
import ProjectCard from '../components/dashboard/ProjectCard'
import NewProjectModal from '../components/dashboard/NewProjectModal'
import CloneModal from '../components/dashboard/CloneModal'
import SettingsModal from '../components/dashboard/SettingsModal'
import AppIcon from '../components/shared/AppIcon'

interface ProjectInfo {
  id: string
  name: string
  path: string
  branch: string
  lastCommit: string | null
  lastCommitDate: string | null
  dirtyCount: number
  remoteUrl: string | null
  hasRemote: boolean
}

interface Props {
  onOpenProject: (path: string, name: string) => void
  onResetRoot: () => void
}

export default function Dashboard({ onOpenProject, onResetRoot }: Props) {
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [latexmkAvailable, setLatexmkAvailable] = useState(true)
  const [projectsRoot, setProjectsRoot] = useState<string>('')
  const [showNew, setShowNew] = useState(false)
  const [showClone, setShowClone] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [search, setSearch] = useState('')

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

  const filtered = search
    ? projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : projects

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--color-bg-app)' }}>
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

        <div className="titlebar-no-drag" style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings(true)} title="Settings">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
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
          <a
            href="https://www.tug.org/texlive/"
            style={{ color: '#fbbf24', textDecoration: 'underline', cursor: 'pointer' }}
            onClick={e => { e.preventDefault() }}
          >
            Install Instructions
          </a>
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
        {/* Header */}
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
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => onOpenProject(project.path, project.name)}
              />
            ))}
          </div>
        )}
      </div>

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
