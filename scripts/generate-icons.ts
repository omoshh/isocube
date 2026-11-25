// Writes public/icons/icon.svg (also the favicon) and the PNGs from it: npm run icons
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { ACCENT_HEX } from '../src/ui/theme'

const css = readFileSync('src/ui/styles/tokens.css', 'utf8')
const paper = css.match(/:root\[data-style="paper"\]\[data-theme="light"\]\s*\{([^}]*)\}/)![1]
const tok = (n: string) => paper.match(new RegExp(`--${n}:\\s*([^;]+);`))![1].trim()

// Stack [[2,1],[1,0]] (canvas option 5) as cubes: top-vertex x, y, in a 96-unit box, back to front.
const CUBES = [[48, 26.4], [48, 4.8], [66.7, 37.2], [29.3, 37.2]]
const W = 18.7, D = 10.8, H = 21.6
const SCALE = 5.3 // shape ~403px of 512, inside the maskable safe zone (centre 80% = 410px)

export function iconSvg(): string {
  const [ink, left, bg, top] = [tok('ink'), tok('tone-2'), tok('bg'), ACCENT_HEX.yellow]
  const f = (n: number) => +(n * SCALE).toFixed(1)
  // shape bbox in 96 units is x 10.6..85.4, y 4.8..80.4; centre it on 256
  const ox = 256 - 48 * SCALE, oy = 256 - 42.6 * SCALE
  const poly = (fill: string, p: number[][]) =>
    `<polygon points="${p.map(([x, y]) => `${+(f(x) + ox).toFixed(1)},${+(f(y) + oy).toFixed(1)}`).join(' ')}" fill="${fill}" stroke="${ink}" stroke-width="${f(2.4)}" stroke-linejoin="round"/>`
  const cube = ([x, y]: number[]) => [
    poly(top, [[x, y], [x + W, y + D], [x, y + 2 * D], [x - W, y + D]]),
    poly(ink, [[x + W, y + 3 * D], [x, y + H + 2 * D], [x, y + 2 * D], [x + W, y + D]]),
    poly(left, [[x - W, y + 3 * D], [x, y + H + 2 * D], [x, y + 2 * D], [x - W, y + D]]),
  ].join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" fill="${bg}"/>${CUBES.map(cube).join('')}</svg>\n`
}

async function main() {
  const { chromium } = await import('@playwright/test')
  mkdirSync('public/icons', { recursive: true })
  writeFileSync('public/icons/icon.svg', iconSvg())
  const browser = await chromium.launch()
  for (const [name, px] of [['icon-192', 192], ['icon-512', 512], ['icon-maskable-512', 512]] as const) {
    const page = await browser.newPage({ viewport: { width: px, height: px } })
    await page.setContent(`<body style="margin:0"><img width="${px}" height="${px}" src="data:image/svg+xml;base64,${Buffer.from(iconSvg()).toString('base64')}">`)
    await page.screenshot({ path: `public/icons/${name}.png` })
    await page.close()
  }
  await browser.close()
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main()
