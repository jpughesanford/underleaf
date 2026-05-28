// Resolve the file path reported by a LaTeX compile error to an absolute path
// inside the project. Pure so it can be unit-tested — the renderer's jump-to-error
// flow calls this, then opens the resulting path.

/**
 * @param projectPath  Absolute path to the project root.
 * @param file         Path as reported in the compile log — may be absolute,
 *                     relative, or contain ../.. segments.
 * @returns            Absolute path. If normalization escapes the project root
 *                     (the log referenced a file outside the project), falls
 *                     back to the bare filename resolved inside the project.
 */
export function resolveErrorPath(projectPath: string, file: string): string {
  if (file.startsWith('/')) return file

  // Collapse ./ and ../ segments relative to the project root.
  const segments = `${projectPath}/${file}`.split('/')
  const resolved: string[] = []
  for (const seg of segments) {
    if (seg === '..') resolved.pop()
    else if (seg !== '.') resolved.push(seg)
  }
  const normalized = resolved.join('/')

  return (normalized === projectPath || normalized.startsWith(projectPath + '/'))
    ? normalized
    : `${projectPath}/${file.split('/').pop() ?? file}`
}
