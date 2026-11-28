import { proj, segEnds, toUV, triAt, triEdges, type Pt, type SegKey } from '../../core/geometry'
import { arcMid, arcPieces, arcPolyline, arcSnapPoints, arcsThrough, circlesOf, extrude, isArcKey, NORMAL, type Arc, type ArcKey, type Circle, type Radius } from '../../core/arcs'
import { lineMidpoints, snapDragIso, snapFree, snapFreehandIso, snapPoint, type SnapOpts } from '../../core/snap'
import type { Bounds, DrawingEditor } from '../../core/drawing'
import type { CheckResult } from '../../core/checker'
import { guideBounds, type View } from './transform'
import { S as STR } from '../strings'
import { createSurface, mk, type UV } from './gestures'

export type Tool = 'line' | 'arc' | 'freehand' | 'fill' | 'erase'
export type Overlay = { kind: 'answer'; edges: Set<SegKey> } | { kind: 'check'; result: CheckResult } | null
export type IsoGridOpts = {
  /** Free line tool (any snap point to any snap point) and the arc tool; `half` adds edge midpoints as snap points,
   *  `mids` the middles of drawn lines (Draw only: in Views a half point is always a mistake). Unset: 3-direction lines (Shadows). */
  free?: { half: boolean; mids?: boolean; radii?: readonly Radius[]; cut?: boolean }
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
const HANDLE_DIST = 0.4 // grid steps: a stroke starting this near the arc dot drags it
const MIN_DOT_SCALE = 24 // px per step: below this, half-point dots are too dense to see or to redraw on every frame
const uv = toUV
/** Fill colour index → CSS colour: 1–3 are the shading tones, 4+ the draw-mode palette (tokens defined by Task 17). */
export const fillColour = (n: number) => (n <= 3 ? `var(--tone-${n})` : `var(--palette-${n})`)

function distTo([au, av]: number[], [bu, bv]: number[], q: UV) {
  const du = bu - au, dv = bv - av
  const f = Math.max(0, Math.min(1, ((q.u - au) * du + (q.v - av) * dv) / (du * du + dv * dv)))
  return Math.hypot(q.u - au - f * du, q.v - av - f * dv)
}
const keyDist = (k: string, q: UV) => {
  const ps = isArcKey(k) ? arcPolyline(k) : segEnds(k).map(uv)
  return Math.min(...ps.slice(1).map((b, i) => distTo(ps[i], b, q)))
}
const sameArc = (a: Arc, b: Arc) => arcPieces(a).join() === arcPieces(b).join()

export function createIsoGrid(el: HTMLElement, o: IsoGridOpts) {
  const { editor } = o
  let surf: ReturnType<typeof createSurface> | undefined
  let overlay: Overlay = null
  let stroke: { tool: Tool; start: UV; pts: UV[]; dot?: boolean; ext?: Circle } | null = null
  const hitAt = new Map<string, UV>() // where the eraser met each pending line (Draw cuts only that part)
  let pending = new Set<string>() // erased during the current stroke; committed on end so a pinch can cancel it
  let arcFirst: Pt | null = null // arc tool: the first tapped point
  let lastArc: { p: Pt; q: Pt; arc: Arc; added: ArcKey[] } | null = null // the arc whose dot shows

  const extraPoints = () => { const d = editor.drawing; return [...arcSnapPoints(d.arcs!), ...(o.free?.mids ? lineMidpoints(d.lines) : [])] }
  const snapOpts = (): SnapOpts => ({ half: !!o.free?.half, extra: extraPoints() })
  const showSnap = () => !!o.free && (o.tool() === 'line' || o.tool() === 'arc')

  /** A line for a SegKey, a polyline for an ArcKey. */
  const drawKey = (k: string, parent: Element, cls?: string) => {
    const c: Record<string, string> = cls ? { class: cls } : {}
    if (isArcKey(k)) { mk('polyline', { points: arcPolyline(k).join(' '), ...c }, parent); return }
    const [[x1, y1], [x2, y2]] = segEnds(k).map(uv)
    mk('line', { x1, y1, x2, y2, ...c }, parent)
  }
  const dot = (p: [number, number], r: number, parent: Element) => mk('circle', { cx: p[0], cy: p[1], r }, parent)

  function drawSnap() {
    gSnap.replaceChildren()
    if (!showSnap()) return
    if (o.free!.half && surf!.getView().scale >= MIN_DOT_SCALE) {
      const [u0, u1, v0, v1] = surf!.visible()
      for (let T = Math.floor(2 * u0 / S); T <= Math.ceil(2 * u1 / S); T++)
        for (let M = Math.floor(2 * v0 - T / 2); M <= Math.ceil(2 * v1 - T / 2); M++)
          if (T % 2 || M % 2) dot(uv({ t: T / 2, m: M / 2 }), 0.05, gSnap)
    }
    for (const p of extraPoints()) dot(uv(p), 0.05, gSnap)
  }

  function drawHandle() {
    gHandle.replaceChildren()
    if (lastArc) dot(arcMid(lastArc.arc), 0.12, gHandle)
    if (arcFirst) dot(uv(arcFirst), 0.08, gHandle).setAttribute('class', 'first')
    if (o.free && o.tool() === 'arc') for (const c of circlesOf(editor.drawing.arcs!)) dot(uv(c.c), 0.07, gHandle).setAttribute('class', 'centre')
  }

  function drawGrid() {
    if (!surf) return // first call comes from inside createSurface, before the layers exist
    gGrid.replaceChildren()
    const [u0, u1, v0, v1] = surf.visible(), ta = u0 / S, tb = u1 / S
    const line = (x1: number, y1: number, x2: number, y2: number) => mk('line', { x1, y1, x2, y2 }, gGrid)
    for (let k = Math.floor(ta); k <= Math.ceil(tb); k++) line(k * S, v0, k * S, v1)
    for (let c = Math.floor(v0 - tb / 2); c <= Math.ceil(v1 - ta / 2); c++) line(u0, c + ta / 2, u1, c + tb / 2) // v = c + t/2
    for (let c = Math.floor(v0 + ta / 2); c <= Math.ceil(v1 + tb / 2); c++) line(u0, c - ta / 2, u1, c - tb / 2) // v = c - t/2
    drawSnap()
  }

  function render() {
    gFills.replaceChildren(); gLines.replaceChildren()
    const d = editor.drawing
    for (const [k, c] of Object.entries(d.fills)) {
      const vs = new Map(triEdges(k).flatMap(segEnds).map(p => [p.t + ':' + p.m, uv(p)]))
      const col = fillColour(c)
      mk('polygon', { points: [...vs.values()].join(' '), style: `fill:${col};stroke:${col}` }, gFills)
    }
    for (const a of d.areas!) { const col = fillColour(a.c); mk('polygon', { points: a.pts.join(' '), style: `fill:${col};stroke:${col}` }, gFills) }
    for (const k of [...d.lines, ...d.arcs!]) if (!pending.has(k)) drawKey(k, gLines)
    // the dot goes with the tool and with the arc (undo, redo, clear can take the arc away)
    if (o.tool() !== 'arc') arcFirst = lastArc = null
    if (lastArc && !arcPieces(lastArc.arc).every(k => d.arcs!.includes(k))) lastArc = null
    drawSnap(); drawHandle()
  }

  function drawOverlay() {
    gAns.replaceChildren(); gCheck.replaceChildren()
    if (overlay?.kind === 'answer') for (const k of overlay.edges) drawKey(k, gAns)
    if (overlay?.kind === 'check') {
      for (const k of overlay.result.missing) drawKey(k, gCheck, 'g-missing')
      for (const k of overlay.result.mistakes) drawKey(k, gCheck, 'g-mistake')
    }
  }

  function eraseAt(p: UV) {
    const d = editor.drawing
    let best: string | null = null, bd = ERASE_DIST
    for (const k of [...d.lines, ...d.arcs!]) { const x = keyDist(k, p); if (x <= bd) { bd = x; best = k } }
    // the nearest line already taken in this stroke blocks the next one: one tap (start + end) erases one line
    if (best && !pending.has(best)) { pending.add(best); hitAt.set(best, p); render() }
  }

  const lineFor = (start: UV, p: UV) => (o.free ? snapFree(start, p, snapOpts()) : snapDragIso(start, p))
  /** The arc through the last arc's ends whose middle is nearest the finger. */
  const arcNear = (p: UV) => {
    const best = (a: Arc) => { const [u, v] = arcMid(a); return Math.hypot(u - p.u, v - p.v) }
    return arcsThrough(lastArc!.p, lastArc!.q, o.free?.radii).reduce((a, b) => (best(b) < best(a) ? b : a))
  }

  function preview(s: NonNullable<typeof stroke>, p: UV) {
    gPrev.replaceChildren()
    if (s.tool === 'line') {
      const l = lineFor(s.start, p)
      if (l) { const [[x1, y1], [x2, y2]] = [uv(l.a), uv(l.b)]; mk('line', { x1, y1, x2, y2 }, gPrev) }
    } else if (s.tool === 'arc') {
      if (s.dot) for (const k of arcPieces(arcNear(p))) drawKey(k, gPrev)
      const x = s.ext && extrusion(s, p)
      if (x) {
        for (const k of x.arcs) drawKey(k, gPrev)
        for (const l of x.lines) { const [[x1, y1], [x2, y2]] = [uv(l.a), uv(l.b)]; mk('line', { x1, y1, x2, y2 }, gPrev) }
      }
    }
    else mk('polyline', { points: s.pts.map(q => q.u + ',' + q.v).join(' ') }, gPrev)
  }

  /** Cylinder drag: whole cells along the circle's normal, and what that adds. */
  const extrusion = (s: NonNullable<typeof stroke>, p: UV) => {
    const [nu, nv] = uv(NORMAL[s.ext!.plane]), n = Math.round(((p.u - s.start.u) * nu + (p.v - s.start.v) * nv) / (nu * nu + nv * nv))
    return n ? extrude(editor.drawing.arcs!, s.ext!, n) : null
  }

  function tapArc(p: UV) {
    const q = snapPoint(p, snapOpts())
    if (!arcFirst) { arcFirst = q; return }
    const cands = arcsThrough(arcFirst, q, o.free?.radii)
    if (!cands.length) { arcFirst = q; return } // no valid arc: start again from here
    lastArc = { p: arcFirst, q, arc: cands[0], added: editor.addArc(cands[0]) }
    arcFirst = null
  }

  const endStroke = () => {
    stroke = null; gPrev.replaceChildren()
    if (pending.size) { pending = new Set(); render() }
  }
  const draw = {
    start(p: UV) {
      stroke = { tool: o.tool(), start: p, pts: [p] }
      if (stroke.tool === 'arc' && lastArc) {
        const [u, v] = arcMid(lastArc.arc)
        if (Math.hypot(u - p.u, v - p.v) <= HANDLE_DIST) stroke.dot = true
        else lastArc = null
      } else lastArc = null
      if (stroke.tool === 'arc' && !stroke.dot && o.free)
        stroke.ext = circlesOf(editor.drawing.arcs!).find(c => { const [u, v] = uv(c.c); return Math.hypot(u - p.u, v - p.v) <= HANDLE_DIST })
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
      const erased = pending, hits = new Map(hitAt)
      pending = new Set(); hitAt.clear()
      endStroke()
      if (!s) return
      if (s.tool === 'line') { const l = lineFor(s.start, p); if (l) editor.addLines([l]) }
      else if (s.tool === 'arc') {
        if (!o.free) return
        // a dot or centre stroke that does not move is a tap (both often sit on a snap point)
        const still = Math.hypot(p.u - s.start.u, p.v - s.start.v) < 0.1
        const x = s.ext && !still && extrusion(s, p) // a centre stroke too short for a whole cell is a tap
        if (x) editor.add(x.lines, x.arcs)
        else if (s.dot && still) { lastArc = null; tapArc(p) }
        else if (!s.dot) tapArc(p)
        else { const a = arcNear(p); if (!sameArc(a, lastArc!.arc)) lastArc = { ...lastArc!, arc: a, added: editor.replaceArc(lastArc!.added, a) } }
      }
      else if (s.tool === 'freehand') editor.addLines(snapFreehandIso([...s.pts, p]))
      else if (s.tool === 'fill') { if (o.free) editor.fillArea(p, o.colour()); else editor.fill(triAt(p.u, p.v), o.colour()) }
      else if (erased.size) for (const k of erased) (o.free?.cut && !isArcKey(k) ? editor.cutErase(k, hits.get(k)!) : editor.erase(k))
      else if (!(o.free && editor.unfillArea(p))) editor.unfill(triAt(p.u, p.v)) // no line near: the eraser clears the colour under the finger
      render()
    },
    cancel() { endStroke(); arcFirst = null; if (surf) drawHandle() },
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
  const gLines = layer('g-lines'), gCheck = layer('g-check'), gSnap = layer('g-snap'), gHandle = layer('g-handle'), gPrev = layer('g-prev')

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
