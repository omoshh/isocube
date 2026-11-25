import { proj, segEnds, type Pt } from '../core/geometry'
import { computeEdges, type HeightMap } from '../core/shape'
import { mk } from './grid/gestures'

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
