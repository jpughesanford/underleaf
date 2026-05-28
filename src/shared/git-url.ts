// Pure helpers for parsing git remote URLs. Shared between the renderer's
// CloneModal (deriving a default project name as you type) and the main
// process's project scanner (deriving a display name from a repo's remote).

/**
 * Pull the git URL out of pasted input, which may be a bare URL or a full
 * `git clone [flags] <url> [dir]` command. Picks the first token that looks
 * like a git URL (has a scheme or is scp-style), so flags that take values
 * (e.g. `--depth 1`) don't get mistaken for the URL. Falls back to the first
 * token after stripping `git clone` if nothing looks URL-shaped.
 */
export function extractGitUrl(input: string): string {
  const tokens = input.trim().replace(/^git\s+clone\s+/i, '').split(/\s+/).filter(Boolean)
  const urlLike = tokens.find(t =>
    /:\/\//.test(t) ||            // https://, ssh://, git://
    /^[\w.-]+@[\w.-]+:/.test(t),  // scp-style git@host:path
  )
  return urlLike ?? tokens[0] ?? ''
}

/** Last path segment of a git URL, with the `.git` suffix and trailing slashes removed. */
export function repoNameFromUrl(url: string): string {
  const cleaned = url.replace(/\.git$/, '').replace(/\/+$/, '')
  return cleaned.split('/').pop() ?? ''
}

/**
 * Overleaf git-bridge URLs end in a 24-char hex project id rather than a
 * human-readable name (e.g. .../git/65a1b2c3...). Detect those so callers can
 * fall back to a friendlier name.
 */
export function isOverleafId(segment: string): boolean {
  return /^[0-9a-f]{20,}$/i.test(segment)
}

/**
 * Display name for a project: the remote's repo name if it's human-readable,
 * otherwise the directory name. Overleaf hex ids are treated as not
 * human-readable so they fall back to the folder name the user chose.
 */
export function deriveProjectName(repoPath: string, remoteUrl: string | null): string {
  const dirName = repoPath.split('/').pop() || repoPath
  if (remoteUrl) {
    const segment = repoNameFromUrl(remoteUrl)
    if (segment && !isOverleafId(segment)) return segment
  }
  return dirName
}
