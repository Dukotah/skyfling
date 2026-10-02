import { defineConfig, devices } from '@playwright/test'

// Phase 0 smoke test runs against the production preview build on a
// phone-sized viewport with touch, per CLAUDE.md working agreements.
export default defineConfig({
  testDir: './tests',
  timeout: 480_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['iPhone 12'],
    // WebKit is the real target; the container only ships Chromium, so run the iPhone 12 profile on it.
    browserName: 'chromium',
    launchOptions: { executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
})
