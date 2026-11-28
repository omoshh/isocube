// The search of `countShapeSolutions` (rampSolver.ts: column by column, front row first; top view per cell, strip
// checks per cell that leave border pieces alone, the front view per column, all 3 views at a leaf) with every view
// worked out exactly by `exactView`, the pieces on a cell taken from PIECES, and a step budget.
import { exactView, exactViews } from './exactViews'
import { PIECES, type PieceType, type Placed } from './pieces'
import { HeightMap } from './shape'
import type { Shape } from './solid'
import type { ViewSet } from './views'

// the x (front) or y (side) screen coordinates of a piece key's 2 ends, parsed once per key
const ENDS = new Map<string, [number, number]>()
const ends = (k: string) => {
  let e = ENDS.get(k)
  if (!e) ENDS.set(k, (e = k.replace('#p', '').split('|').map(p => +p.split(':')[0]) as [number, number]))
  return e
}

type Opts = { limit?: number; budget?: number; onSolution?: (s: Shape) => void }

/**
 * How many shapes (up to `limit`, default 2) have views `v`. `budget` caps the search steps: when hit, the search
 * stops with `gaveUp` (the count is then only a lower bound). Targets must have no partly hidden line (`#p`).
 */
export function solveShapes(v: ViewSet, cols: number, rows: number, maxH: number, o: Opts = {}): { count: number; gaveUp: boolean } {
  if ([...v.top, ...v.front, ...v.side].some(k => k.endsWith('#p'))) throw new Error('target views have a partly hidden line')
  const limit = o.limit ?? 2, budget = o.budget ?? Infinity
  // caps: nothing in a column (row) rises above the highest line of the front (side) view over it
  const cap = (keys: Set<string>, lo: number) => {
    let top = 0
    for (const k of keys) {
      const ps = k.split('|').map(p => p.split(':').map(Number))
      if (Math.min(ps[0][0], ps[1][0]) <= lo + 1 && Math.max(ps[0][0], ps[1][0]) >= lo) top = Math.max(top, maxH - ps[0][1], maxH - ps[1][1])
    }
    return top
  }
  const colTop = Array.from({ length: cols }, (_, x) => cap(v.front, x)), rowTop = Array.from({ length: rows }, (_, y) => cap(v.side, rows - y - 1))
  const capAt = (x: number, y: number) => Math.min(colTop[x], rowTop[y])
  // per cell: the ways to start a piece there that fit the grid
  const choices = Array.from({ length: cols }, (_, x) => Array.from({ length: rows }, (_, y) =>
    PIECES.flatMap(t => (t.starts?.(x, y) ?? []).map(p => ({ t, p }))).filter(({ t, p }) => t.cells(p).every(([cx, cy]) => cx >= 0 && cy >= 0 && cx < cols && cy < rows))))
  const hv = Array.from({ length: cols }, () => new Array<number>(rows).fill(0))
  const forced = Array.from({ length: cols }, () => new Array<number>(rows).fill(-1)) // piece that already covers the cell
  const topPlane = Array.from({ length: cols }, () => new Array<string | null>(rows).fill(null)) // a piece's top plane on the cell
  const placed: { t: PieceType; p: Placed }[] = []
  const plane = (x: number, y: number) => (x < 0 || y < 0 || x >= cols || y >= rows ? 'none' : topPlane[x][y] ?? (hv[x][y] ? 'top' + hv[x][y] : 'none'))
  // top view keys (screen (x, rows − y)): the edge left of cell (x, y), and the edge in front of it
  const leftKey = (x: number, y: number) => `${x}:${rows - y - 1}|${x}:${rows - y}`
  const frontKey = (x: number, y: number) => `${x}:${rows - y}|${x + 1}:${rows - y}`
  const topOk = (x: number, y: number) => {
    const p = plane(x, y), is = (k: string, other: string) => v.top.has(k) === (p !== other)
    if (!is(leftKey(x, y), plane(x - 1, y)) || !is(frontKey(x, y), plane(x, y - 1))) return false
    if (x === cols - 1 && !is(leftKey(cols, y), 'none')) return false
    if (y === rows - 1 && !is(frontKey(x, rows), 'none')) return false
    return true
  }

  // shortcut: Shape holds only ramps, so every piece but the cube is stored as one; a phase 3 piece needs Shape to grow
  const ramp = ({ p }: { p: Placed }) => ({ x: p.x, y: p.y, len: p.len, dir: p.dir })
  const shapeNow = (): Shape => {
    const h = new Array<number>(cols * rows).fill(0)
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) h[(rows - 1 - y) * cols + x] = hv[x][y]
    return { hm: new HeightMap(cols, rows, h), ramps: placed.map(ramp) }
  }
  /** The shape of only some cells (plus the pieces on them, with all their cells). */
  const partOf = (keep: (x: number, y: number) => boolean): Shape => {
    const ps = placed.filter(({ t, p }) => t.cells(p).some(([cx, cy]) => keep(cx, cy)))
    const on = new Set(ps.flatMap(({ t, p }) => t.cells(p).map(([cx, cy]) => cx + ',' + cy)))
    const h = new Array<number>(cols * rows).fill(0)
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) if (keep(x, y) || on.has(x + ',' + y)) h[(rows - 1 - y) * cols + x] = hv[x][y]
    return { hm: new HeightMap(cols, rows, h), ramps: ps.map(ramp) }
  }
  /** Pieces strictly inside a strip (not on its 2 border lines, which cells not yet placed can still change) and
   *  covered on both sides are final: lines exactly where the target has lines. */
  const stripOk = (view: 'front' | 'side', s: Shape, lo: number) => {
    const k = exactView(s, maxH, view), target = v[view]
    for (const [piece, both] of k.covered) {
      if (!both) continue
      const [a, b] = ends(piece)
      if (a < lo || a > lo + 1 || b < lo || b > lo + 1 || (a === b && (a === lo || a === lo + 1))) continue
      const mine = k.keys.has(piece) ? piece : k.keys.has(piece + '#p') ? piece + '#p' : null
      if (mine ? !target.has(mine) : target.has(piece) || target.has(piece + '#p')) return false
    }
    return true
  }
  // front: the slab of column x (cells in front of (x, y) are all placed); side: row y, from every placed cell
  const cellOk = (x: number, y: number) =>
    stripOk('front', partOf((cx, cy) => cx === x && cy <= y), x) &&
    stripOk('side', partOf((cx, cy) => cx < x || (cx === x && cy <= y)), rows - y - 1)

  const frontDecided = (k: string, x: number) => { const [a, b] = ends(k); return Math.max(a, b) <= x + 1 && !(a === x + 1 && b === x + 1) }
  const columnOk = (x: number) => {
    const front = exactView(shapeNow(), maxH, 'front').keys
    for (const k of front) if (frontDecided(k, x) && !v.front.has(k)) return false
    for (const k of v.front) if (frontDecided(k, x) && !front.has(k)) return false
    return true
  }
  const sameAll = () => {
    const sv = exactViews(shapeNow(), maxH), eq = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every(k => b.has(k))
    return eq(sv.top, v.top) && eq(sv.front, v.front) && eq(sv.side, v.side)
  }

  let count = 0, steps = 0, gaveUp = false
  const done = () => count >= limit || gaveUp
  const rec = (k: number): void => {
    if (done()) return
    if (++steps > budget) { gaveUp = true; return }
    if (k === cols * rows) { if (sameAll()) { count++; o.onSolution?.(shapeNow()) } return }
    const x = Math.floor(k / rows), y = k % rows
    const next = () => { if (topOk(x, y) && cellOk(x, y) && (y < rows - 1 || columnOk(x))) rec(k + 1) }
    const f = forced[x][y]
    if (f >= 0) { // part of a piece started earlier: its height and piece are fixed
      next()
      return
    }
    for (let h = 0; h <= capAt(x, y) && !done(); h++) {
      hv[x][y] = h
      next()
      if (h + 1 > capAt(x, y)) continue
      for (const { t, p } of choices[x][y]) {
        if (done()) break
        const cells = t.cells(p)
        if (cells.some(([cx, cy]) => (cx !== x || cy !== y) && forced[cx][cy] >= 0 || h + 1 > capAt(cx, cy))) continue
        const q = { ...p, z: h }
        placed.push({ t, p: q })
        // every cell gets the base height now: the low end (which carries it) may come later in search order
        cells.forEach(([cx, cy], i) => { forced[cx][cy] = placed.length - 1; hv[cx][cy] = h; topPlane[cx][cy] = t.section(q, i, 'top', 1, 1, 2) })
        forced[x][y] = -1
        next()
        for (const [cx, cy] of cells) { forced[cx][cy] = -1; topPlane[cx][cy] = null; if (cx !== x || cy !== y) hv[cx][cy] = 0 }
        placed.pop()
      }
    }
    hv[x][y] = 0
  }
  rec(0)
  return { count, gaveUp }
}
