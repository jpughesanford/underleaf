import type { EditorState } from '@codemirror/state'
import { EditorView, ViewUpdate } from '@codemirror/view'
import type { Panel } from '@codemirror/view'
import {
  findNext, findPrevious, replaceNext, replaceAll, closeSearchPanel,
  getSearchQuery, setSearchQuery, SearchQuery, searchPanelOpen,
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
  // Deliberately omit `cm-search`. @codemirror/search's baseTheme attaches
  // a block of input/button defaults under `.cm-panel.cm-search` — margins,
  // font sizes, the close-X absolute positioning — that conflict with this
  // panel's grid layout. Since we supply a custom `createPanel`, the class
  // has no functional use (CM doesn't query it); inheriting it would just
  // mean fighting CM's defaults from this theme rule-by-rule.
  root.className = 'underleaf-search'
  // Flat 5-child grid (3 cols × 2 rows). Auto-flow row places items in order;
  // the final cell at (2, 3) stays empty by design — that's the breathing room
  // beneath the close button.
  //
  //   col 1 (1fr)        col 2 (pill-w)             col 3 (close-w)
  //   ┌──────────────┐   ┌──────────────────────┐   ┌──────┐
  //   │  find field  │   │  prev  │  next       │   │   ✕  │
  //   └──────────────┘   └──────────────────────┘   └──────┘
  //   ┌──────────────┐   ┌──────────────────────┐
  //   │ replace field│   │ Replace │   All      │    (empty)
  //   └──────────────┘   └──────────────────────┘
  //
  // Both fields share col 1 → field right edges align.
  // Both pills share col 2 with fixed width → pill left AND right edges align.
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
    <div class="us-nav us-pill">
      <button type="button" class="us-prev" title="Previous match (⇧⌘G)" aria-label="Previous match">${SVG_PREV}</button>
      <button type="button" class="us-next" title="Next match (⌘G)" aria-label="Next match">${SVG_NEXT}</button>
    </div>
    <button type="button" class="us-close" title="Close (Esc)" aria-label="Close search">${SVG_CLOSE}</button>
    <div class="us-field us-field-replace">
      <span class="us-lead">${SVG_REPLACE}</span>
      <input class="us-input us-replace" type="text" placeholder="Replace with…" spellcheck="false" autocomplete="off" />
    </div>
    <div class="us-actions us-pill">
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
//   radius scale      pill · 11 (card) · 8 (shell) · 6 (control)
//   height scale      32 (row) · 24 (inset control)
//   font scale        12.5 mono · 12 ui · 10.5 micro
//
// All accent colors derive from `--color-brand` / `--color-warning` via
// `color-mix()`, so any theme (cherry-blossom, nord, solarized, dark, light)
// dyes the panel correctly without hardcoded RGB values.
//
// NOTE: CodeMirror's default baseTheme paints `.cm-panels` via `&light/&dark`
// selectors which compile to a higher-specificity `.cm-light .cm-panels`. We
// can't reuse `&light/&dark` here — `EditorView.theme` rejects them (only
// `baseTheme` accepts the scope map). We win the cascade with `!important`
// from a plain selector instead.
const searchPanelStyles = EditorView.theme({
  // ── Container reset ────────────────────────────────────────────────────
  '.cm-panels': {
    backgroundColor: 'transparent !important',
    color: 'var(--color-text-primary) !important',
    borderColor: 'transparent !important',
  },
  // Float the top-panel container OVER the editor instead of stacking it
  // in the layout flow. `.cm-editor` is `position: relative` by default, so
  // the absolute positioning anchors to the editor frame. The container
  // itself is `pointer-events: none` so clicks anywhere outside the panel
  // body still reach the editor; the panel re-enables them.
  '.cm-panels.cm-panels-top': {
    position:      'absolute',
    top:           0,
    left:          0,
    right:         0,
    zIndex:        5,
    pointerEvents: 'none',
    borderBottom:  'none !important',
  },
  '.cm-panels.cm-panels-bottom': { borderTop: 'none !important' },

  // ── Card shell + design tokens ─────────────────────────────────────────
  '.underleaf-search': {
    // Design tokens — single source of truth for the whole component.
    '--us-pad':           '11px',
    '--us-gap':           '7px',
    '--us-gap-tight':     '3px',
    '--us-row-h':         '32px',
    '--us-pill-w':        '132px',
    '--us-ctrl-h':        '24px',
    '--us-ctrl-pad':      '8px',
    '--us-r-card':        '11px',
    '--us-r-shell':       '8px',
    '--us-r-control':     '6px',
    '--us-font-input':    '12.5px',
    '--us-font-ui':       '12px',
    '--us-font-micro':    '10.5px',

    // Theme-derived tints — every accent flows from the active theme's
    // `--color-brand` / `--color-warning`, so cherry-blossom dyes pink,
    // dark-verdant stays green, nord goes blue, etc., with zero overrides.
    '--us-brand-tint':       'color-mix(in srgb, var(--color-brand) 12%, transparent)',
    '--us-brand-tint-hover': 'color-mix(in srgb, var(--color-brand) 18%, transparent)',
    '--us-brand-edge':       'color-mix(in srgb, var(--color-brand) 28%, transparent)',
    '--us-brand-ring':       'color-mix(in srgb, var(--color-brand) 22%, transparent)',
    '--us-warn-tint':        'color-mix(in srgb, var(--color-warning) 16%, transparent)',
    '--us-warn-edge':        'color-mix(in srgb, var(--color-warning) 32%, transparent)',
    '--us-neutral-tint':     'color-mix(in srgb, var(--color-text-muted) 14%, transparent)',
    '--us-neutral-strong':   'color-mix(in srgb, var(--color-text-muted) 22%, transparent)',
    '--us-inset-hl':         'color-mix(in srgb, white 18%, transparent)',
    '--us-shadow-deep':      'color-mix(in srgb, black 14%, transparent)',
    '--us-shadow-near':      'color-mix(in srgb, black 8%, transparent)',

    // 3×2 grid:
    //   col 1 = input column (1fr)
    //   col 2 = pill column (fixed --us-pill-w, shared by nav + actions pills)
    //   col 3 = close column (fixed --us-row-h, square — empty cell on row 2)
    //
    // Fixed col 2 means both pills are identical width, so their left AND
    // right edges align between rows. The empty cell at (2, 3) is the
    // breathing room beneath the close button.
    display:             'grid',
    gridTemplateColumns: 'minmax(0, 1fr) var(--us-pill-w) var(--us-row-h)',
    gridTemplateRows:    'var(--us-row-h) var(--us-row-h)',
    columnGap:           'var(--us-gap)',
    rowGap:              'var(--us-gap)',
    padding:             'var(--us-pad)',
    margin:              'var(--us-pad)',
    background:          'var(--color-bg-card)',
    border:              '1px solid var(--color-border)',
    borderRadius:        'var(--us-r-card)',
    // Layered depth: a hair of inset highlight along the top edge, then a
    // wide soft drop catching the room, then a tight near-shadow for the
    // 1px crease beneath. The triple makes the card feel set on the page
    // rather than pasted to it.
    boxShadow: [
      '0 1px 0 var(--us-inset-hl) inset',
      '0 14px 36px -12px var(--us-shadow-deep)',
      '0 2px 6px -1px var(--us-shadow-near)',
    ].join(', '),
    fontFamily:          'var(--font-sans)',
    fontSize:            'var(--us-font-ui)',
    fontFeatureSettings: '"ss01", "cv11"',
    color:               'var(--color-text-primary)',
    position:            'relative',
    isolation:           'isolate',
    // Re-enable pointer events inside the panel body — the surrounding
    // `.cm-panels-top` container is `pointer-events: none` so editor
    // clicks outside the card pass through to the editor below.
    pointerEvents:       'auto',
    // Establish a size container so the panel can hide non-essential
    // controls as the editor pane gets narrow, without depending on the
    // viewport width.
    containerType:       'inline-size',
    containerName:       'us-panel',
    animation:           'underleaf-search-in 240ms cubic-bezier(.2, .7, .2, 1)',
  },
  // Below 480px of panel width the find input gets squeezed by the trio
  // of modifier toggles; hide them so the input has room. The count chip
  // is preserved — it carries information no other control can replace.
  '@container us-panel (max-width: 480px)': {
    '.underleaf-search .us-mod': {
      display: 'none',
    },
  },
  // A second-row reveal that trails the card a touch — feels like the
  // panel unfolds into shape rather than landing all at once.
  '.underleaf-search .us-field-replace, .underleaf-search .us-actions': {
    animation: 'underleaf-search-row-in 320ms cubic-bezier(.2, .7, .2, 1) both',
    animationDelay: '60ms',
  },
  '@keyframes underleaf-search-in': {
    from: { transform: 'translateY(-6px) scale(0.985)', opacity: 0 },
    to:   { transform: 'translateY(0) scale(1)',         opacity: 1 },
  },
  '@keyframes underleaf-search-row-in': {
    from: { transform: 'translateY(-3px)', opacity: 0 },
    to:   { transform: 'translateY(0)',    opacity: 1 },
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
    transition:   'border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease',
  },
  '.underleaf-search .us-field:hover': {
    borderColor: 'var(--color-border-light, var(--color-border))',
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
    transition:     'color 160ms ease, transform 200ms cubic-bezier(.2, .7, .2, 1)',
  },
  '.underleaf-search .us-field:focus-within .us-lead': {
    color: 'var(--color-brand)',
  },
  '.underleaf-search .us-field-find:focus-within .us-lead': {
    // The magnifier hops a fraction when the field activates — a small
    // craft signal that the search query is now live.
    transform: 'scale(1.08)',
  },
  '.underleaf-search .us-lead svg': {
    width:   '14px',
    height:  '14px',
    display: 'block',
  },

  // Text input — fills the remaining field width
  '.underleaf-search .us-input': {
    flex:               '1 1 auto',
    minWidth:           0,
    background:         'transparent',
    border:             0,
    outline:            0,
    padding:            '0 var(--us-gap) 0 0',
    color:              'inherit',
    fontFamily:         'var(--font-mono)',
    fontSize:           'var(--us-font-input)',
    fontFeatureSettings: '"ss03", "cv11", "calt"',
    letterSpacing:      '0.005em',
  },
  '.underleaf-search .us-input::placeholder': {
    color:         'var(--color-text-muted)',
    fontStyle:     'italic',
    letterSpacing: '0.01em',
  },
  '.underleaf-search .us-input::selection': {
    background: 'var(--us-brand-tint-hover)',
    color:      'var(--color-text-primary)',
  },

  // Trailing cluster inside the find field (modifier toggles + count chip)
  '.underleaf-search .us-trail': {
    flex:         'none',
    display:      'flex',
    alignItems:   'center',
    gap:          'var(--us-gap-tight)',
    paddingRight: '5px',
  },

  // ── Inset controls (live inside the find field's frame) ────────────────
  // Modifier toggles — ghost until active, then brand-tinted with a thin
  // inset ring that makes the chip read as pressed.
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
    letterSpacing: '0.02em',
    color:        'var(--color-text-muted)',
    cursor:       'pointer',
    transition:   'background 140ms, color 140ms, box-shadow 140ms',
  },
  '.underleaf-search .us-mod:hover': {
    background: 'var(--us-neutral-tint)',
    color:      'var(--color-text-primary)',
  },
  '.underleaf-search .us-mod.is-on': {
    background: 'var(--us-brand-tint)',
    color:      'var(--color-brand)',
    boxShadow:  '0 0 0 1px var(--us-brand-edge) inset',
  },
  '.underleaf-search .us-mod.is-on:hover': {
    background: 'var(--us-brand-tint-hover)',
  },

  // Count chip — pill, three states (matches / empty / zero-results).
  // Slightly tighter padding + bumped weight so the digits sit confidently.
  '.underleaf-search .us-count': {
    display:            'inline-flex',
    alignItems:         'center',
    height:             'var(--us-ctrl-h)',
    padding:            '0 9px',
    marginLeft:         '2px',
    borderRadius:       '999px',
    border:             '1px solid transparent',
    fontFamily:         'var(--font-sans)',
    fontSize:           'var(--us-font-micro)',
    fontWeight:         600,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing:      '0.015em',
    whiteSpace:         'nowrap',
    background:         'var(--us-brand-tint)',
    color:              'var(--color-brand)',
    borderColor:        'var(--us-brand-edge)',
    transition:         'background 160ms, color 160ms, border-color 160ms',
  },
  '.underleaf-search .us-count-sep': {
    opacity:     0.4,
    fontWeight:  400,
    padding:     '0 2px',
  },
  '.underleaf-search .us-count-tot': {
    opacity:    0.75,
    fontWeight: 500,
  },
  '.underleaf-search .us-count.is-empty': {
    background:  'var(--us-neutral-tint)',
    color:       'var(--color-text-muted)',
    borderColor: 'transparent',
  },
  '.underleaf-search .us-count.is-zero': {
    background:  'var(--us-warn-tint)',
    color:       'var(--color-warning)',
    borderColor: 'var(--us-warn-edge)',
  },

  // ── Segmented pill (shared by nav + actions) ───────────────────────────
  // Both pills are sized by their grid column (--us-pill-w), so they always
  // share width regardless of internal content. Inside each pill, children
  // are flex items: equal-weight for nav, asymmetric for actions.
  //
  // The 1px edge is painted as an *inset* box-shadow rather than a real
  // border. Chromium has a long-standing bug where `overflow: hidden` plus
  // `border-radius` plus a 1px `border` leaves a hairline gap between the
  // border edge and the round clip — inner button hover fills leak through
  // it at the corners. With the edge moved to an inset shadow, the
  // children's `border-radius` can run all the way to the pill's outer
  // round, so no mismatch exists.
  '.underleaf-search .us-pill': {
    display:      'flex',
    alignItems:   'stretch',
    background:   'var(--color-bg-input)',
    borderRadius: 'var(--us-r-shell)',
    boxShadow:    '0 0 0 1px var(--color-border) inset',
    overflow:     'hidden',
    transition:   'box-shadow 160ms ease',
  },
  '.underleaf-search .us-pill:hover': {
    boxShadow: '0 0 0 1px var(--color-border-light, var(--color-border)) inset',
  },
  // Internal divider between segmented children.
  '.underleaf-search .us-pill button + button': {
    boxShadow: '-1px 0 0 0 var(--color-border)',
  },
  // The edge buttons round to the pill's *full* outer radius — the inset
  // shadow paints the 1px edge over the top, so children can occupy the
  // entire round without a corner mismatch.
  '.underleaf-search .us-pill > :first-child': {
    borderTopLeftRadius:    'var(--us-r-shell)',
    borderBottomLeftRadius: 'var(--us-r-shell)',
  },
  '.underleaf-search .us-pill > :last-child': {
    borderTopRightRadius:    'var(--us-r-shell)',
    borderBottomRightRadius: 'var(--us-r-shell)',
  },

  // Nav pill: prev + next share width 50/50, brand-tinted on hover.
  '.underleaf-search .us-nav button': {
    flex:           '1 1 0',
    minWidth:       0,
    padding:        0,
    background:     'transparent',
    border:         0,
    cursor:         'pointer',
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    color:          'var(--color-text-secondary)',
    transition:     'background 140ms, color 140ms, transform 80ms ease',
  },
  '.underleaf-search .us-nav button:hover': {
    background: 'var(--us-brand-tint)',
    color:      'var(--color-brand)',
  },
  '.underleaf-search .us-nav button:active': {
    background: 'var(--us-brand-tint-hover)',
    transform:  'scale(0.94)',
  },
  '.underleaf-search .us-nav svg': {
    width:   '12px',
    height:  '12px',
    display: 'block',
  },

  // Actions pill: Replace grows to fill the remaining width, All stays at
  // content width — so "Replace" reads wider than "All" inside a pill that
  // exactly matches the nav pill above.
  '.underleaf-search .us-btn': {
    padding:        '0 14px',
    background:     'transparent',
    border:         0,
    cursor:         'pointer',
    fontFamily:     'var(--font-sans)',
    fontSize:       'var(--us-font-ui)',
    fontWeight:     500,
    letterSpacing:  '0.008em',
    whiteSpace:     'nowrap',
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
    transition:     'background 140ms, color 140ms, filter 140ms, transform 80ms ease',
  },
  '.underleaf-search .us-btn:active': {
    transform: 'translateY(0.5px)',
  },
  // Both buttons split the pill 50/50. Replace is the baseline ghost
  // treatment; All carries one tonal step of additional weight — a soft
  // neutral tint and 600 weight — to mark it as the more impactful action
  // without resorting to a brand fill.
  '.underleaf-search .us-btn-ghost': {
    flex:     '1 1 0',
    minWidth: 0,
    color:    'var(--color-text-primary)',
  },
  '.underleaf-search .us-btn-ghost:hover': {
    background: 'var(--us-neutral-tint)',
  },
  '.underleaf-search .us-btn-primary': {
    flex:       '1 1 0',
    minWidth:   0,
    background: 'var(--us-neutral-tint)',
    color:      'var(--color-text-primary)',
    fontWeight: 600,
  },
  '.underleaf-search .us-btn-primary:hover': {
    background: 'var(--us-neutral-strong)',
  },

  // ── Close X — standalone square button, sits to the right of the nav pill
  '.underleaf-search .us-close': {
    padding:        0,
    background:     'transparent',
    border:         0,
    borderRadius:   'var(--us-r-control)',
    cursor:         'pointer',
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    color:          'var(--color-text-muted)',
    transition:     'background 140ms, color 140ms, transform 200ms cubic-bezier(.2, .7, .2, 1)',
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
})

// With the panel floating over the editor, programmatic scrolls (jump to
// match, cursor-into-view, …) must keep their target visible *below* the
// panel rather than under it. We measure the panel on demand so layout
// tweaks to the card don't require updating a hardcoded number; the +11
// is the panel's own outer margin, included so the match doesn't kiss
// the card's lower edge.
const searchPanelScrollMargin = EditorView.scrollMargins.of(view => {
  if (!searchPanelOpen(view.state)) return null
  const panel = view.dom.querySelector('.underleaf-search') as HTMLElement | null
  return { top: panel ? panel.offsetHeight + 11 : 110 }
})

export const underleafSearchPanelTheme = [
  searchPanelStyles,
  searchPanelScrollMargin,
]
