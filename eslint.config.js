import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'legacy', 'node_modules', 'playwright-report', 'test-results'] },
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
)
