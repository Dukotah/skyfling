import { test, expect, type Page } from '@playwright/test'

function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

test('boots with no console errors and renders the canvas', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await expect(page).toHaveTitle(/Skyfling/)
  const canvas = page.locator('canvas#scene')
  await expect(canvas).toBeVisible()
  const box = await canvas.boundingBox()
  expect(box?.width ?? 0).toBeGreaterThan(300)
  expect(box?.height ?? 0).toBeGreaterThan(600)
  // Boot bar fills, "tap to begin" appears, a tap dismisses it.
  await expect(page.locator('#bootTip')).toHaveText(/tap to begin/, { timeout: 60_000 })
  await page.mouse.click(195, 420)
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 5_000 })
  expect(errors, `console errors: ${errors.join('\n')}`).toEqual([])
})

test('a pull-and-release launches a flight and distance climbs', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await expect(page.locator('#bootTip')).toHaveText(/tap to begin/, { timeout: 60_000 })
  await page.mouse.click(195, 420)
  // Tutorial cards on first run.
  for (let i = 0; i < 3; i++) {
    const btn = page.locator('.tut .btn')
    if (await btn.count()) await btn.first().dispatchEvent('pointerdown')
    await page.waitForTimeout(150)
  }
  await expect(page.locator('#aim')).toBeVisible({ timeout: 5_000 })
  // Pull the slingshot: drag down 180 px and release.
  await page.mouse.move(195, 300)
  await page.mouse.down()
  await page.mouse.move(195, 480, { steps: 12 })
  await page.mouse.up()
  await expect(page.locator('#hud')).toBeVisible({ timeout: 4_000 })
  await page.waitForTimeout(2500)
  const dist = Number((await page.locator('#hud .hud-dist span').first().textContent())?.replace(/,/g, ''))
  expect(dist).toBeGreaterThan(40)
  expect(errors, `console errors: ${errors.join('\n')}`).toEqual([])
})
