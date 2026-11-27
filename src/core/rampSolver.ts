// How many shapes of cubes and ramps have the given views? Cells are filled column by column (x outer, y inner,
// front row first). The top view is checked cell by cell (a line between two cells exactly when their top planes
// differ); after each column, the front view on every piece only finished columns decide, and the side view on
// every piece covered on both sides; at a leaf, all 3 views must be equal.
import { HeightMap } from './shape'
import { shapeViews, viewSketch } from './shapeViews'
import { rampCells, slopePlane, type Dir, type Ramp, type Shape } from './solid'
import type { ViewSet } from './views'

const DIRS: Dir[] = ['E', 'W', 'N', 'S']
const LENS = [1, 2, 3] as const

/** Target views must have no partly hidden line (`#p`): fair puzzles never do, and the per-cell checks rely on it. */
export function countShapeSolutions(v: ViewSet, cols: number, rows: number, maxH: number, limit = 2, onSolution?: (s: Shape) => void): number {
  if ([...v.top, ...v.front, ...v.side].some(k => k.endsWith('#p'))) throw new Error('target views have a partly hidden line')
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
  const hv = Array.from({ length: cols }, () => new Array<number>(rows).fill(0))
  const ramp = Array.from({ length: cols }, () => new Array<number>(rows).fill(-1)) // index into ramps, -1 = none
  const forced = Array.from({ length: cols }, () => new Array<number>(rows).fill(-1)) // ramp that already covers the cell
  const ramps: Ramp[] = []
  const plane = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return 'none'
    const i = ramp[x][y]
    return i >= 0 ? slopePlane(ramps[i], hv[x][y]) : hv[x][y] ? 'top' + hv[x][y] : 'none'
  }
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

  const shapeNow = (): Shape => {
    const h = new Array<number>(cols * rows).fill(0)
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) h[(rows - 1 - y) * cols + x] = hv[x][y]
    return { hm: new HeightMap(cols, rows, h), ramps: ramps.slice() }
  }
  /** The shape of only some cells (plus the ramps on them, with their base cells). */
  const partOf = (keep: (x: number, y: number) => boolean): Shape => {
    const rs = ramps.filter(r => rampCells(r).some(([cx, cy]) => keep(cx, cy)))
    const on = new Set(rs.flatMap(r => rampCells(r).map(([cx, cy]) => cx + ',' + cy)))
    const h = new Array<number>(cols * rows).fill(0)
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) if (keep(x, y) || on.has(x + ',' + y)) h[(rows - 1 - y) * cols + x] = hv[x][y]
    return { hm: new HeightMap(cols, rows, h), ramps: rs }
  }
  /** Pieces covered on both sides inside a strip are final: they must be lines exactly where the target has lines. */
  const stripOk = (view: 'front' | 'side', s: Shape, inStrip: (a: number, b: number) => boolean) => {
    const k = viewSketch(s, maxH, view), target = v[view]
    for (const [piece, both] of k.covered) {
      if (!both) continue
      const [a, b] = piece.split('|').map(p => +p.split(':')[0])
      if (!inStrip(a, b)) continue
      const mine = k.keys.has(piece) ? piece : k.keys.has(piece + '#p') ? piece + '#p' : null
      if (mine ? !target.has(mine) : target.has(piece) || target.has(piece + '#p')) return false
    }
    return true
  }
  // front slab of column x: cells (x, 0..y); side strip of row y (screen x from rows − y − 1 to rows − y): cells (0..x, y)
  const cellOk = (x: number, y: number) =>
    stripOk('front', partOf((cx, cy) => cx === x && cy <= y), (a, b) => a >= x && a <= x + 1 && b >= x && b <= x + 1) &&
    stripOk('side', partOf((cx, cy) => cy === y && cx <= x), (a, b) => a >= rows - y - 1 && a <= rows - y && b >= rows - y - 1 && b <= rows - y)

  const pieceX = (k: string) => k.replace('#p', '').split('|').map(p => +p.split(':')[0])
  const frontDecided = (k: string, x: number) => { const [a, b] = pieceX(k); return Math.max(a, b) <= x + 1 && !(a === x + 1 && b === x + 1) }
  const columnOk = (x: number) => {
    const front = viewSketch(shapeNow(), maxH, 'front').keys
    for (const k of front) if (frontDecided(k, x) && !v.front.has(k)) return false
    for (const k of v.front) if (frontDecided(k, x) && !front.has(k)) return false
    return true
  }
  const sameAll = () => {
    const sv = shapeViews(shapeNow(), maxH), eq = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every(k => b.has(k))
    return eq(sv.top, v.top) && eq(sv.front, v.front) && eq(sv.side, v.side)
  }

  let count = 0
  const rec = (k: number): void => {
    if (count >= limit) return
    if (k === cols * rows) { if (sameAll()) { count++; onSolution?.(shapeNow()) } return }
    const x = Math.floor(k / rows), y = k % rows
    const next = () => { if (topOk(x, y) && cellOk(x, y) && (y < rows - 1 || columnOk(x))) rec(k + 1) }
    const f = forced[x][y]
    if (f >= 0) { // part of a ramp started earlier: its height and ramp are fixed
      hv[x][y] = hv[ramps[f].x][ramps[f].y]; ramp[x][y] = f
      next()
      hv[x][y] = 0; ramp[x][y] = -1
      return
    }
    for (let h = 0; h <= capAt(x, y) && count < limit; h++) {
      hv[x][y] = h
      next()
      if (h + 1 > capAt(x, y)) continue
      for (const dir of DIRS) for (const len of LENS) {
        if (count >= limit) break
        // cells in search order from this one: E/W along x, N/S along y; the low end is the first (E, N) or last (W, S)
        const cells = Array.from({ length: len }, (_, i): [number, number] => (dir === 'E' || dir === 'W' ? [x + i, y] : [x, y + i]))
        if (cells.some(([cx, cy]) => cx >= cols || cy >= rows || (cx !== x || cy !== y) && forced[cx][cy] >= 0 || h + 1 > capAt(cx, cy))) continue
        const [lx, ly] = dir === 'E' || dir === 'N' ? cells[0] : cells[len - 1]
        ramps.push({ x: lx, y: ly, len, dir })
        const i = ramps.length - 1
        // the ramp's low-end cell carries the base height: make lookups through it work for every covered cell
        for (const [cx, cy] of cells) { forced[cx][cy] = i; hv[cx][cy] = h }
        forced[x][y] = -1; ramp[x][y] = i
        next()
        for (const [cx, cy] of cells) { forced[cx][cy] = -1; if (cx !== x || cy !== y) hv[cx][cy] = 0 }
        ramp[x][y] = -1; ramps.pop()
      }
    }
    hv[x][y] = 0
  }
  rec(0)
  return count
}
