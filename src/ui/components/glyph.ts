import { mk } from '../grid/gestures'

const FACES: [string, number[]][] = [
  ['var(--accent)', [48, 4.8, 85.4, 26.4, 48, 48, 10.6, 26.4]],
  ['var(--tone-3)', [85.4, 69.6, 48, 91.2, 48, 48, 85.4, 26.4]],
  ['var(--tone-2)', [10.6, 69.6, 48, 91.2, 48, 48, 10.6, 26.4]],
]

/** The Isocube glyph: one isometric cube in the style's tones (Glyphs canvas, option 2, drawn on 96). */
export function glyph(size = 32): SVGSVGElement {
  const svg = mk('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}`, class: 'glyph', 'aria-hidden': 'true' })
  for (const [fill, p] of FACES) {
    const points = p.map(v => +(v * size / 96).toFixed(2)).join(',')
    mk('polygon', { points, fill, stroke: 'var(--ink)', 'stroke-width': Math.max(1.2, size / 40), 'stroke-linejoin': 'round' }, svg)
  }
  return svg
}
