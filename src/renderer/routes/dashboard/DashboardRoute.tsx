import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Folder, Link2, Unlink } from 'lucide-react'
import type { ProjectInfo } from '@shared/types'
import ProjectCard from './ProjectCard'
import NewProjectModal from './NewProjectModal'
import CloneModal from './CloneModal'
import AddRemoteModal from '@/features/git-panel/AddRemoteModal'
import { SettingsModal } from '@/features/settings'
import AppIcon from '@/ui/AppIcon'
import ModeToggle from '@/ui/ModeToggle'
import ContextMenu from '@/ui/ContextMenu'

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
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [resetConfirm, setResetConfirm] = useState<ProjectInfo | null>(null)
  const [addRemoteProject, setAddRemoteProject] = useState<ProjectInfo | null>(null)
  const [fetchSuccess, setFetchSuccess] = useState(false)
  const [badgeFlashKeys, setBadgeFlashKeys] = useState<Record<string, number>>({})
  const fetchSuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [projs, root, latex] = await Promise.all([
        window.api.projects.scan(),
        window.api.projects.getRoot(),
        window.api.projects.checkLatexmk(),
      ])
      setProjects(projs)
      setProjectsRoot(root || '')
      setLatexmkAvailable(latex)
    } finally {
      setLoading(false)
    }
  }, [])

  // Refresh without tearing down the grid — detects badge changes and flashes them
  const silentLoad = useCallback(async () => {
    const [projs, root, latex] = await Promise.all([
      window.api.projects.scan(),
      window.api.projects.getRoot(),
      window.api.projects.checkLatexmk(),
    ])
    setProjects(prev => {
      const changed = (projs as ProjectInfo[]).filter(next => {
        const old = prev.find(p => p.id === next.id)
        return old && (
          old.aheadBy !== next.aheadBy ||
          old.behindBy !== next.behindBy ||
          old.syncStatusKnown !== next.syncStatusKnown ||
          old.hasConflicts !== next.hasConflicts
        )
      })
      if (changed.length > 0) {
        setBadgeFlashKeys(fk => {
          const next = { ...fk }
          for (const p of changed) next[p.id] = (fk[p.id] ?? 0) + 1
          return next
        })
      }
      return projs as ProjectInfo[]
    })
    setProjectsRoot(root || '')
    setLatexmkAvailable(latex)
  }, [])

  useEffect(() => { load() }, [load])

  const handleFetchAll = async () => {
    if (fetchSuccessTimer.current) clearTimeout(fetchSuccessTimer.current)
    setFetchingAll(true)
    setFetchSuccess(false)
    const withRemote = projects.filter(p => p.hasRemote)
    await Promise.allSettled(withRemote.map(p => window.api.git.fetch(p.path)))
    await silentLoad()
    setFetchingAll(false)
    setFetchSuccess(true)
    fetchSuccessTimer.current = setTimeout(() => setFetchSuccess(false), 2200)
  }

  const handleContextMenu = (e: React.MouseEvent, project: ProjectInfo) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, project })
  }

  const handleFetch = async (project: ProjectInfo) => {
    setContextMenu(null)
    setActionProject(project.id)
    await window.api.git.fetch(project.path)
    await silentLoad()
    setActionProject(null)
  }

  const handleResetToRemote = async (project: ProjectInfo) => {
    setContextMenu(null)
    setResetConfirm(project)
  }

  const handleAddRemote = (project: ProjectInfo) => {
    setContextMenu(null)
    setAddRemoteProject(project)
  }

  const handleRemoveRemote = async (project: ProjectInfo) => {
    setContextMenu(null)
    setActionProject(project.id)
    await window.api.git.removeRemote(project.path)
    await silentLoad()
    setActionProject(null)
  }

  const confirmResetToRemote = async () => {
    if (!resetConfirm) return
    const project = resetConfirm
    setResetConfirm(null)
    setActionProject(project.id)
    await window.api.git.resetToRemote(project.path)
    await silentLoad()
    setActionProject(null)
  }

  const handleDelete = async (project: ProjectInfo) => {
    setContextMenu(null)
    const deleted = await window.api.projects.delete(project.path)
    if (deleted) await load()
  }

  const handleRename = (project: ProjectInfo) => {
    setContextMenu(null)
    setRenamingId(project.id)
  }

  const commitRename = async (project: ProjectInfo, newName: string) => {
    try {
      await window.api.projects.rename({ oldPath: project.path, newName })
      setRenamingId(null)
      await load()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Rename failed')
      setRenamingId(null)
    }
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
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 15, color: 'var(--color-text-primary)' }}>
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
          <ModeToggle />
          <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings(true)} title="Settings">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>

          <button className="btn btn-secondary btn-sm" onClick={() => setShowNew(true)}>
            + New Project
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowClone(true)}>
            Clone Repository
          </button>
        </div>
      </div>

      {/* TeX Live warning */}
      {!latexmkAvailable && (
        <div style={{
          background: 'var(--badge-warn-bg)',
          borderBottom: '1px solid var(--badge-warn-border)',
          padding: '8px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: 'var(--badge-warn-color)',
          fontSize: 13,
          flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>TeX Live not detected — compilation will be unavailable.</span>
          <span style={{ color: 'var(--badge-warn-border)' }}>·</span>
          <button
            style={{
              background: 'var(--badge-warn-bg)',
              border: '1px solid var(--badge-warn-border)',
              borderRadius: 5,
              color: 'var(--badge-warn-color)',
              fontSize: 12,
              padding: '2px 10px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
            onClick={async () => {
              const path = await window.api.dialog.openFile({
                title: 'Locate latexmk',
                filters: [{ name: 'latexmk', extensions: ['*'] }],
              })
              if (path) {
                await window.api.projects.setLatexmkPath(path)
                const ok = await window.api.projects.checkLatexmk()
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>Projects</h2>
            {hasRemoteProjects && (
              <button
                className={`fetch-all-btn${fetchingAll ? ' fetching' : ''}${fetchSuccess ? ' success' : ''}`}
                onClick={handleFetchAll}
                disabled={fetchingAll}
              >
                {fetchSuccess ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    All synced
                  </>
                ) : (
                  <>
                    <svg className="fetch-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                    </svg>
                    {fetchingAll ? 'Fetching…' : 'Fetch All'}
                  </>
                )}
              </button>
            )}
          </div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
            {projectsRoot && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Folder size={13} />{projectsRoot}</span>}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 64, color: 'var(--color-text-muted)' }}>
            <div className="spinner" style={{ color: 'var(--color-brand)', width: 24, height: 24 }} />
            <span style={{ marginLeft: 12 }}>Scanning projects...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--color-text-secondary)' }}>
            {search ? (
              <p>No projects match &ldquo;{search}&rdquo;</p>
            ) : (
              <>
                <div style={{ marginBottom: 16, opacity: 0.35 }}><Folder size={52} strokeWidth={1.25} /></div>
                <p style={{ fontSize: 16, color: 'var(--color-text-muted)', marginBottom: 8 }}>No projects yet</p>
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
                    background: 'var(--color-bg-overlay)',
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
                  badgeFlashKey={badgeFlashKeys[project.id] ?? 0}
                  isRenaming={renamingId === project.id}
                  onRenameCommit={name => commitRename(project, name)}
                  onRenameCancel={() => setRenamingId(null)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          header={contextMenu.project.name}
        >
          <ContextMenu.Item
            label="Rename…"
            icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>}
            onClick={() => handleRename(contextMenu.project)}
          />
          {contextMenu.project.hasRemote ? <>
            <ContextMenu.Separator />
            <ContextMenu.Item
              label="Fetch"
              icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>}
              onClick={() => handleFetch(contextMenu.project)}
            />
            <ContextMenu.Item
              label="Remove Remote"
              icon={<Unlink size={13} strokeWidth={2.2} />}
              onClick={() => handleRemoveRemote(contextMenu.project)}
            />
            <ContextMenu.Separator />
            <ContextMenu.Item
              label="Reset to Remote…"
              danger
              icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>}
              onClick={() => handleResetToRemote(contextMenu.project)}
            />
          </> : <>
            <ContextMenu.Separator />
            <ContextMenu.Item
              label="Add Remote…"
              icon={<Link2 size={13} strokeWidth={2.2} />}
              onClick={() => handleAddRemote(contextMenu.project)}
            />
          </>}
          <ContextMenu.Separator />
          <ContextMenu.Item
            label="Delete from Disk…"
            danger
            icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>}
            onClick={() => handleDelete(contextMenu.project)}
          />
        </ContextMenu>
      )}

      {/* Reset to Remote confirmation */}
      {resetConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-bg-overlay)',
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
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--badge-err-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, color: 'var(--color-text-error)',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>Reset to Remote</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 1 }}>{resetConfirm.name}</div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
              This will discard all local commits and changes, replacing them with the remote version. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setResetConfirm(null)}>
                Cancel
              </button>
              <button
                onClick={confirmResetToRemote}
                style={{
                  background: 'var(--badge-err-bg)',
                  border: '1px solid var(--badge-err-border)',
                  borderRadius: 6,
                  color: 'var(--color-text-error)',
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

      {addRemoteProject && (
        <AddRemoteModal
          projectPath={addRemoteProject.path}
          onClose={() => setAddRemoteProject(null)}
          onAdded={() => { setAddRemoteProject(null); silentLoad() }}
        />
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
