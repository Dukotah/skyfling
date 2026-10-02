import { test, expect } from '@playwright/test'

test('boots with no console errors and renders the canvas', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('/')

  // Title + canvas present.
  await expect(page).toHaveTitle(/Skyfling/)
  const canvas = page.locator('canvas#scene')
  await expect(canvas).toBeVisible()

  // Canvas is sized to the viewport (WebGL actually mounted).
  const box = await canvas.boundingBox()
  expect(box?.width ?? 0).toBeGreaterThan(300)
  expect(box?.height ?? 0).toBeGreaterThan(600)

  // Boot overlay auto-dismisses.
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 8000 })

  expect(errors, `console errors: ${errors.join('\n')}`).toEqual([])
})
