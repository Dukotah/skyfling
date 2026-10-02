import { defineConfig } from 'vitest/config'

// Unit tests live next to source as src/**/*.test.ts.
// The Playwright smoke test under tests/ is excluded here (run via `npm run smoke`).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
