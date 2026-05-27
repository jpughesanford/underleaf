import type { EditorState } from '@codemirror/state'
import { EditorView, ViewUpdate } from '@codemirror/view'
import type { Panel } from '@codemirror/view'
import {
  findNext, findPrevious, replaceNext, replaceAll, closeSearchPanel,
  getSearchQuery, setSearchQuery, SearchQuery,
} from '@codemirror/search'

// ─── Inline SVG icons ─────────────────────────────────────────────────────
const SVG_SEARCH  = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="7" cy="7" r="4.2"/><path d="m10.2 10.2 3.3 3.3"/></svg>`
const SVG_REPLACE = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h7l-2-2m2 2-2 2"/><path d="M13 12H6l2 2m-2-2 2-2"/></svg>`
const SVG_PREV    = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 9.5 4 6l4.5-3.5"/></svg>`
const SVG_NEXT    = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 2.5 8 6l-4.5 3.5"/></svg>`
const SVG_CLOSE   = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M2.5 2.5l7 7m0-7-7 7"/></svg>`

// ─── Match counting ───────────────────────────────────────────────────────
function countMatches(state: EditorState, query: SearchQuery): { current: number; total: number } {
  if (!query.search || !query.valid) return { current: 0, total: 0 }
  try {
    const cursor = query.getCursor(state) as Iterator<{ from: number; to: number }>
    const head = state.selection.main.from
    let total = 0
    let current = 0
    while (true) {
      const next = cursor.next()
      if (next.done) break
      total++
      // first match at-or-after the cursor is "current"; if none after, wrap to first
      if (current === 0 && next.value.from >= head) current = total
    }
    if (current === 0 && total > 0) current = 1
    return { current, total }
  } catch {
    return { current: 0, total: 0 }
  }
}

// ─── Panel factory ────────────────────────────────────────────────────────
export function createUnderleafSearchPanel(view: EditorView): Panel {
  const root = document.createElement('div')
  root.className = 'cm-search underleaf-search'
  // Flat 4-child grid: row 1 = [find field][rail], row 2 = [replace field][actions].
  // CSS Grid forces both fields into the same column so their right edges align,
  // and both trailings share the same column so their right edges align too.
  root.innerHTML = `
    <div class="us-field us-field-find">
      <span class="us-lead">${SVG_SEARCH}</span>
      <input class="us-input us-find" type="text" placeholder="Find in document…" spellcheck="false" autocomplete="off" />
      <div class="us-trail">
        <button type="button" class="us-mod" data-mod="case" title="Match case" aria-pressed="false">Aa</button>
        <button type="button" class="us-mod" data-mod="re"   title="Use regular expression" aria-pressed="false">.*</button>
        <button type="button" class="us-mod" data-mod="word" title="Match whole word" aria-pressed="false">W</button>
        <span class="us-count is-empty" aria-live="polite"><span class="us-count-cur">0</span><span class="us-count-sep">/</span><span class="us-count-tot">0</span></span>
      </div>
    </div>
    <div class="us-rail">
      <div class="us-nav">
        <button type="button" class="us-prev" title="Previous match (⇧⌘G)" aria-label="Previous match">${SVG_PREV}</button>
        <button type="button" class="us-next" title="Next match (⌘G)" aria-label="Next match">${SVG_NEXT}</button>
      </div>
      <button type="button" class="us-close" title="Close (Esc)" aria-label="Close search">${SVG_CLOSE}</button>
    </div>
    <div class="us-field us-field-replace">
      <span class="us-lead">${SVG_REPLACE}</span>
      <input class="us-input us-replace" type="text" placeholder="Replace with…" spellcheck="false" autocomplete="off" />
    </div>
    <div class="us-actions">
      <button type="button" class="us-btn us-btn-ghost"   title="Replace next (⌥↵)">Replace</button>
      <button type="button" class="us-btn us-btn-primary" title="Replace all matches (⇧⌥↵)">All</button>
    </div>
  `

  const findInput     = root.querySelector('.us-find')     as HTMLInputElement
  const replaceInput  = root.querySelector('.us-replace')  as HTMLInputElement
  const countEl       = root.querySelector('.us-count')    as HTMLElement
  const countCur      = root.querySelector('.us-count-cur') as HTMLElement
  const countTot      = root.querySelector('.us-count-tot') as HTMLElement
  const mods          = Array.from(root.querySelectorAll('.us-mod')) as HTMLButtonElement[]

  const modByName = (name: string) => mods.find(m => m.dataset.mod === name)!
  const getMod    = (name: string) => modByName(name).classList.contains('is-on')
  const setMod    = (name: string, on: boolean) => {
    const b = modByName(name)
    b.classList.toggle('is-on', on)
    b.setAttribute('aria-pressed', on ? 'true' : 'false')
  }

  function pushQuery() {
    const q = new SearchQuery({
      search:        findInput.value,
      replace:       replaceInput.value,
      caseSensitive: getMod('case'),
      regexp:        getMod('re'),
      wholeWord:     getMod('word'),
      // Without regex mode, treat the query as a literal LaTeX string so that
      // a backslash search like \eqref isn't munged into an escape sequence.
      literal:       !getMod('re'),
    })
    view.dispatch({ effects: setSearchQuery.of(q) })
  }

  function refreshCount() {
    const q = getSearchQuery(view.state)
    const { current, total } = countMatches(view.state, q)
    countCur.textContent = String(current)
    countTot.textContent = String(total)
    countEl.classList.toggle('is-empty', !q.search)
    countEl.classList.toggle('is-zero',  !!q.search && total === 0)
  }

  // ── Inputs ──────────────────────────────────────────────────────────────
  findInput.addEventListener('input', () => { pushQuery(); refreshCount() })
  findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')      { e.preventDefault(); e.shiftKey ? findPrevious(view) : findNext(view) }
    else if (e.key === 'Escape') { e.preventDefault(); closeSearchPanel(view) }
  })

  replaceInput.addEventListener('input', () => { pushQuery() })
  replaceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')      { e.preventDefault(); e.shiftKey ? replaceAll(view) : replaceNext(view) }
    else if (e.key === 'Escape') { e.preventDefault(); closeSearchPanel(view) }
  })

  // ── Modifier toggles ────────────────────────────────────────────────────
  mods.forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.mod!
      setMod(name, !getMod(name))
      pushQuery()
      refreshCount()
      findInput.focus()
    })
  })

  // ── Action buttons ──────────────────────────────────────────────────────
  ;(root.querySelector('.us-prev')        as HTMLButtonElement).addEventListener('click', () => { findPrevious(view); findInput.focus() })
  ;(root.querySelector('.us-next')        as HTMLButtonElement).addEventListener('click', () => { findNext(view); findInput.focus() })
  ;(root.querySelector('.us-close')       as HTMLButtonElement).addEventListener('click', () => closeSearchPanel(view))
  ;(root.querySelector('.us-btn-ghost')   as HTMLButtonElement).addEventListener('click', () => { replaceNext(view); findInput.focus() })
  ;(root.querySelector('.us-btn-primary') as HTMLButtonElement).addEventListener('click', () => replaceAll(view))

  // Keep focus inside the panel when clicking its non-input regions
  root.addEventListener('mousedown', (e) => {
    const tag = (e.target as HTMLElement).tagName
    if (tag !== 'INPUT' && tag !== 'BUTTON') e.preventDefault()
  })

  return {
    dom: root,
    top: true,
    mount() {
      const q = getSearchQuery(view.state)
      findInput.value    = q.search
      replaceInput.value = q.replace
      setMod('case', q.caseSensitive)
      setMod('re',   q.regexp)
      setMod('word', q.wholeWord)
      refreshCount()
      requestAnimationFrame(() => { findInput.focus(); findInput.select() })
    },
    update(u: ViewUpdate) {
      if (u.docChanged || u.selectionSet ||
          u.transactions.some(tr => tr.effects.some(e => e.is(setSearchQuery)))) {
        refreshCount()
      }
    },
  }
}

// ─── Panel theme ──────────────────────────────────────────────────────────
// A floating card matching the dashboard's project-card language. All sizing
// and spacing flow from the design tokens declared on the panel root —
// override one variable and the whole component re-tunes consistently.
//
//   spacing scale     4 · 6 · 8 · 12 · 16
//   radius scale      pill · 10 (card) · 8 (shell) · 6 (control)
//   height scale      32 (row) · 24 (inset control)
//   font scale        12.5 mono · 12 ui · 11 micro
//
// NOTE: CodeMirror's default baseTheme paints `.cm-panels` via `&light/&dark`
// selectors which compile to a higher-specificity `.cm-light .cm-panels`. We
// can't reuse `&light/&dark` here — `EditorView.theme` rejects them (only
// `baseTheme` accepts the scope map). We win the cascade with `!important`
// from a plain selector instead.
export const underleafSearchPanelTheme = EditorView.theme({
  // ── Container reset ────────────────────────────────────────────────────
  '.cm-panels': {
    backgroundColor: 'transparent !important',
    color: 'var(--color-text-primary) !important',
    borderColor: 'transparent !important',
  },
  '.cm-panels.cm-panels-top':    { borderBottom: 'none !important' },
  '.cm-panels.cm-panels-bottom': { borderTop: 'none !important' },

  // ── Card shell + design tokens ─────────────────────────────────────────
  '.underleaf-search': {
    // Design tokens — single source of truth for the whole component.
    '--us-pad':          '12px',
    '--us-gap':          '6px',
    '--us-gap-tight':    '4px',
    '--us-row-h':        '32px',
    '--us-ctrl-h':       '24px',
    '--us-ctrl-pad':     '8px',
    '--us-r-card':       '10px',
    '--us-r-shell':      '8px',
    '--us-r-control':    '6px',
    '--us-font-input':   '12.5px',
    '--us-font-ui':      '12px',
    '--us-font-micro':   '11px',
    '--us-brand-tint':   'rgba(76, 175, 80, 0.16)',
    '--us-brand-ring':   'rgba(76, 175, 80, 0.18)',
    '--us-neutral-tint': 'rgba(127, 127, 127, 0.10)',
    '--us-amber-tint':   'rgba(245, 158, 11, 0.14)',

    // Two-by-two grid: col 1 is the input column (1fr), col 2 is the
    // trailing column (auto = max content). Both fields share col 1 so
    // their right edges align; both trailings share col 2 so their right
    // edges align with each other AND with the card's right padding.
    display:             'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gridTemplateRows:    'var(--us-row-h) var(--us-row-h)',
    columnGap:           'var(--us-gap)',
    rowGap:              'var(--us-gap)',
    padding:             'var(--us-pad)',
    margin:              '8px 12px',
    background:          'var(--color-bg-card)',
    border:              '1px solid var(--color-border)',
    borderRadius:        'var(--us-r-card)',
    boxShadow:           '0 0 20px rgba(0, 0, 0, 0.10)',
    fontFamily:          'var(--font-sans)',
    fontSize:            'var(--us-font-ui)',
    color:               'var(--color-text-primary)',
    position:            'relative',
    animation:           'underleaf-search-in 220ms cubic-bezier(.2, .7, .2, 1)',
  },
  '@keyframes underleaf-search-in': {
    from: { transform: 'translateY(-4px)', opacity: 0 },
    to:   { transform: 'translateY(0)',    opacity: 1 },
  },

  // ── Trailing cluster (rail = row 1, actions = row 2) ───────────────────
  // justify-content: flex-end pushes the cluster's content to the right edge
  // of column 2. Since column 2 is sized to the WIDER trailing (actions),
  // row 1's narrower nav+close sits with empty space on its left — which
  // reads naturally as the gap between the find field and its controls.
  '.underleaf-search .us-rail, .underleaf-search .us-actions': {
    display:        'flex',
    alignItems:     'stretch',
    gap:            'var(--us-gap)',
    justifyContent: 'flex-end',
  },

  // ── Field shell (input + optional inline controls) ─────────────────────
  '.underleaf-search .us-field': {
    flex:         '1 1 auto',
    minWidth:     0,
    display:      'flex',
    alignItems:   'stretch',
    background:   'var(--color-bg-input)',
    border:       '1px solid var(--color-border)',
    borderRadius: 'var(--us-r-shell)',
    overflow:     'hidden',
    transition:   'border-color 140ms ease, box-shadow 140ms ease',
  },
  '.underleaf-search .us-field:focus-within': {
    borderColor: 'var(--color-brand)',
    boxShadow:   '0 0 0 3px var(--us-brand-ring)',
  },

  // Lead glyph — square gutter at the field's left, sized to row height
  '.underleaf-search .us-lead': {
    flex:           'none',
    width:          'var(--us-row-h)',
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    color:          'var(--color-text-muted)',
    transition:     'color 140ms ease',
  },
  '.underleaf-search .us-field:focus-within .us-lead': {
    color: 'var(--color-brand)',
  },
  '.underleaf-search .us-lead svg': {
    width:   '14px',
    height:  '14px',
    display: 'block',
  },

  // Text input — fills the remaining field width
  '.underleaf-search .us-input': {
    flex:       '1 1 auto',
    minWidth:   0,
    background: 'transparent',
    border:     0,
    outline:    0,
    padding:    '0 var(--us-gap) 0 0',
    color:      'inherit',
    fontFamily: 'var(--font-mono)',
    fontSize:   'var(--us-font-input)',
  },
  '.underleaf-search .us-input::placeholder': {
    color:     'var(--color-text-muted)',
    fontStyle: 'italic',
  },

  // Trailing cluster inside the find field (modifier toggles + count chip)
  '.underleaf-search .us-trail': {
    flex:         'none',
    display:      'flex',
    alignItems:   'center',
    gap:          'var(--us-gap-tight)',
    paddingRight: 'var(--us-gap)',
  },

  // ── Inset controls (live inside the find field's frame) ────────────────
  // Modifier toggles — ghost until active, then soft brand tint.
  '.underleaf-search .us-mod': {
    height:       'var(--us-ctrl-h)',
    minWidth:     'var(--us-ctrl-h)',
    padding:      '0 var(--us-ctrl-pad)',
    background:   'transparent',
    border:       0,
    borderRadius: 'var(--us-r-control)',
    fontFamily:   'var(--font-sans)',
    fontSize:     'var(--us-font-micro)',
    fontWeight:   600,
    color:        'var(--color-text-muted)',
    cursor:       'pointer',
    transition:   'background 120ms, color 120ms',
  },
  '.underleaf-search .us-mod:hover': {
    background: 'var(--us-neutral-tint)',
    color:      'var(--color-text-primary)',
  },
  '.underleaf-search .us-mod.is-on': {
    background: 'var(--us-brand-tint)',
    color:      'var(--color-brand)',
  },

  // Count chip — pill, three states (matches / empty / zero-results)
  '.underleaf-search .us-count': {
    display:            'inline-flex',
    alignItems:         'center',
    height:             'var(--us-ctrl-h)',
    padding:            '0 10px',
    borderRadius:       '999px',
    border:             '1px solid transparent',
    fontFamily:         'var(--font-sans)',
    fontSize:           'var(--us-font-micro)',
    fontWeight:         600,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace:         'nowrap',
    background:         'var(--us-brand-tint)',
    color:              'var(--color-brand)',
    borderColor:        'rgba(76, 175, 80, 0.24)',
  },
  '.underleaf-search .us-count-sep, .underleaf-search .us-count-tot': {
    opacity:    0.65,
    fontWeight: 500,
  },
  '.underleaf-search .us-count.is-empty': {
    background:  'var(--us-neutral-tint)',
    color:       'var(--color-text-muted)',
    borderColor: 'var(--color-border)',
  },
  '.underleaf-search .us-count.is-zero': {
    background:  'var(--us-amber-tint)',
    color:       'var(--color-warning)',
    borderColor: 'rgba(245, 158, 11, 0.32)',
  },

  // ── Row-1 trailing: nav + close ────────────────────────────────────────
  // Segmented prev/next — equal-width buttons inside one shell.
  '.underleaf-search .us-nav': {
    display:      'inline-flex',
    alignItems:   'stretch',
    background:   'var(--color-bg-input)',
    border:       '1px solid var(--color-border)',
    borderRadius: 'var(--us-r-shell)',
    overflow:     'hidden',
  },
  '.underleaf-search .us-nav button': {
    width:          'var(--us-row-h)',
    padding:        0,
    background:     'transparent',
    border:         0,
    cursor:         'pointer',
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    color:          'var(--color-text-secondary)',
    transition:     'background 120ms, color 120ms',
  },
  '.underleaf-search .us-nav button + button': {
    borderLeft: '1px solid var(--color-border)',
  },
  '.underleaf-search .us-nav button:hover': {
    background: 'var(--us-brand-tint)',
    color:      'var(--color-brand)',
  },
  '.underleaf-search .us-nav svg': {
    width:   '12px',
    height:  '12px',
    display: 'block',
  },

  // Close X — square ghost icon button
  '.underleaf-search .us-close': {
    width:          'var(--us-row-h)',
    padding:        0,
    background:     'transparent',
    border:         0,
    borderRadius:   'var(--us-r-control)',
    cursor:         'pointer',
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    color:          'var(--color-text-muted)',
    transition:     'background 120ms, color 120ms',
  },
  '.underleaf-search .us-close:hover': {
    background: 'var(--us-neutral-tint)',
    color:      'var(--color-text-primary)',
  },
  '.underleaf-search .us-close svg': {
    width:   '12px',
    height:  '12px',
    display: 'block',
  },

  // ── Row-2 trailing: Replace / All ──────────────────────────────────────
  '.underleaf-search .us-btn': {
    height:         'var(--us-row-h)',
    padding:        '0 14px',
    borderRadius:   'var(--us-r-control)',
    fontFamily:     'var(--font-sans)',
    fontSize:       'var(--us-font-ui)',
    fontWeight:     500,
    cursor:         'pointer',
    whiteSpace:     'nowrap',
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    transition:     'background 120ms, color 120ms, border-color 120ms, filter 120ms',
  },
  '.underleaf-search .us-btn-ghost': {
    background: 'transparent',
    color:      'var(--color-text-primary)',
    border:     '1px solid var(--color-border)',
  },
  '.underleaf-search .us-btn-ghost:hover': {
    background:  'var(--us-neutral-tint)',
    borderColor: 'var(--color-border-light)',
  },
  '.underleaf-search .us-btn-primary': {
    background: 'var(--color-brand)',
    color:      '#ffffff',
    border:     '1px solid var(--color-brand)',
    fontWeight: 600,
    boxShadow:  '0 1px 0 rgba(255, 255, 255, 0.18) inset, 0 1px 2px rgba(0, 0, 0, 0.18)',
  },
  '.underleaf-search .us-btn-primary:hover': {
    filter: 'brightness(1.08)',
  },
})
