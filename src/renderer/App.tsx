import React, { useState, useEffect } from 'react'
import Dashboard from './pages/Dashboard'
import EditorPage from './pages/EditorPage'
import Onboarding from './pages/Onboarding'

export type AppView =
  | { type: 'onboarding' }
  | { type: 'dashboard' }
  | { type: 'editor'; projectPath: string; projectName: string }

export default function App() {
  const [view, setView] = useState<AppView>({ type: 'onboarding' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.getProjectsRoot().then((root) => {
      if (root) {
        setView({ type: 'dashboard' })
      }
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
    return (
      <Onboarding
        onComplete={() => setView({ type: 'dashboard' })}
      />
    )
  }

  if (view.type === 'editor') {
    return (
      <EditorPage
        projectPath={view.projectPath}
        projectName={view.projectName}
        onBack={() => setView({ type: 'dashboard' })}
      />
    )
  }

  return (
    <Dashboard
      onOpenProject={(path, name) => setView({ type: 'editor', projectPath: path, projectName: name })}
      onResetRoot={() => setView({ type: 'onboarding' })}
    />
  )
}
