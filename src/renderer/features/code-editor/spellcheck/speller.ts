import { loadModule } from 'hunspell-asm'

// Real Hunspell compiled to WASM (inlined in the package — no asset to serve).
// Runs in the renderer because spell-checking is on the editor's hot path and
// can't go per-word over IPC; the .aff/.dic come from the main process. Added
// words persist in settings so they survive across files and sessions.
//
// NOTE: hunspell-asm + emscripten-wasm-loader ship broken ESM (a nanoid call on
// a namespace import) — see patches/. If a dependency bump makes those patches
// stop applying, this feature breaks; the console.error below will say so.

// Types aren't re-exported from the package root, so derive them.
type HunspellFactory = Awaited<ReturnType<typeof loadModule>>
type Hunspell = ReturnType<HunspellFactory['create']>

export interface Speller {
  correct: (word: string) => boolean
  suggest: (word: string) => string[]
  add: (word: string) => void
}

const CUSTOM_WORDS_KEY = 'spellcheckCustomWords'

// The WASM module loads once; dictionaries are mounted per language on top of it.
let factoryPromise: Promise<HunspellFactory> | null = null
function getFactory(): Promise<HunspellFactory> {
  if (!factoryPromise) {
    // Clear a rejected load so a later attempt retries instead of being stuck on
    // the cached failure for the whole session (matches the speller-level retry).
    factoryPromise = loadModule().catch((err) => {
      factoryPromise = null
      throw err
    })
  }
  return factoryPromise
}

let currentLang: string | null = null
let spellerPromise: Promise<Speller> | null = null
// Synchronous handle for the CodeMirror plugin's hot path — null while a (re)load
// for the active language is in flight.
let ready: Speller | null = null

// The live instance + its mounted files, so a language switch can free them.
let active: { hunspell: Hunspell; mounts: string[] } | null = null

/**
 * Resolve the speller for `lang`, (re)building it when the language changes.
 * Subsequent calls for the same language reuse the instance.
 */
export function getSpeller(lang: string): Promise<Speller> {
  if (lang !== currentLang || !spellerPromise) {
    currentLang = lang
    ready = null
    spellerPromise = build(lang).catch((err) => {
      // Surface the failure (this was previously swallowed, making a broken
      // spell checker impossible to diagnose) and clear the cached rejection so
      // a later trigger retries instead of staying dead for the whole session.
      console.error(`[spellcheck] failed to load dictionary "${lang}":`, err)
      if (currentLang === lang) {
        spellerPromise = null
        currentLang = null
      }
      throw err
    })
  }
  return spellerPromise
}

/** The loaded speller, or null if it isn't ready yet (used in render hot paths). */
export function spellerSync(): Speller | null {
  return ready
}

async function build(lang: string): Promise<Speller> {
  const factory = await getFactory()
  const { aff, dic } = await window.api.spellcheck.dictionary(lang)
  // All shipped dictionaries declare `SET UTF-8`, so UTF-8 bytes are faithful.
  const enc = new TextEncoder()
  const affPath = factory.mountBuffer(enc.encode(aff), `${lang}.aff`)
  const dicPath = factory.mountBuffer(enc.encode(dic), `${lang}.dic`)
  const hunspell = factory.create(affPath, dicPath)

  for (const word of await loadCustomWords()) hunspell.addWord(word)

  const speller: Speller = {
    correct: (word) => hunspell.spell(word),
    // Cap suggestions so the context menu stays compact.
    suggest: (word) => hunspell.suggest(word).slice(0, 8),
    add: (word) => {
      hunspell.addWord(word)
      void persistCustomWord(word)
    },
  }

  if (currentLang === lang) {
    // Free the previous language's instance + files, then promote this one.
    if (active) {
      active.hunspell.dispose()
      for (const p of active.mounts) factory.unmount(p)
    }
    active = { hunspell, mounts: [affPath, dicPath] }
    ready = speller
  } else {
    // A newer language load superseded us mid-flight — clean up and bow out.
    hunspell.dispose()
    factory.unmount(affPath)
    factory.unmount(dicPath)
  }
  return speller
}

async function loadCustomWords(): Promise<string[]> {
  const settings = (await window.api.store.get('settings')) as Record<string, unknown> | null
  const words = settings?.[CUSTOM_WORDS_KEY]
  return Array.isArray(words) ? (words as string[]) : []
}

async function persistCustomWord(word: string): Promise<void> {
  const settings = ((await window.api.store.get('settings')) as Record<string, unknown> | null) ?? {}
  const words = Array.isArray(settings[CUSTOM_WORDS_KEY]) ? (settings[CUSTOM_WORDS_KEY] as string[]) : []
  if (words.includes(word)) return
  await window.api.store.set('settings', { ...settings, [CUSTOM_WORDS_KEY]: [...words, word] })
}
