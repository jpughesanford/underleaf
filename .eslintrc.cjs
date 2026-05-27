module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    // Catches the class of bug that broke the renderer (undeclared identifier).
    'no-undef': 'off', // TS handles this; ESLint can't see DOM/globals correctly without env config.

    // Unused params/vars with `_` prefix are intentional; everything else is cruft.
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    }],

    // React hooks correctness — would have caught useEffect dep-array issues.
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // We use a lot of `as` casts at IPC boundaries; downgrade noise.
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/ban-ts-comment': ['warn', {
      'ts-ignore': 'allow-with-description',
      'ts-expect-error': 'allow-with-description',
    }],

    // Empty catch blocks for "ignore" patterns are intentional in this codebase.
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
  ignorePatterns: [
    'node_modules/',
    'out/',
    'dist/',
    '*.config.ts',
    '*.config.js',
    'electron/afterPack.js',
  ],
}
