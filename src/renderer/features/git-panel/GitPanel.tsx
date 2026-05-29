import React, { useState, useEffect, useCallback, useRef } from 'react'
import { AlertTriangle, FileText, BookOpen, Image, File, ChevronRight, ChevronDown, TerminalSquare } from 'lucide-react'
import AddRemoteModal from './AddRemoteModal'
import type { FileStatus, GitStatus } from '@shared/types'
import ContextMenu from '@/ui/ContextMenu'
import IconButton from '@/ui/IconButton'

interface ContextMenuState {
  x: number
  y: number
  file: FileStatus
}

interface Props {
  projectPath: string
  onOpenFile: (path: string) => void
  /** Single-click a changed/conflicted file → bring up the diff view. */
  onShowDiff: (relPath: string, opts: { staged: boolean; conflict: boolean }) => void
  /** Bumped by the parent to force a status refresh (e.g. after a conflict is
      resolved in the diff view). */
  refreshToken?: number
}

// PyCharm file-status palette. Modified=blue, Added=green, Deleted/Untracked=red,
// Renamed=blue. The filename takes this color; the path stays muted.
const STATUS_COLOR: Record<string, string> = {
  M: 'var(--badge-info-color)',
  A: 'var(--badge-sync-color)',
  D: 'var(--badge-err-color)',
  R: 'var(--badge-info-color)',
  '?': 'var(--badge-err-color)',
}

type SectionKey = 'staged' | 'changes' | 'unversioned' | 'conflicts'

export default function GitPanel({ projectPath, onOpenFile, onShowDiff, refreshToken }: Props) {
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [commitMsg, setCommitMsg] = useState('')
  const [amend, setAmend] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [showAddRemote, setShowAddRemote] = useState(false)
  const [hasRemote, setHasRemote] = useState(true)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [collapsed, setCollapsed] = useState<Record<SectionKey, boolean>>({
    staged: false, changes: false, unversioned: false, conflicts: false,
  })
  // PyCharm always has exactly one focused row; we follow the same model so the
  // indigo highlight bar has a single home. Defaults to the first non-empty section.
  const [selected, setSelected] = useState<string>('section:changes')
  // Height of the commit area (textarea + amend row + action row). Dragging the
  // divider above resizes this; the tree body fills whatever is left.
  const [commitHeight, setCommitHeight] = useState(180)
  const panelRef = useRef<HTMLDivElement>(null)

  function startCommitResize(e: React.MouseEvent) {
    e.preventDefault()
    const startY = e.clientY
    const startH = commitHeight
    const panelH = panelRef.current?.clientHeight ?? 600
    const onMove = (ev: MouseEvent) => {
      // Cap so the tree always keeps at least ~100px and the commit area never
      // collapses below the height of its own contents (~140px).
      const next = Math.max(140, Math.min(panelH - 140, startH - (ev.clientY - startY)))
      setCommitHeight(next)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [s, remote] = await Promise.all([
        window.api.git.status(projectPath),
        window.api.git.hasRemote(projectPath),
      ])
      setStatus(s)
      setHasRemote(remote)
    } catch (e) {
      console.error('git status failed', e)
    } finally {
      setLoading(false)
    }
  }, [projectPath])

  useEffect(() => { refresh() }, [refresh, refreshToken])

  function flash(text: string, type: 'success' | 'error') {
    setStatusMsg({ text, type })
    setTimeout(() => setStatusMsg(null), 4000)
  }

  async function stage(file: string) { await window.api.git.stage(projectPath, file); refresh() }
  async function unstage(file: string) { await window.api.git.unstage(projectPath, file); refresh() }

  async function stageMany(files: string[]) {
    for (const f of files) await window.api.git.stage(projectPath, f)
    refresh()
  }
  async function unstageMany(files: string[]) {
    for (const f of files) await window.api.git.unstage(projectPath, f)
    refresh()
  }

  async function commit() {
    if (!commitMsg.trim() && !amend) return
    setCommitting(true)
    try {
      await window.api.git.commit(projectPath, commitMsg.trim(), { amend })
      setCommitMsg('')
      setAmend(false)
      flash(amend ? 'Commit amended' : 'Commit successful', 'success')
      refresh()
    } catch (e) {
      flash(`Commit failed: ${e instanceof Error ? e.message : e}`, 'error')
    } finally {
      setCommitting(false)
    }
  }

  async function commitAndPush() {
    if (!commitMsg.trim() && !amend) return
    setCommitting(true)
    try {
      await window.api.git.commit(projectPath, commitMsg.trim(), { amend })
      setCommitMsg('')
      setAmend(false)
      setPushing(true)
      const result = await window.api.git.push(projectPath)
      if (result.success) flash('Commit pushed', 'success')
      else flash(result.error || 'Commit succeeded but push failed', 'error')
      refresh()
    } catch (e) {
      flash(`Commit failed: ${e instanceof Error ? e.message : e}`, 'error')
    } finally {
      setCommitting(false)
      setPushing(false)
    }
  }

  async function push() {
    setPushing(true)
    try {
      const result = await window.api.git.push(projectPath)
      if (result.success) {
        flash('Pushed successfully', 'success')
      } else {
        const authFail = result.error?.includes('Authentication') || result.error?.includes('403') || result.error?.includes('Permission')
        flash(authFail ? 'Auth failed — check SSH keys or credentials in system git' : result.error || 'Push failed', 'error')
      }
    } finally { setPushing(false) }
  }

  async function pull() {
    setPulling(true)
    try {
      const result = await window.api.git.pull(projectPath)
      if (result.success) { flash('Pulled successfully', 'success'); refresh() }
      else if (result.hasConflicts) { flash('Pull succeeded with conflicts — resolve them in the editor', 'error'); refresh() }
      else flash(result.error || 'Pull failed', 'error')
    } finally { setPulling(false) }
  }

  async function fetch_() {
    setFetching(true)
    try {
      const result = await window.api.git.fetch(projectPath)
      if (result.success) flash('Fetched successfully', 'success')
      else flash(result.error || 'Fetch failed', 'error')
    } finally { setFetching(false) }
  }

  async function addToGitignore(pattern: string) {
    const gitignorePath = `${projectPath}/.gitignore`
    const content = (await window.api.files.read(gitignorePath)) ?? ''
    const lines = content.split('\n').map((l: string) => l.trim())
    if (!lines.includes(pattern)) {
      const sep = content.length > 0 && !content.endsWith('\n') ? '\n' : ''
      await window.api.files.write(gitignorePath, content + sep + pattern + '\n')
    }
    refresh()
  }

  async function deleteFile(filePath: string) {
    try { await window.api.files.delete(`${projectPath}/${filePath}`); refresh() }
    catch (e) { flash(`Delete failed: ${e instanceof Error ? e.message : e}`, 'error') }
  }

  // Split unstaged into "tracked changes" vs "unversioned" (PyCharm convention).
  const changes = (status?.unstaged ?? []).filter(f => f.status !== '?')
  const unversioned = (status?.unstaged ?? []).filter(f => f.status === '?')
  const staged = status?.staged ?? []
  const conflicts = status?.conflicted ?? []

  const hasStaged = staged.length > 0
  const hasChanges = changes.length > 0
  const hasUnversioned = unversioned.length > 0
  const hasConflicts = conflicts.length > 0
  const canCommit = (hasStaged && commitMsg.trim().length > 0) || amend

  function renderSection(key: SectionKey, title: string, files: FileStatus[], staged: boolean) {
    if (files.length === 0) return null
    const sectionId = `section:${key}`
    const isCollapsed = collapsed[key]
    return (
      <>
        <SectionRow
          title={title}
          count={files.length}
          collapsed={isCollapsed}
          checkState={staged ? 'all' : 'none'}
          selected={selected === sectionId}
          onToggleCollapse={() => setCollapsed(c => ({ ...c, [key]: !c[key] }))}
          onToggleCheck={() => staged ? unstageMany(files.map(f => f.path)) : stageMany(files.map(f => f.path))}
          onSelect={() => setSelected(sectionId)}
        />
        {!isCollapsed && files.map(f => {
          const rowId = `${key}:${f.path}`
          return (
            <FileRow
              key={rowId}
              file={f}
              checked={staged}
              selected={selected === rowId}
              onSelect={() => { setSelected(rowId); onShowDiff(f.path, { staged, conflict: false }) }}
              onToggleCheck={() => staged ? unstage(f.path) : stage(f.path)}
              onOpen={() => onOpenFile(`${projectPath}/${f.path}`)}
              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, file: f }) }}
            />
          )
        })}
      </>
    )
  }

  return (
    <div ref={panelRef} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header — PyCharm-style icon-driven toolbar. Fetch/Pull/Push live here instead of
          the commit area so the bottom can be dedicated to writing the message. */}
      <div style={{
        height: 'var(--header-h)',
        padding: '0 6px 0 10px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Source Control
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {hasRemote && (
            <>
              <IconButton title="Fetch" onClick={fetch_} disabled={fetching} spin={fetching}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
              </IconButton>
              <IconButton title="Pull" onClick={pull} disabled={pulling} spin={pulling}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 19V5"/><polyline points="5 12 12 19 19 12"/>
                </svg>
              </IconButton>
              <IconButton title="Push" onClick={push} disabled={pushing} spin={pushing}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14"/><polyline points="5 12 12 5 19 12"/>
                </svg>
              </IconButton>
              <div style={{ width: 1, height: 14, background: 'var(--color-border)', margin: '0 4px' }} />
            </>
          )}
          <IconButton title="Refresh" onClick={refresh}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </IconButton>
        </div>
      </div>

      {/* Tree body */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div className="spinner" style={{ color: 'var(--color-brand)', width: 16, height: 16 }} />
          </div>
        ) : (
          <>
            {hasConflicts && (
              <div style={{ padding: '8px 10px', background: 'var(--badge-err-bg)', borderBottom: '1px solid var(--badge-err-border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-error)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5, letterSpacing: 0.4 }}>
                  <AlertTriangle size={11} strokeWidth={2.5} />
                  MERGE CONFLICTS
                </div>
                {conflicts.map(f => {
                  const rowId = `conflicts:${f}`
                  const isSel = selected === rowId
                  return (
                    <div
                      key={f}
                      onClick={() => { setSelected(rowId); onShowDiff(f, { staged: false, conflict: true }) }}
                      onDoubleClick={() => onOpenFile(`${projectPath}/${f}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 4px', cursor: 'pointer', borderRadius: 4, fontSize: 12, color: 'var(--color-text-error)', background: isSel ? 'var(--gitpanel-sel-bg)' : 'transparent' }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--badge-err-bg-hover, var(--badge-err-bg))' }}
                      onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
                    >
                      <AlertTriangle size={10} strokeWidth={2} />
                      {f}
                    </div>
                  )
                })}
              </div>
            )}

            {renderSection('staged', 'Staged Changes', staged, true)}
            {renderSection('changes', 'Changes', changes, false)}
            {renderSection('unversioned', 'Unversioned Files', unversioned, false)}

            {!hasStaged && !hasChanges && !hasUnversioned && !hasConflicts && (
              <div style={{ padding: '20px 12px', fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
                No changes
              </div>
            )}
          </>
        )}
      </div>

      {/* Drag handle — the visible top border of the commit panel doubles as the
          resize grip. Hit area is taller than the border so it's easy to grab. */}
      <div
        onMouseDown={startCommitResize}
        title="Drag to resize"
        style={{
          height: 6,
          marginTop: -3,
          marginBottom: -3,
          cursor: 'row-resize',
          flexShrink: 0,
          position: 'relative',
          zIndex: 2,
          background: 'transparent',
        }}
      />

      {/* Commit panel — PyCharm-style: Amend + auxiliary icons on top, monospace message,
          primary + secondary commit actions at the bottom. */}
      <div style={{
        height: commitHeight,
        borderTop: '1px solid var(--color-border)',
        padding: '8px 10px 10px',
        flexShrink: 0,
        background: 'var(--color-bg-panel)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Amend row — Amend toggle on the left, "Open in Terminal" right-justified */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div
            onClick={() => setAmend(v => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}
          >
            <PyCheckbox checked={amend} onChange={() => setAmend(v => !v)} />
            <span style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>Amend</span>
          </div>
          <button
            onClick={() => window.api.files.openInTerminal(projectPath)}
            title="Open this repository in your terminal"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              height: 22,
              padding: '0 8px',
              fontSize: 11,
              fontFamily: 'inherit',
              color: 'var(--color-text-secondary)',
              background: 'transparent',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background 120ms ease, color 120ms ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--color-bg-card-hover)'
              e.currentTarget.style.color = 'var(--color-text-primary)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--color-text-secondary)'
            }}
          >
            <TerminalSquare size={12} strokeWidth={1.75} />
            Open in Terminal
          </button>
        </div>

        {/* Message input — monospace, flex-grows to fill the resizable commit area.
            resize: none because the whole panel is resized via the top divider above. */}
        <textarea
          placeholder="Commit message"
          value={commitMsg}
          onChange={e => setCommitMsg(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) commit() }}
          spellCheck
          style={{
            flex: 1,
            width: '100%',
            padding: '8px 10px',
            background: 'var(--color-bg-input)',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            lineHeight: 1.45,
            resize: 'none',
            outline: 'none',
            marginBottom: 8,
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-border-focus)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
        />

        {/* Action row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!hasRemote ? (
            <button className="btn btn-secondary w-full btn-sm" onClick={() => setShowAddRemote(true)}>
              Connect to Remote
            </button>
          ) : (
            <>
              <CommitButton primary onClick={commit} disabled={!canCommit || committing}>
                {committing ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><div className="spinner" style={{ width: 11, height: 11 }} /> Committing…</span> : amend ? 'Amend' : 'Commit'}
              </CommitButton>
              <CommitButton onClick={commitAndPush} disabled={!canCommit || committing || pushing}>
                Commit and Push…
              </CommitButton>
            </>
          )}
        </div>
      </div>

      {statusMsg && (
        <div
          className="selectable"
          style={{
            padding: '8px 12px',
            fontSize: 12,
            color: statusMsg.type === 'success' ? 'var(--badge-sync-color)' : 'var(--color-text-error)',
            background: statusMsg.type === 'success' ? 'var(--badge-sync-bg)' : 'var(--badge-err-bg)',
            borderTop: `1px solid ${statusMsg.type === 'success' ? 'var(--badge-sync-border)' : 'var(--badge-err-border)'}`,
            flexShrink: 0,
          }}
        >
          {statusMsg.text}
        </div>
      )}

      {showAddRemote && (
        <AddRemoteModal
          projectPath={projectPath}
          onClose={() => setShowAddRemote(false)}
          onAdded={() => { setShowAddRemote(false); setHasRemote(true); refresh() }}
        />
      )}

      {contextMenu && (() => {
        const filePath = contextMenu.file.path
        const fileName = filePath.split('/').pop() ?? filePath
        const ext = fileName.includes('.') ? fileName.split('.').pop() : null
        const enclosingDir = filePath.includes('/') ? filePath.split('/').slice(0, -1).join('/') + '/' : null
        const ignoreIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        const trashIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        return (
          <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
            <ContextMenu.Item label="Add file to .gitignore" icon={ignoreIcon} onClick={() => { addToGitignore(filePath); setContextMenu(null) }} />
            {ext && (
              <ContextMenu.Item label={`Add *.${ext} to .gitignore`} icon={ignoreIcon} onClick={() => { addToGitignore(`*.${ext}`); setContextMenu(null) }} />
            )}
            {enclosingDir && (
              <ContextMenu.Item label="Add enclosing folder to .gitignore" icon={ignoreIcon} onClick={() => { addToGitignore(enclosingDir); setContextMenu(null) }} />
            )}
            <ContextMenu.Separator />
            <ContextMenu.Item label="Delete file" icon={trashIcon} onClick={() => { deleteFile(filePath); setContextMenu(null) }} danger />
          </ContextMenu>
        )
      })()}
    </div>
  )
}

function SectionRow({ title, count, collapsed, checkState, selected, onToggleCollapse, onToggleCheck, onSelect }: {
  title: string
  count: number
  collapsed: boolean
  checkState: 'all' | 'none' | 'some'
  selected: boolean
  onToggleCollapse: () => void
  onToggleCheck: () => void
  onSelect: () => void
}) {
  return (
    <div
      onClick={onSelect}
      onDoubleClick={onToggleCollapse}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px 4px 6px',
        cursor: 'pointer',
        userSelect: 'none',
        background: selected ? 'var(--gitpanel-sel-bg)' : 'transparent',
        color: selected ? 'var(--gitpanel-sel-fg)' : 'var(--color-text-primary)',
      }}
    >
      <button
        onClick={e => { e.stopPropagation(); onToggleCollapse() }}
        title={collapsed ? 'Expand' : 'Collapse'}
        style={{
          width: 16, height: 16, border: 'none', background: 'transparent', padding: 0,
          cursor: 'pointer', color: 'inherit', opacity: 0.7,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >
        {collapsed ? <ChevronRight size={12} strokeWidth={2.25} /> : <ChevronDown size={12} strokeWidth={2.25} />}
      </button>
      <PyCheckbox checked={checkState === 'all'} indeterminate={checkState === 'some'} onChange={onToggleCheck} />
      <span style={{ fontSize: 12, fontWeight: 700 }}>{title}</span>
      <span style={{ fontSize: 11, color: selected ? 'var(--gitpanel-sel-fg-muted)' : 'var(--color-text-muted)' }}>
        {count} file{count === 1 ? '' : 's'}
      </span>
    </div>
  )
}

function FileRow({ file, checked, selected, onSelect, onToggleCheck, onOpen, onContextMenu }: {
  file: FileStatus
  checked: boolean
  selected: boolean
  onSelect: () => void
  onToggleCheck: () => void
  onOpen: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const color = STATUS_COLOR[file.status] ?? 'var(--color-text-secondary)'
  const fileName = file.path.split('/').pop() ?? file.path
  const dir = file.path.includes('/') ? file.path.slice(0, file.path.length - fileName.length - 1) : ''
  const isDeleted = file.status === 'D'

  return (
    <div
      onClick={onSelect}
      onDoubleClick={onOpen}
      onContextMenu={onContextMenu}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        // Indent under section: chevron(16) + section gap(6) + 10px header padding ≈ left 32
        padding: '2px 10px 2px 32px',
        fontSize: 12,
        cursor: 'pointer',
        background: selected ? 'var(--gitpanel-sel-bg)' : 'transparent',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--color-bg-card-hover)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
    >
      <PyCheckbox checked={checked} onChange={onToggleCheck} />
      <FileTypeIcon name={fileName} color={color} />
      <span
        style={{
          color: selected ? 'var(--gitpanel-sel-fg)' : color,
          fontWeight: 500,
          textDecoration: isDeleted ? 'line-through' : 'none',
          flexShrink: 0,
          maxWidth: '55%',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {fileName}
      </span>
      {dir && (
        <span
          style={{
            color: selected ? 'var(--gitpanel-sel-fg-muted)' : 'var(--color-text-muted)',
            fontSize: 11,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {dir}
        </span>
      )}
    </div>
  )
}

function FileTypeIcon({ name, color }: { name: string; color: string }) {
  const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() : undefined
  const IMG = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'pdf', 'ico', 'bmp', 'tiff'])
  const props = { size: 13, strokeWidth: 1.75, style: { flexShrink: 0, color } }
  if (ext && IMG.has(ext)) return <Image {...props} />
  if (ext === 'bib') return <BookOpen {...props} />
  if (ext === 'tex' || ext === 'sty' || ext === 'cls' || ext === 'bst' || ext === 'md' || ext === 'txt') return <FileText {...props} />
  return <File {...props} />
}

function PyCheckbox({ checked, indeterminate, onChange }: {
  checked: boolean
  indeterminate?: boolean
  onChange: () => void
}) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange() }}
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      style={{
        width: 14, height: 14,
        flexShrink: 0,
        // Unchecked border uses text-muted, not border-light: on the light theme
        // border-light (#e0e0e0) is paler than the panel (#dcdcdc), so the empty
        // box vanished. text-muted reads clearly on panels in both themes.
        border: `1.5px solid ${checked || indeterminate ? 'var(--color-brand)' : 'var(--color-text-muted)'}`,
        background: checked || indeterminate ? 'var(--color-brand)' : 'transparent',
        borderRadius: 3,
        padding: 0,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 120ms ease, border-color 120ms ease',
      }}
      onMouseEnter={e => { if (!checked && !indeterminate) e.currentTarget.style.borderColor = 'var(--color-brand)' }}
      onMouseLeave={e => { if (!checked && !indeterminate) e.currentTarget.style.borderColor = 'var(--color-text-muted)' }}
    >
      {indeterminate ? (
        <div style={{ width: 7, height: 2, background: 'var(--color-on-brand)' }} />
      ) : checked ? (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-brand)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ) : null}
    </button>
  )
}

function CommitButton({ children, primary, onClick, disabled }: {
  children: React.ReactNode
  primary?: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 28,
        padding: '0 14px',
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 5,
        cursor: disabled ? 'default' : 'pointer',
        border: primary ? 'none' : '1px solid var(--color-border-light)',
        background: primary ? 'var(--color-brand)' : 'transparent',
        color: primary ? 'white' : 'var(--color-text-primary)',
        opacity: disabled ? 0.45 : 1,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        transition: 'background 120ms ease, border-color 120ms ease',
      }}
      onMouseEnter={e => {
        if (disabled) return
        if (primary) e.currentTarget.style.background = 'var(--color-brand-hover)'
        else e.currentTarget.style.background = 'var(--color-bg-card-hover)'
      }}
      onMouseLeave={e => {
        if (disabled) return
        if (primary) e.currentTarget.style.background = 'var(--color-brand)'
        else e.currentTarget.style.background = 'transparent'
      }}
    >
      {children}
    </button>
  )
}

