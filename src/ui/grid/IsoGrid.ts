import { proj, segEnds, triAt, triEdges, type Pt, type SegKey } from '../../core/geometry'
import { snapDragIso, snapFreehandIso } from '../../core/snap'
import type { Bounds, DrawingEditor } from '../../core/drawing'
import type { CheckResult } from '../../core/checker'
import { guideBounds, type View } from './transform'
import { S as STR } from '../strings'
import { createSurface, mk, type UV } from './gestures'

export type Tool = 'line' | 'freehand' | 'fill' | 'erase'
export type Overlay = { kind: 'answer'; edges: Set<SegKey> } | { kind: 'check'; result: CheckResult } | null
export type IsoGridOpts = {
  /** Line tool may snap to the long diagonal of a cell (Draw mode). */
  diagonals?: boolean
  bounds: Bounds
  guide?: { cols: number; rows: number; maxH: number }
  arrows: boolean
  editor: DrawingEditor
  tool: () => Tool
  colour: () => number
  penOnly: () => boolean
  /** A tinted, outlined quad (corners in t, m) under the grid lines, e.g. the plane the shadow falls on. */
  plane?: Pt[]
  initialView?: View
  onViewChange?: (v: View) => void
}

const S = Math.sqrt(3) / 2
const ERASE_DIST = 0.4 // grid steps
const uv = (p: Pt): [number, number] => [p.t * S, p.m + p.t / 2]
/** Fill colour index → CSS colour: 1–3 are the shading tones, 4+ the draw-mode palette (tokens defined by Task 17). */
export const fillColour = (n: number) => (n <= 3 ? `var(--tone-${n})` : `var(--palette-${n})`)

function segDist(k: SegKey, q: UV) {
  const [[au, av], [bu, bv]] = segEnds(k).map(uv), du = bu - au, dv = bv - av
  const f = Math.max(0, Math.min(1, ((q.u - au) * du + (q.v - av) * dv) / (du * du + dv * dv)))
  return Math.hypot(q.u - au - f * du, q.v - av - f * dv)
}

export function createIsoGrid(el: HTMLElement, o: IsoGridOpts) {
  const { editor } = o
  let surf: ReturnType<typeof createSurface> | undefined
  let overlay: Overlay = null
  let stroke: { tool: Tool; start: UV; pts: UV[] } | null = null
  let pending = new Set<SegKey>() // erased during the current stroke; committed on end so a pinch can cancel it

  const seg = (k: SegKey, parent: Element, cls?: string) => {
    const [[x1, y1], [x2, y2]] = segEnds(k).map(uv)
    mk('line', { x1, y1, x2, y2, ...(cls ? { class: cls } : {}) }, parent)
  }

  function drawGrid() {
    if (!surf) return // first call comes from inside createSurface, before the layers exist
    gGrid.replaceChildren()
    const [u0, u1, v0, v1] = surf.visible(), ta = u0 / S, tb = u1 / S
    const line = (x1: number, y1: number, x2: number, y2: number) => mk('line', { x1, y1, x2, y2 }, gGrid)
    for (let k = Math.floor(ta); k <= Math.ceil(tb); k++) line(k * S, v0, k * S, v1)
    for (let c = Math.floor(v0 - tb / 2); c <= Math.ceil(v1 - ta / 2); c++) line(u0, c + ta / 2, u1, c + tb / 2) // v = c + t/2
    for (let c = Math.floor(v0 + ta / 2); c <= Math.ceil(v1 + tb / 2); c++) line(u0, c - ta / 2, u1, c - tb / 2) // v = c - t/2
  }

  function render() {
    gFills.replaceChildren(); gLines.replaceChildren()
    const d = editor.drawing
    for (const [k, c] of Object.entries(d.fills)) {
      const vs = new Map(triEdges(k).flatMap(segEnds).map(p => [p.t + ':' + p.m, uv(p)]))
      const col = fillColour(c)
      mk('polygon', { points: [...vs.values()].join(' '), style: `fill:${col};stroke:${col}` }, gFills)
    }
    for (const k of d.lines) if (!pending.has(k)) seg(k, gLines)
  }

  function drawOverlay() {
    gAns.replaceChildren(); gCheck.replaceChildren()
    if (overlay?.kind === 'answer') for (const k of overlay.edges) seg(k, gAns)
    if (overlay?.kind === 'check') {
      for (const k of overlay.result.missing) seg(k, gCheck, 'g-missing')
      for (const k of overlay.result.mistakes) seg(k, gCheck, 'g-mistake')
    }
  }

  function eraseAt(p: UV) {
    let best: SegKey | null = null, bd = ERASE_DIST
    for (const k of editor.drawing.lines) { const d = segDist(k, p); if (d <= bd) { bd = d; best = k } }
    // the nearest line already taken in this stroke blocks the next one: one tap (start + end) erases one line
    if (best && !pending.has(best)) { pending.add(best); render() }
  }

  function preview(s: NonNullable<typeof stroke>, p: UV) {
    gPrev.replaceChildren()
    if (s.tool === 'line') {
      const l = snapDragIso(s.start, p, o.diagonals)
      if (l) { const [[x1, y1], [x2, y2]] = [uv(l.a), uv(l.b)]; mk('line', { x1, y1, x2, y2 }, gPrev) }
    } else mk('polyline', { points: s.pts.map(q => q.u + ',' + q.v).join(' ') }, gPrev)
  }

  const cancel = () => {
    stroke = null; gPrev.replaceChildren()
    if (pending.size) { pending = new Set(); render() }
  }
  const draw = {
    start(p: UV) {
      stroke = { tool: o.tool(), start: p, pts: [p] }
      if (stroke.tool === 'erase') eraseAt(p)
    },
    move(p: UV) {
      if (!stroke) return
      if (stroke.tool === 'erase') return eraseAt(p)
      if (stroke.tool === 'fill') return
      stroke.pts.push(p)
      preview(stroke, p)
    },
    end(p: UV) {
      const s = stroke
      if (s?.tool === 'erase') eraseAt(p)
      const erased = pending
      pending = new Set()
      cancel()
      if (!s) return
      if (s.tool === 'line') { const l = snapDragIso(s.start, p, o.diagonals); if (l) editor.addLines([l]) }
      else if (s.tool === 'freehand') editor.addLines(snapFreehandIso([...s.pts, p]))
      else if (s.tool === 'fill') editor.fill(triAt(p.u, p.v), o.colour())
      else if (erased.size) for (const k of erased) editor.erase(k)
      else editor.unfill(triAt(p.u, p.v)) // no line near: the eraser clears the colour under the finger
      render()
    },
    cancel,
  }

  const content = (): [number, number, number, number] => {
    const b = o.guide ? guideBounds(o.guide.cols, o.guide.rows, o.guide.maxH) : o.bounds
    if (!o.guide || !o.arrows) return [b.t0 * S, b.t1 * S, b.v0, b.v1]
    // frame the FRONT/SIDE labels too (they start 2.2 steps out; +0.55 for half a label)
    const { cols: C, rows: R } = o.guide
    return [Math.min(b.t0 * S, -(R / 2 + 2.2) * S - 0.55), Math.max(b.t1 * S, (C / 2 + 2.2) * S + 0.55), b.v0, b.v1]
  }
  surf = createSurface(el, { content, penOnly: o.penOnly, draw, onView: drawGrid, initialView: o.initialView, onViewChange: o.onViewChange })
  const layer = (cls: string) => mk('g', { class: cls }, surf!.world)
  const gPlane = layer('g-plane'), gGrid = layer('g-grid'), gFills = layer('g-fills'), gGuide = layer('g-guide'), gAns = layer('g-ans')
  const gLines = layer('g-lines'), gCheck = layer('g-check'), gPrev = layer('g-prev')

  if (o.plane) mk('polygon', { points: o.plane.map(p => uv(p).join(',')).join(' ') }, gPlane)

  if (o.guide) {
    const { cols: C, rows: R, maxH: Z } = o.guide
    const P = (x: number, y: number, z: number) => uv(proj(x, y, z))
    const hex: [number, number, number][] = [[0, 0, 0], [C, 0, 0], [C, 0, Z], [C, R, Z], [0, R, Z], [0, R, 0]]
    mk('polygon', { points: hex.map(q => P(...q).join(',')).join(' ') }, gGuide)
    const arrow = (a: [number, number, number], b: [number, number, number], label: string) => {
      const [u1, v1] = P(...a), [u2, v2] = P(...b), L = Math.hypot(u2 - u1, v2 - v1), du = (u2 - u1) / L, dv = (v2 - v1) / L
      const bu = u2 - du * 0.22, bv = v2 - dv * 0.22, nu = -dv * 0.1, nv = du * 0.1
      mk('line', { x1: u1, y1: v1, x2: bu, y2: bv }, gGuide)
      mk('polygon', { class: 'head', points: `${u2},${v2} ${bu + nu},${bv + nv} ${bu - nu},${bv - nv}` }, gGuide)
      // the world is flipped (v up), so flip the label back
      mk('text', { transform: `translate(${u1} ${v1 - 0.45}) scale(1 -1)`, 'font-size': 0.3, 'text-anchor': 'middle' }, gGuide).textContent = label
    }
    if (o.arrows) { arrow([C / 2, -2.2, 0.2], [C / 2, -0.55, 0.2], STR.front); arrow([-2.2, R / 2, 0.2], [-0.55, R / 2, 0.2], STR.side) }
  }
  drawGrid(); render()

  return {
    setOverlay(ov: Overlay) { overlay = ov; drawOverlay() },
    /** Redraw fills and lines; call after changing the editor from outside (undo, redo, clear). */
    render,
    fit: surf.fit,
    zoomBy: surf.zoomBy,
    getView: surf.getView,
    destroy: surf.destroy,
  }
}
