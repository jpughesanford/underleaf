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

/**
 * Whether a pasted string is safe to hand to `git clone`. Accepts only the
 * transports git clones over a network — http(s), ssh, and scp-style
 * `user@host:path` — and rejects everything else. This is a security boundary,
 * not just UX: a leading `-` is read by git as a flag, and the `ext::`/`fd::`
 * transports let a remote string execute arbitrary commands, so a clone URL is
 * attacker-reachable input (e.g. a shared "clone my paper" link).
 */
export function isSafeCloneUrl(input: string): boolean {
  const url = input.trim()
  if (!url || url.startsWith('-')) return false
  // Conservative character class — real repo URLs don't contain shell
  // metacharacters ($ ; " ` & | < > spaces), so requiring this set rejects
  // `$IFS`-style payloads even though the clone itself no longer uses a shell.
  if (/^(https?|ssh):\/\/[A-Za-z0-9._~:/@%+-]+$/i.test(url)) return true
  if (/^[\w.-]+@[\w.-]+:[A-Za-z0-9._~/@%+-]+$/.test(url)) return true // scp-style
  return false
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
