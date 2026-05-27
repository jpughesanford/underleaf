import React, { useState, useEffect } from 'react'
import DashboardRoute from './routes/dashboard/DashboardRoute'
import EditorRoute from './routes/editor/EditorRoute'
import OnboardingRoute from './routes/onboarding/OnboardingRoute'
import { ThemeProvider } from './theme/ThemeProvider'

export type AppView =
  | { type: 'onboarding' }
  | { type: 'dashboard' }
  | { type: 'editor'; projectPath: string; projectName: string }

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  )
}

function AppInner() {
  const [view, setView] = useState<AppView>({ type: 'onboarding' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.projects.getRoot().then(root => {
      if (root) setView({ type: 'dashboard' })
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--color-bg-app)' }}>
        <div className="spinner" style={{ width: 24, height: 24, color: 'var(--color-brand)' }} />
      </div>
    )
  }

  if (view.type === 'onboarding') {
    return <OnboardingRoute onComplete={() => setView({ type: 'dashboard' })} />
  }

  if (view.type === 'editor') {
    // Re-key on projectPath so a rename triggers a clean remount with fresh
    // tabs / pdfPath state — every file path tracked by EditorPage embeds the
    // old project path and would otherwise go stale.
    return (
      <EditorRoute
        key={view.projectPath}
        projectPath={view.projectPath}
        projectName={view.projectName}
        onBack={() => setView({ type: 'dashboard' })}
        onRename={(newPath, newName) => setView({ type: 'editor', projectPath: newPath, projectName: newName })}
      />
    )
  }

  return (
    <DashboardRoute
      onOpenProject={(path, name) => setView({ type: 'editor', projectPath: path, projectName: name })}
      onResetRoot={() => setView({ type: 'onboarding' })}
    />
  )
}
