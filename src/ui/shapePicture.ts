import { proj, segEnds, type Pt } from '../core/geometry'
import { computeEdges, type HeightMap } from '../core/shape'
import { rotate180 } from '../core/visibility'
import { h, icon } from './dom'
import { mk } from './grid/gestures'
import { S } from './strings'

/** The shaded shape (port of renderAnswer: painter's order, tone 1 top, 2 front, 3 side) plus its outline and plane lines. */
export function shapePicture(hm: HeightMap): SVGSVGElement {
  const P = (p: Pt) => [p.t * Math.sqrt(3) / 2, -(p.m + p.t / 2)]
  const edges = [...computeEdges(hm).shape].map(k => segEnds(k).map(P))
  const xs = edges.flat().map(p => p[0]), ys = edges.flat().map(p => p[1]), pad = 0.3
  const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad
  const svg = mk('svg', { viewBox: `${x0} ${y0} ${Math.max(...xs) + pad - x0} ${Math.max(...ys) + pad - y0}`, class: 'rv-pic', role: 'img' })
  const filled = (x: number, y: number, z: number) => z >= 0 && z < hm.at(x, hm.rows - 1 - y)
  const cubes = hm.cubes().sort((a, b) => (a[2] - a[0] - a[1]) - (b[2] - b[0] - b[1]) || a[2] - b[2])
  const poly = (q: number[][], cls: string) => mk('polygon', { points: q.map(c => P(proj(c[0], c[1], c[2])).join(',')).join(' '), class: cls }, svg)
  for (const [x, y, z] of cubes) {
    if (!filled(x, y, z + 1)) poly([[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]], 'k-top')
    if (!filled(x, y - 1, z)) poly([[x, y, z], [x + 1, y, z], [x + 1, y, z + 1], [x, y, z + 1]], 'k-front')
    if (!filled(x - 1, y, z)) poly([[x, y, z], [x, y + 1, z], [x, y + 1, z + 1], [x, y, z + 1]], 'k-side')
  }
  for (const [[x1, y1], [x2, y2]] of edges) mk('line', { x1, y1, x2, y2 }, svg)
  return svg
}

/** Turn icon (an arrow going round), shared by the puzzle screens. */
export const TURN_ICON = '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>'

/** A small ⟲ button that toggles front / back; `onTurn` gets true for the back. */
export function turnButton(onTurn: (back: boolean) => void) {
  const b = h('button', { class: 'icon-btn turn-btn', 'aria-label': S.turn, title: S.turn, 'aria-pressed': 'false' })
  b.innerHTML = icon(TURN_ICON)
  const set = (back: boolean) => { b.setAttribute('aria-pressed', String(back)); onTurn(back) }
  b.addEventListener('click', () => set(b.getAttribute('aria-pressed') !== 'true'))
  return { el: b, set, get back() { return b.getAttribute('aria-pressed') === 'true' } }
}

/** The shaded figure with a Front/Back label and a ⟲ button; a tap on the picture turns it too. Returns [picture, label, button]. */
export function turnablePicture(hm: HeightMap, onTurn?: (back: boolean) => void): Node[] {
  const pics = [shapePicture(hm), shapePicture(rotate180(hm))], side = h('span', { class: 'side-label', text: S.frontSide })
  const turn = turnButton(back => { pics[back ? 0 : 1].replaceWith(pics[back ? 1 : 0]); side.textContent = back ? S.backSide : S.frontSide; onTurn?.(back) })
  pics.forEach(p => p.addEventListener('click', () => turn.set(!turn.back)))
  return [pics[0], side, turn.el]
}
