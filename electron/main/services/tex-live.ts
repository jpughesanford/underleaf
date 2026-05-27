import { existsSync } from 'fs'
import { execSync } from 'child_process'

// Common TeX Live installation paths on macOS — these aren't on the default
// app PATH when the user launches via Finder, so we search them explicitly.
const TEX_EXTRA_DIRS = [
  '/Library/TeX/texbin',
  '/usr/local/texlive/2024/bin/universal-darwin',
  '/usr/local/texlive/2024/bin/x86_64-darwin',
  '/usr/local/texlive/2024/bin/aarch64-darwin',
  '/usr/local/texlive/2023/bin/universal-darwin',
  '/usr/local/texlive/2023/bin/x86_64-darwin',
  '/usr/local/texlive/2023/bin/aarch64-darwin',
  '/opt/homebrew/bin',
  '/usr/local/bin',
]

/**
 * Find the latexmk binary. Prefers a user-specified override, otherwise probes
 * the standard PATH augmented with common TeX Live install locations.
 *
 * @param customPath  Optional explicit path saved by the user (from Settings).
 * @returns           Absolute path to latexmk, or null if not found.
 */
export function resolveLatexmkPath(customPath?: string | null): string | null {
  if (customPath && existsSync(customPath)) return customPath

  const augmentedPath = [...TEX_EXTRA_DIRS, process.env.PATH ?? ''].join(':')
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
