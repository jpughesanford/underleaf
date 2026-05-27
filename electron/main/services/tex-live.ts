import { existsSync, readdirSync, statSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'

// Fixed paths that don't change between TeX Live versions.
const FIXED_TEX_DIRS = [
  '/Library/TeX/texbin',
  '/opt/homebrew/bin',
  '/usr/local/bin',
]

// Discover /usr/local/texlive/<YEAR>/bin/<arch> directories at runtime so new
// TeX Live releases work without code changes.
function discoverTexLiveBinDirs(): string[] {
  const root = '/usr/local/texlive'
  if (!existsSync(root)) return []
  const dirs: string[] = []
  try {
    for (const entry of readdirSync(root)) {
      // Only look at year-named subdirs; skip aliases like "current" symlinks.
      if (!/^\d{4}$/.test(entry)) continue
      const binDir = join(root, entry, 'bin')
      if (!existsSync(binDir)) continue
      for (const arch of readdirSync(binDir)) {
        const archDir = join(binDir, arch)
        try {
          if (statSync(archDir).isDirectory()) dirs.push(archDir)
        } catch { /* skip */ }
      }
    }
  } catch { /* /usr/local/texlive isn't readable */ }
  // Newest year first so the latest TeX Live wins.
  return dirs.sort().reverse()
}

/**
 * Find the latexmk binary. Prefers a user-specified override, otherwise probes
 * the standard PATH augmented with common TeX Live install locations.
 *
 * @param customPath  Optional explicit path saved by the user (from Settings).
 * @returns           Absolute path to latexmk, or null if not found.
 */
export function resolveLatexmkPath(customPath?: string | null): string | null {
  if (customPath && existsSync(customPath)) return customPath

  const augmentedPath = [...discoverTexLiveBinDirs(), ...FIXED_TEX_DIRS, process.env.PATH ?? ''].join(':')
  try {
    const found = execSync('which latexmk', {
      encoding: 'utf8',
      env: { ...process.env, PATH: augmentedPath },
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    if (found && existsSync(found)) return found
  } catch {
    // not found on PATH
  }

  return null
}
