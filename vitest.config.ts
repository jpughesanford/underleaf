import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@': resolve(__dirname, 'src/renderer'),
      '@renderer': resolve(__dirname, 'src/renderer'),
    },
  },
  test: {
    // Service tests are pure Node — no DOM needed. If we add renderer hook
    // tests later we can flip this to 'jsdom' or scope per-file.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Keep test files out of TS project compilation; they're checked by Vitest's own tsc.
    typecheck: {
      enabled: false,
    },
    coverage: {
      provider: 'v8',
      // Scope coverage to the pure logic we actually unit-test, so the number
      // tracks regressions in that logic rather than being diluted by code that
      // isn't meant to be unit-tested. Deliberately excluded:
      //   - thin IO wrappers around fs / simple-git (git.ts, files.ts, projects.ts,
      //     compile.ts's runCompile/readPdf/etc) — testing them tests the library
      //   - React components + hooks (need jsdom; not yet covered)
      //   - type-only files (types.ts, ipc-contract.ts) — no executable code
      include: [
        'src/shared/error-path.ts',
        'src/shared/git-url.ts',
        'electron/main/services/compile.ts',
        'electron/main/services/git.ts',
        'src/renderer/features/code-editor/extensions/conflicts.ts',
        'src/renderer/features/code-editor/extensions/search-panel.ts',
      ],
      // Terminal summary only. Add 'html' here for a clickable line-by-line
      // report (writes to coverage/, which is gitignored).
      reporter: ['text'],
    },
  },
})
