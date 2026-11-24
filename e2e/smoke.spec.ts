import { test, expect } from '@playwright/test'

test('draw a line, persist it, serve puzzles, register the SW, work offline', async ({ page, context }) => {
  await page.goto('/isocube/#/views/L1-001')
  const svg = page.locator('svg.grid-svg')
  await expect(svg).toBeVisible()
  const b = (await svg.boundingBox())!
  const [x, y] = [b.x + b.width / 2, b.y + b.height / 2]
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + 80, { steps: 10 })
  await page.mouse.up()
  const lines = page.locator('.g-lines line')
  await expect(lines).not.toHaveCount(0)
  const n = await lines.count()
  await page.waitForTimeout(600) // debounced save is 300 ms
  await page.reload()
  await expect(page.locator('.g-lines line')).toHaveCount(n)

  expect((await page.request.get('/isocube/puzzles.json')).status()).toBe(200)

  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)
  expect(scope).toMatch(/\/isocube\/$/)
  await page.reload() // now controlled by the SW
  await context.setOffline(true)
  await page.goto('/isocube/')
  await expect(page.getByRole('heading', { name: 'ISOCUBE' })).toBeVisible()
})
