// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { glyph } from '../../src/ui/components/glyph'
import { createTopBar } from '../../src/ui/components/topBar'
import { iconSvg, MASKABLE_SCALE } from '../../scripts/generate-icons'

describe('glyph', () => {
  const svg = glyph()
  it('is decorative, 32px', () => {
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('width')).toBe('32')
  })
  it('uses the four CSS variables and no hex', () => {
    const html = svg.outerHTML
    for (const v of ['--accent', '--tone-2', '--tone-3', '--ink']) expect(html).toContain(`var(${v})`)
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i)
  })
  it('stroke is size/40, at least 1.2px, round joins', () => {
    for (const size of [32, 96]) {
      const g = glyph(size)
      const w = Number(g.querySelector('polygon')!.getAttribute('stroke-width'))
      expect(w).toBeCloseTo(Math.max(1.2, size / 40))
      expect(g.querySelector('polygon')!.getAttribute('stroke-linejoin')).toBe('round')
    }
  })
})

describe('app icon', () => {
  const png = (n: string) => readFileSync(`public/icons/${n}`)
  it.each([['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512]])('%s is %i px square', (n, px) => {
    const b = png(n)
    expect(b.subarray(1, 4).toString()).toBe('PNG')
    expect([b.readUInt32BE(16), b.readUInt32BE(20)]).toEqual([px, px])
  })
  it('keeps the maskable shape, stroke included, inside the safe circle (r = 40%)', () => {
    const svg = iconSvg(MASKABLE_SCALE)
    const half = Number(svg.match(/stroke-width="([\d.]+)"/)![1]) / 2
    const pts = [...svg.matchAll(/points="([^"]+)"/g)].flatMap(m => m[1].split(' ').map(p => p.split(',').map(Number)))
    for (const [x, y] of pts) expect(Math.hypot(x - 256, y - 256) + half).toBeLessThanOrEqual(204.8)
  })
  it('favicon is linked', () => {
    expect(readFileSync('index.html', 'utf8')).toMatch(/rel="icon"/)
  })
})

describe('top bar', () => {
  it('adds an aria-hidden spacer only when there is no menu', () => {
    expect(createTopBar({ title: 'T', back: '/' }).querySelector('.top-spacer')!.getAttribute('aria-hidden')).toBe('true')
    expect(createTopBar({ title: 'T', back: '/', menu: [] }).querySelector('.top-spacer')).toBeNull()
  })
})
