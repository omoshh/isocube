import { arcPieces, arcPolyline, isArcKey, type Arc, type ArcKey } from './arcs'
import { lineCuts } from './cut'
import { areaAt, inPoly, polyArea, type P2 } from './areas'
import { segEnds, toUV, triEdges, triNeighbours, linePieces, segKey, type Line, type SegKey, type TriKey } from './geometry'

/** A filled closed area (round 4): its outline in screen units, and the colour index. */
export type Area = { pts: P2[]; c: number }
export type Drawing = { lines: SegKey[]; arcs?: ArcKey[]; areas?: Area[]; fills: Record<TriKey, number>; name?: string }
export type Bounds = { t0: number; t1: number; v0: number; v1: number }

const S = Math.sqrt(3) / 2
const MAX_REGION = 4000 // same cap as the reference page
const copy = (d: Drawing): Drawing => ({ lines: [...d.lines], arcs: [...(d.arcs ?? [])], areas: [...(d.areas ?? [])], fills: { ...d.fills } })
const triCentre = (k: TriKey): P2 => {
  const vs = new Map(triEdges(k).flatMap(segEnds).map(p => [p.t + ':' + p.m, toUV(p)]))
  const ps = [...vs.values()]
  return [ps.reduce((a, p) => a + p[0], 0) / 3, ps.reduce((a, p) => a + p[1], 0) / 3]
}

export class DrawingEditor {
  private cur: Drawing
  private past: Drawing[] = []
  private future: Drawing[] = []

  constructor(initial: Drawing, private bounds: Bounds, private onChange: (d: Drawing) => void) {
    this.cur = copy(initial)
    this.cur.lines.sort(); this.cur.arcs!.sort()
  }

  get drawing(): Drawing { return copy(this.cur) }
  get canUndo() { return this.past.length > 0 }
  get canRedo() { return this.future.length > 0 }

  private commit(next: Drawing) {
    this.past.push(this.cur); this.future = []; this.cur = next; this.onChange(this.drawing)
  }

  addLines(ls: Line[]) { this.add(ls, []) }

  /** Lines and arc pieces in one step (a cylinder drag); nothing new adds no step. */
  add(ls: Line[], arcs: ArcKey[]) {
    const set = new Set(this.cur.lines), as = new Set(this.cur.arcs), n = set.size + as.size
    for (const l of ls) for (const s of linePieces(l)) set.add(s)
    for (const k of arcs) as.add(k)
    if (set.size + as.size !== n) this.commit({ ...copy(this.cur), lines: [...set].sort(), arcs: [...as].sort() })
  }

  /** Adds the arc's pieces in one step; returns the pieces that were not there before. */
  addArc(a: Arc): ArcKey[] { return this.replaceArc([], a) }

  /** One step: removes `added` (pieces an earlier addArc put in) and adds the arc; returns the newly added pieces. */
  replaceArc(added: ArcKey[], a: Arc): ArcKey[] {
    const old = this.cur.arcs ?? [], set = new Set(old)
    for (const k of added) set.delete(k)
    const fresh = arcPieces(a).filter(k => !set.has(k))
    for (const k of fresh) set.add(k)
    const next = [...set].sort()
    if (next.join() !== [...old].sort().join()) this.commit({ ...copy(this.cur), arcs: next })
    return fresh
  }

  /** Fills the closed area around q, bounded by every drawn line and arc; an open area fills nothing. */
  fillArea(q: { u: number; v: number }, colour: number) {
    const segs: [P2, P2][] = [
      ...this.cur.lines.map(k => segEnds(k).map(toUV) as [P2, P2]),
      ...this.cur.arcs!.flatMap(k => { const ps = arcPolyline(k); return ps.slice(1).map((p, i): [P2, P2] => [ps[i], p]) }),
    ]
    const at: P2 = [q.u, q.v], poly = areaAt(segs, at)
    if (!poly) return
    const pts = poly.map(([u, v]): P2 => [Math.round(u * 1e4) / 1e4, Math.round(v * 1e4) / 1e4]), size = polyArea(pts)
    // the same area filled again: recolour it (drop the old one); old triangle fills under it go too
    const areas = this.cur.areas!.filter(a => !(inPoly(a.pts, at) && Math.abs(Math.abs(polyArea(a.pts)) - size) < 1e-6))
    const fills = Object.fromEntries(Object.entries(this.cur.fills).filter(([k]) => !inPoly(pts, triCentre(k))))
    this.commit({ ...copy(this.cur), areas: [...areas, { pts, c: colour }], fills })
  }

  /** Removes the last-filled area holding q; false when there is none. */
  unfillArea(q: { u: number; v: number }): boolean {
    const as = this.cur.areas!, i = as.findLastIndex(a => inPoly(a.pts, [q.u, q.v]))
    if (i < 0) return false
    this.commit({ ...copy(this.cur), areas: as.filter((_, j) => j !== i) })
    return true
  }

  erase(s: SegKey | ArcKey) {
    const arcs = this.cur.arcs ?? []
    if (isArcKey(s)) { if (arcs.includes(s)) this.commit({ ...copy(this.cur), arcs: arcs.filter(x => x !== s) }) }
    else if (this.cur.lines.includes(s)) this.commit({ ...copy(this.cur), lines: this.cur.lines.filter(x => x !== s) })
  }

  /** Draw's eraser: removes only the part of line `key` between the crossings nearest `at`; one step. */
  cutErase(key: SegKey, at: { u: number; v: number }) {
    if (!this.cur.lines.includes(key)) return
    const cuts = lineCuts(key, this.cur.lines, this.cur.arcs ?? [])
    const [a, b] = segEnds(key).map(toUV), dx = b[0] - a[0], dy = b[1] - a[1]
    const s = Math.min(1, Math.max(0, ((at.u - a[0]) * dx + (at.v - a[1]) * dy) / (dx * dx + dy * dy)))
    const lo = cuts.findLast(c => c <= s) ?? 0, hi = cuts.find(c => c > s) ?? 1
    const r6 = (x: number) => Math.round(x * 1e6) / 1e6 + 0
    const pt = (x: number) => { const u = a[0] + dx * x, t = r6(u / S); return { t, m: r6(a[1] + dy * x - t / 2) } }
    const parts = [[0, lo], [hi, 1]].filter(([x, y]) => Math.hypot(dx, dy) * (y - x) >= 0.01).map(([x, y]) => {
      const p = x === 0 ? segEnds(key)[0] : pt(x), q = y === 1 ? segEnds(key)[1] : pt(y)
      return segKey(p, q)
    })
    this.commit({ ...copy(this.cur), lines: [...new Set([...this.cur.lines.filter(x => x !== key), ...parts])].sort() })
  }

  // shortcut: fill stops only at grid-edge lines, not at diagonals, free lines or arcs; upgrade if the owner fills such shapes
  fill(start: TriKey, colour: number) {
    const blocked = new Set(this.cur.lines)
    const inside = (k: TriKey) => {
      const vs = new Map<string, { t: number; m: number }>()
      for (const e of triEdges(k)) for (const p of segEnds(e)) vs.set(p.t + ':' + p.m, p)
      let t = 0, m = 0
      for (const p of vs.values()) { t += p.t / 3; m += p.m / 3 }
      const cu = t * S, cv = m + t / 2
      return cu > this.bounds.t0 * S && cu < this.bounds.t1 * S && cv > this.bounds.v0 && cv < this.bounds.v1
    }
    if (!inside(start)) return
    const seen = new Set([start]), queue = [start]
    for (let i = 0; i < queue.length; i++) {
      if (queue.length > MAX_REGION) return
      const t = queue[i], ns = triNeighbours(t)
      for (const [j, e] of triEdges(t).entries()) {
        if (blocked.has(e) || seen.has(ns[j])) continue
        if (!inside(ns[j])) return // region leaks out of bounds: fill nothing
        seen.add(ns[j]); queue.push(ns[j])
      }
    }
    const fills = { ...this.cur.fills }
    let changed = false
    for (const k of queue) {
      if (colour) { if (fills[k] !== colour) { fills[k] = colour; changed = true } }
      else if (k in fills) { delete fills[k]; changed = true }
    }
    if (changed) this.commit({ ...copy(this.cur), fills })
  }

  /** Clears the colour of the area around `start`: neighbours of the same colour not across a drawn line. No closed region needed. */
  unfill(start: TriKey) {
    const c = this.cur.fills[start]
    if (!c) return
    const blocked = new Set(this.cur.lines), fills = { ...this.cur.fills }, queue = [start]
    delete fills[start]
    for (let i = 0; i < queue.length; i++) {
      const ns = triNeighbours(queue[i])
      for (const [j, e] of triEdges(queue[i]).entries())
        if (!blocked.has(e) && fills[ns[j]] === c) { delete fills[ns[j]]; queue.push(ns[j]) }
    }
    this.commit({ ...copy(this.cur), fills })
  }

  clear() {
    if (!this.cur.lines.length && !this.cur.arcs?.length && !this.cur.areas?.length && !Object.keys(this.cur.fills).length) return
    this.commit({ lines: [], arcs: [], areas: [], fills: {} })
  }

  /** Empties the drawing and forgets history (a lives restart is not an undo step). */
  reset() {
    this.past = []; this.future = []; this.cur = { lines: [], arcs: [], areas: [], fills: {} }; this.onChange(this.drawing)
  }

  undo() {
    const p = this.past.pop()
    if (!p) return
    this.future.push(this.cur); this.cur = p; this.onChange(this.drawing)
  }

  redo() {
    const n = this.future.pop()
    if (!n) return
    this.past.push(this.cur); this.cur = n; this.onChange(this.drawing)
  }
}
