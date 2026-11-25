import { planeThrough } from '../core/sections'
import type { SectionPuzzle } from '../core/sectionPuzzle'
import type { SectionFrame } from '../core/sectionAnim'
import type { V3 } from '../core/solids'
import { mk } from './grid/gestures'

// proj(x,y,z) = (t, m) = (x - y, y + z); screen u = t·√3/2, v = m + t/2 (up), SVG y = -v. The viewer sits toward (-1,-1,1).
const R3 = Math.sqrt(3) / 2
const scr = ([x, y, z]: V3): [number, number] => [(x - y) * R3, -(y + z + (x - y) / 2)]
const pts = (p: V3[]) => p.map(q => scr(q).join(',')).join(' ')
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const facesViewer = (n: V3) => -n[0] - n[1] + n[2] > 0

/** Optionally-rotated true shape, centred in a square viewBox. */
export function shapeSvg(shape: [number, number][], angle: number): SVGSVGElement {
  const [c, s] = [Math.cos(angle), Math.sin(angle)]
  const r = shape.map(([x, y]) => [x * c - y * s, x * s + y * c])
  const m = Math.max(...r.flat().map(Math.abs)) + .15
  const svg = mk('svg', { role: 'img', viewBox: `${-m} ${-m} ${2 * m} ${2 * m}` })
  mk('polygon', { points: r.map(p => p.join(',')).join(' '), class: 'secshape' }, svg)
  return svg
}

/** The solid with its three points; draw(frame) adds the moving plane and the cut (omit for the puzzle card). */
export function solidSvg(p: SectionPuzzle, label: string, frames?: SectionFrame[]) {
  const { solid } = p, svg = mk('svg', { role: 'img', 'aria-label': label })
  const pl = planeThrough(...p.points)!, ctr = [0, 1, 2].map(k => solid.vertices.reduce((t, v) => t + v[k], 0) / solid.vertices.length) as V3
  const diam = Math.max(...solid.vertices.map(v => Math.hypot(...sub(v, ctr)))) * 1.3
  const u = cross(pl.n, Math.abs(pl.n[2]) < .9 ? [0, 0, 1] : [1, 0, 0]), ul = Math.hypot(...u)
  const e1 = u.map(x => x / ul) as V3, e2 = cross(pl.n, e1)
  const dist = pl.n[0] * ctr[0] + pl.n[1] * ctr[1] + pl.n[2] * ctr[2] - pl.d
  const quad = (off: number) => {
    const c = [0, 1, 2].map(k => ctr[k] + pl.n[k] * (off - dist))
    return ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([a, b]) => [0, 1, 2].map(k => c[k] + diam * (a * e1[k] + b * e2[k])) as V3)
  }
  // the viewBox is fixed for the whole animation: solid, every cut pose and the plane at its start
  const all: [number, number][] = [...solid.vertices.map(scr), ...(frames ?? []).flatMap(f => f.cutPoly3d.map(scr)), ...(frames ? quad(frames[0].planeOffset).map(scr) : [])]
  const x0 = Math.min(...all.map(a => a[0])) - .25, x1 = Math.max(...all.map(a => a[0])) + .25
  const y0 = Math.min(...all.map(a => a[1])) - .25, y1 = Math.max(...all.map(a => a[1])) + .25
  svg.setAttribute('viewBox', `${x0} ${y0} ${x1 - x0} ${y1 - y0}`)
  const normals = solid.faces.map(f => cross(sub(solid.vertices[f[1]], solid.vertices[f[0]]), sub(solid.vertices[f[2]], solid.vertices[f[0]])))
  for (const [a, b] of solid.edges) { // hidden when no adjacent face looks at the viewer
    const vis = solid.faces.some((f, i) => f.includes(a) && f.includes(b) && facesViewer(normals[i]))
    const [[ax, ay], [bx, by]] = [scr(solid.vertices[a]), scr(solid.vertices[b])]
    mk('line', { x1: ax, y1: ay, x2: bx, y2: by, class: vis ? 'sedge' : 'sedge hid' }, svg)
  }
  const dyn = mk('g', {}, svg)
  const dots = (g: Element) => { for (const q of p.points) { const [cx, cy] = scr(q); mk('circle', { cx, cy, r: .06, class: 'secpoint' }, g) } }
  if (!frames) dots(svg)
  return {
    svg,
    draw(f: SectionFrame) {
      dyn.replaceChildren()
      if (f.cutVisible) mk('polygon', { points: pts(f.cutPoly3d), class: 'seccut' }, dyn)
      else {
        const q = quad(f.planeOffset)
        mk('polygon', { points: pts(q), class: 'secplane' }, dyn)
      }
      dots(dyn) // points stay on top
    },
  }
}
