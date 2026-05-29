// Supported spell-check languages, shared by the main process (which resolves
// the dictionary package) and the renderer's Settings UI (which lists them).
// Each package has the same shape: a bare entry point plus sibling index.aff /
// index.dic Hunspell files.

export interface SpellLanguage {
  code: string
  label: string
  /** npm package providing the Hunspell .aff/.dic — used in the main process. */
  pkg: string
}

export const SPELL_LANGUAGES: SpellLanguage[] = [
  { code: 'en',    label: 'English (US)',         pkg: 'dictionary-en' },
  { code: 'en-GB', label: 'English (UK)',         pkg: 'dictionary-en-gb' },
  { code: 'de',    label: 'German',               pkg: 'dictionary-de' },
  { code: 'fr',    label: 'French',               pkg: 'dictionary-fr' },
  { code: 'es',    label: 'Spanish',              pkg: 'dictionary-es' },
  { code: 'it',    label: 'Italian',              pkg: 'dictionary-it' },
  { code: 'pt-BR', label: 'Portuguese (Brazil)',  pkg: 'dictionary-pt-br' },
  { code: 'nl',    label: 'Dutch',                pkg: 'dictionary-nl' },
  { code: 'sv',    label: 'Swedish',              pkg: 'dictionary-sv' },
  { code: 'pl',    label: 'Polish',               pkg: 'dictionary-pl' },
  { code: 'ru',    label: 'Russian',              pkg: 'dictionary-ru' },
]

export const DEFAULT_SPELL_LANGUAGE = 'en'

/** The dictionary package for a language code, falling back to the default. */
export function spellPackageFor(code: string): string {
  return SPELL_LANGUAGES.find(l => l.code === code)?.pkg
    ?? SPELL_LANGUAGES.find(l => l.code === DEFAULT_SPELL_LANGUAGE)!.pkg
}
