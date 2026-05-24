import React, { useState, useEffect } from 'react'
import Modal from '../shared/Modal'

interface Props {
  onClose: () => void
  onChangeRoot: () => void
}

export default function SettingsModal({ onClose, onChangeRoot }: Props) {
  const [engine, setEngine] = useState('pdflatex')
  const [trigger, setTrigger] = useState('manual')
  const [root, setRoot] = useState('')

  useEffect(() => {
    Promise.all([
      window.api.storeGet('settings'),
      window.api.getProjectsRoot(),
    ]).then(([settings, r]) => {
      if (settings) {
        setEngine((settings as { defaultEngine: string }).defaultEngine || 'pdflatex')
        setTrigger((settings as { compileTrigger: string }).compileTrigger || 'manual')
      }
      setRoot(r || '')
    })
  }, [])

  async function save() {
    await window.api.storeSet('settings', { defaultEngine: engine, compileTrigger: trigger })
    onClose()
  }

  return (
    <Modal title="Settings" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
            Projects
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input className="input" value={root} readOnly style={{ flex: 1, color: '#64748b' }} />
            <button className="btn btn-secondary btn-sm" onClick={onChangeRoot}>Change</button>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
            Compilation
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>Default Engine</label>
              <select
                className="input"
                value={engine}
                onChange={e => setEngine(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                <option value="pdflatex">pdflatex</option>
                <option value="xelatex">xelatex</option>
                <option value="lualatex">lualatex</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>Compilation Trigger</label>
              <select
                className="input"
                value={trigger}
                onChange={e => setTrigger(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                <option value="manual">Manual (Recompile button)</option>
                <option value="onsave">On Save</option>
                <option value="auto">Auto (debounced)</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </div>
      </div>
    </Modal>
  )
}
