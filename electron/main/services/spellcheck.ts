import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { DEFAULT_SPELL_LANGUAGE, spellPackageFor } from '@shared/spell-languages'

// The `dictionary-*` packages are ESM-only and read their own files via fs, so
// rather than import them we resolve each package's entry and read the sibling
// Hunspell files directly. The renderer's hunspell-asm engine runs on the strings
// we hand it. Cached per package since a dictionary never changes within a run.
//
// NOTE: resolve the BARE package name, not `<pkg>/index.js` — these packages
// only export ".", so the subpath is blocked (ERR_PACKAGE_PATH_NOT_EXPORTED).
const cache = new Map<string, { aff: string; dic: string }>()

export function loadDictionary(lang: string = DEFAULT_SPELL_LANGUAGE): { aff: string; dic: string } {
  const pkg = spellPackageFor(lang)
  const cached = cache.get(pkg)
  if (cached) return cached

  const pkgDir = dirname(require.resolve(pkg))
  const data = {
    aff: readFileSync(join(pkgDir, 'index.aff'), 'utf8'),
    dic: readFileSync(join(pkgDir, 'index.dic'), 'utf8'),
  }
  cache.set(pkg, data)
  return data
}
