import { segEnds, triEdges, triNeighbours, linePieces, type Line, type SegKey, type TriKey } from './geometry'

export type Drawing = { lines: SegKey[]; fills: Record<TriKey, number>; name?: string }
export type Bounds = { t0: number; t1: number; v0: number; v1: number }

const S = Math.sqrt(3) / 2
const MAX_REGION = 4000 // same cap as the reference page
const copy = (d: Drawing): Drawing => ({ lines: [...d.lines], fills: { ...d.fills } })

export class DrawingEditor {
  private cur: Drawing
  private past: Drawing[] = []
  private future: Drawing[] = []

  constructor(initial: Drawing, private bounds: Bounds, private onChange: (d: Drawing) => void) {
    this.cur = copy(initial)
    this.cur.lines.sort()
  }

  get drawing(): Drawing { return copy(this.cur) }
  get canUndo() { return this.past.length > 0 }
  get canRedo() { return this.future.length > 0 }

  private commit(next: Drawing) {
    this.past.push(this.cur); this.future = []; this.cur = next; this.onChange(this.drawing)
  }

  addLines(ls: Line[]) {
    const set = new Set(this.cur.lines)
    const n = set.size
    for (const l of ls) for (const s of linePieces(l)) set.add(s)
    if (set.size !== n) this.commit({ lines: [...set].sort(), fills: { ...this.cur.fills } })
  }

  erase(s: SegKey) {
    if (!this.cur.lines.includes(s)) return
    this.commit({ lines: this.cur.lines.filter(x => x !== s), fills: { ...this.cur.fills } })
  }

  // shortcut: fill does not stop at diagonals (they cross triangles); upgrade if the owner fills diagonal shapes
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
    if (changed) this.commit({ lines: [...this.cur.lines], fills })
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
    this.commit({ lines: [...this.cur.lines], fills })
  }

  clear() {
    if (!this.cur.lines.length && !Object.keys(this.cur.fills).length) return
    this.commit({ lines: [], fills: {} })
  }

  /** Empties the drawing and forgets history (a lives restart is not an undo step). */
  reset() {
    this.past = []; this.future = []; this.cur = { lines: [], fills: {} }; this.onChange(this.drawing)
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
