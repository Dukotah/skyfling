import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'legacy', 'node_modules', 'playwright-report', 'test-results', '.tmp-viewer', '.assets-cache', 'src/assets/manifest.generated.ts', 'docs'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Build-time node scripts (icon generation, asset fetching, budget checks).
    files: ['scripts/**/*.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },
  // --- Layer boundaries (docs/ARCHITECTURE.md §1): data → sim → world → render → ui → game → main ---
  {
    files: ['src/data/**/*.ts', 'src/sim/**/*.ts', 'src/util/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['three', 'three/*'], message: 'data/sim are pure: no three.js' },
        { group: ['**/world/*', '**/render/*', '**/ui/*', '**/game/*', '**/audio/*', '**/save/*'], message: 'data/sim may not import higher layers' },
      ] }],
    },
  },
  {
    files: ['src/world/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['**/render/*', '**/ui/*', '**/game/*', '**/audio/*', '**/save/*'], message: 'world may not import render/ui/game' },
      ] }],
    },
  },
  {
    files: ['src/render/**/*.ts', 'src/assets/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['**/ui/*', '**/game/*', '**/save/*'], message: 'render may not import ui/game/save' },
      ] }],
    },
  },
  {
    files: ['src/ui/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['three', 'three/*'], message: 'ui is DOM only: no three.js' },
        { group: ['**/game/*'], message: 'ui may not import game (game drives ui)' },
      ] }],
    },
  },
)
