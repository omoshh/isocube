import { gridSegKey, type GPt } from '../../core/geometry'
import { snapDragSquare } from '../../core/snap'
import type { CheckResult } from '../../core/checker'
import type { View } from './transform'
import { createSurface, mk, type UV } from './gestures'

export type SquareGridOpts = {
  cols: number
  rows: number
  lines: Set<string>
  onChange(lines: Set<string>): void
  penOnly: () => boolean
  initialView?: View
  onViewChange?: (v: View) => void
}

const ERASE_DIST = 0.4 // cells
const ends = (k: string): [GPt, GPt] => k.split('|').map(s => { const [x, y] = s.split(':').map(Number); return { x, y } }) as [GPt, GPt]

/** Cell grid in screen coordinates (x right, y down, 1 unit = 1 cell, y = 0 at the top); world v = -y. */
export function createSquareGrid(el: HTMLElement, o: SquareGridOpts) {
  const { cols, rows } = o
  const lines = new Set(o.lines)
  let start: GPt | null = null
  const toXY = (p: UV): GPt => ({ x: p.u, y: -p.v })
  const seg = (k: string, parent: Element, cls?: string) => {
    const [a, b] = ends(k)
    mk('line', { x1: a.x, y1: -a.y, x2: b.x, y2: -b.y, ...(cls ? { class: cls } : {}) }, parent)
  }
  const clamp = (p: GPt): GPt => ({ x: Math.max(0, Math.min(cols, p.x)), y: Math.max(0, Math.min(rows, p.y)) })

  function render() {
    gLines.replaceChildren()
    for (const k of lines) seg(k, gLines)
  }
  const changed = () => { render(); o.onChange(new Set(lines)) }

  function tapErase(p: GPt) {
    let best: string | null = null, bd = ERASE_DIST
    for (const k of lines) {
      const [a, b] = ends(k)
      const fx = Math.max(Math.min(a.x, b.x), Math.min(Math.max(a.x, b.x), p.x)), fy = Math.max(Math.min(a.y, b.y), Math.min(Math.max(a.y, b.y), p.y))
      const d = Math.hypot(p.x - fx, p.y - fy)
      if (d <= bd) { bd = d; best = k }
    }
    if (best) { lines.delete(best); changed() }
  }

  const snapped = (end: GPt) => {
    const l = start && snapDragSquare(start, end)
    if (!l) return null
    const a = clamp(l.a), b = clamp(l.b)
    return a.x === b.x && a.y === b.y ? null : { a, b }
  }
  const cancel = () => { start = null; gPrev.replaceChildren() }
  const draw = {
    start(p: UV) { start = toXY(p) },
    move(p: UV) {
      gPrev.replaceChildren()
      const l = snapped(toXY(p))
      if (l) mk('line', { x1: l.a.x, y1: -l.a.y, x2: l.b.x, y2: -l.b.y }, gPrev)
    },
    end(p: UV) {
      const s = start, q = toXY(p), l = snapped(q)
      cancel()
      if (!s) return
      if (!l) {
        if (!snapDragSquare(s, q)) tapErase(q) // a stroke that snaps to nothing is a tap
        return
      }
      const n = Math.abs(l.b.x - l.a.x) + Math.abs(l.b.y - l.a.y), sx = Math.sign(l.b.x - l.a.x), sy = Math.sign(l.b.y - l.a.y)
      const size = lines.size
      for (let i = 0; i < n; i++) lines.add(gridSegKey({ x: l.a.x + sx * i, y: l.a.y + sy * i }, { x: l.a.x + sx * (i + 1), y: l.a.y + sy * (i + 1) }))
      if (lines.size !== size) changed()
    },
    cancel,
  }

  const surf = createSurface(el, { content: () => [0, cols, -rows, 0], penOnly: o.penOnly, draw, onView: () => {}, initialView: o.initialView, onViewChange: o.onViewChange })
  const layer = (cls: string) => mk('g', { class: cls }, surf.world)
  const gGrid = layer('g-grid'), gLines = layer('g-lines'), gCheck = layer('g-check'), gPrev = layer('g-prev')
  for (let i = 0; i <= cols; i++) mk('line', { x1: i, y1: 0, x2: i, y2: -rows }, gGrid)
  for (let j = 0; j <= rows; j++) mk('line', { x1: 0, y1: -j, x2: cols, y2: -j }, gGrid)
  render()

  return {
    setResult(r: CheckResult | null) {
      gCheck.replaceChildren()
      if (!r) return
      for (const k of r.missing) seg(k, gCheck, 'g-missing')
      for (const k of r.mistakes) seg(k, gCheck, 'g-mistake')
    },
    fit: surf.fit,
    zoomBy: surf.zoomBy,
    getView: surf.getView,
    destroy: surf.destroy,
  }
}
