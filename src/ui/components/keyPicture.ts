import { proj } from '../../core/geometry'
import { mk } from '../grid/gestures'
import { S } from '../strings'

type P3 = [number, number, number]

/** One cube with the three tones and FRONT/SIDE arrows (port of keySVG). */
export function keyPicture(): SVGSVGElement {
  const svg = mk('svg', { viewBox: '-2.95 -3.15 5.9 4.15', class: 'key-pic', role: 'img', 'aria-label': S.key })
  const P = (x: number, y: number, z: number) => { const p = proj(x, y, z); return [p.t * Math.sqrt(3) / 2 * 1.5, -(p.m + p.t / 2) * 1.5] }
  const poly = (q: P3[], cls: string) => mk('polygon', { points: q.map(a => P(...a).join(',')).join(' '), class: cls }, svg)
  poly([[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], 'k-top')
  poly([[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], 'k-front')
  poly([[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]], 'k-side')
  const txt = (s: string, at: P3, size: number, cls = '') => {
    const [x, y] = P(...at)
    mk('text', { x, y, 'font-size': size, 'text-anchor': 'middle', 'dominant-baseline': 'middle', class: cls }, svg).textContent = s
  }
  txt(S.top, [0.5, 0.5, 1], 0.22)
  txt(S.front, [0.5, 0, 0.5], 0.2)
  txt(S.side, [0, 0.5, 0.5], 0.2, 'on-dark')
  const arrow = (a: P3, b: P3) => {
    const [x1, y1] = P(...a), [x2, y2] = P(...b), L = Math.hypot(x2 - x1, y2 - y1), dx = (x2 - x1) / L, dy = (y2 - y1) / L
    const bx = x2 - dx * 0.2, by = y2 - dy * 0.2, nx = -dy * 0.09, ny = dx * 0.09
    mk('line', { x1, y1, x2: bx, y2: by, class: 'k-arrow' }, svg)
    mk('polygon', { points: `${x2},${y2} ${bx + nx},${by + ny} ${bx - nx},${by - ny}`, class: 'k-head' }, svg)
  }
  arrow([0.5, -1.05, 0.15], [0.5, -0.12, 0.15])
  arrow([-1.05, 0.5, 0.15], [-0.12, 0.5, 0.15])
  txt(S.front, [0.5, -1.25, -0.05], 0.2, 'k-label')
  txt(S.side, [-1.3, 0.5, -0.05], 0.2, 'k-label')
  return svg
}
