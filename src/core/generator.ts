import { HeightMap, visibleFaces } from './shape'
import { countShapeSolutions } from './rampSolver'
import { shapeViews } from './shapeViews'
import { fromEntryRamps, rampCells, validShape, type Dir, type EntryRamp, type Ramp, type Shape } from './solid'
import { gridSegKey } from './geometry'
import { sameViews, views, type ViewSet } from './views'
import { fairPicture, fairShape } from './visibility'

export type Rng = () => number
export function rng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const LEVELS = [
  { level: 1, a: 3, b: 3, maxH: 2 }, { level: 2, a: 3, b: 4, maxH: 3 }, { level: 3, a: 4, b: 4, maxH: 3 },
  { level: 4, a: 4, b: 5, maxH: 4 }, { level: 5, a: 5, b: 5, maxH: 4 }, { level: 6, a: 5, b: 6, maxH: 5 },
] as const

export type PuzzleEntry = { id: string; set: 'level' | 'reverse' | 'slopes'; level: number; cols: number; rows: number; maxH: number; h: number[]; ramps?: EntryRamp[] }

export const entryShape = (e: PuzzleEntry): Shape => ({ hm: new HeightMap(e.cols, e.rows, e.h), ramps: fromEntryRamps(e.ramps ?? []) })
export type PuzzleFile = { version: 1; puzzles: PuzzleEntry[] }

const pick = (r: Rng, n: number) => Math.floor(r() * n)

export function sampleShape(cols: number, rows: number, maxH: number, r: Rng): HeightMap {
  const n = cols * rows, target = Math.ceil(n * (0.55 + 0.45 * r())), on = new Set<number>([pick(r, n)])
  const covered = () => {
    const cs = new Set([...on].map(i => i % cols)), rs = new Set([...on].map(i => Math.floor(i / cols)))
    return cs.size === cols && rs.size === rows
  }
  while (on.size < target || !covered()) {
    const frontier: number[] = []
    for (const i of on) {
      const c = i % cols
      for (const j of [c > 0 ? i - 1 : -1, c < cols - 1 ? i + 1 : -1, i - cols, i + cols])
        if (j >= 0 && j < n && !on.has(j) && !frontier.includes(j)) frontier.push(j)
    }
    frontier.sort((p, q) => p - q) // Set order depends on insertion only, but keep picks independent of it
    on.add(frontier[pick(r, frontier.length)])
  }
  const cells = [...on].sort((p, q) => p - q), h = new Array<number>(n).fill(0)
  for (const i of cells) h[i] = 1 + pick(r, maxH)
  h[cells[pick(r, cells.length)]] = maxH
  return new HeightMap(cols, rows, h)
}

// Line presence for every edge of a W×H label grid, read back from a viewLines set (same coordinates as viewLines).
function edgeLines(s: Set<string>, W: number, H: number) {
  const v = (i: number, j: number) => s.has(gridSegKey({ x: i, y: H - j }, { x: i, y: H - j - 1 })) // left of cell (i, j)
  const h = (i: number, j: number) => s.has(gridSegKey({ x: i, y: H - j }, { x: i + 1, y: H - j })) // below cell (i, j)
  return {
    v: Array.from({ length: W + 1 }, (_, i) => Array.from({ length: H }, (_, j) => v(i, j))),
    h: Array.from({ length: W }, (_, i) => Array.from({ length: H + 1 }, (_, j) => h(i, j))),
  }
}

const U = -2 // label not known yet: it ends up > bound (the index filled so far) or -1
// does a line between labels a and b match `line`? Pairs that can still go either way pass.
const ok = (a: number, b: number, line: boolean, bound: number) => {
  if (a !== U && b !== U) return (a !== b) === line
  const o = a === U ? b : a
  return o >= 0 && o <= bound ? line : true
}

/**
 * Number of height maps (cols×rows, heights 0..maxH) whose views equal v, counting up to `limit`.
 * Cells are filled column by column (x = c), front to back inside a column (y = 0 first). Top-view regions (cells
 * joined without a line) share one height; per-cell bounds come from the front/side outlines; front labels of the
 * current column and side labels of the current row are checked after every cell, with not-yet-known labels (U).
 */
export function countSolutions(v: ViewSet, cols: number, rows: number, maxH: number, limit = 2): number {
  let Z = 0
  for (const k of v.front) for (const p of k.split('|')) Z = Math.max(Z, +p.split(':')[1])
  if (Z === 0 || Z > maxH) return 0
  const T = edgeLines(v.top, cols, rows), F = edgeLines(v.front, cols, Z), S = edgeLines(v.side, rows, Z)
  const top = (x: number) => { let z = Z; while (z > 0 && !F.h[x][z]) z--; return z } // column height from the outline
  const colMax = Array.from({ length: cols }, (_, x) => top(x))
  const rowMax = Array.from({ length: rows }, (_, r) => { let z = Z; while (z > 0 && !S.h[r][z]) z--; return z })

  // top regions: union cells (x, y) joined without a line
  const id = (x: number, y: number) => x * rows + y, parent = Array.from({ length: cols * rows }, (_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
    if (x > 0 && !T.v[x][y]) parent[find(id(x, y))] = find(id(x - 1, y))
    if (y > 0 && !T.h[x][y]) parent[find(id(x, y))] = find(id(x, y - 1))
  }
  const lo = new Array<number>(cols * rows).fill(0), hi = new Array<number>(cols * rows).fill(maxH)
  for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
    const g = find(id(x, y))
    hi[g] = Math.min(hi[g], colMax[x], rowMax[rows - 1 - y])
    const border: boolean[] = []
    if (x === 0) border.push(T.v[0][y])
    if (x === cols - 1) border.push(T.v[cols][y])
    if (y === 0) border.push(T.h[x][0])
    if (y === rows - 1) border.push(T.h[x][rows])
    for (const b of border) if (b) lo[g] = Math.max(lo[g], 1); else hi[g] = 0
  }

  const hv = new Array<number>(cols * rows).fill(0), regVal = new Array<number>(cols * rows).fill(-1)
  const fl = Array.from({ length: cols }, () => new Array<number>(Z).fill(U)) // front labels [x][z]
  const sl = Array.from({ length: rows }, () => new Array<number>(Z).fill(U)) // side labels [r][z]
  const fLab = (x: number, z: number) => (x < 0 || x >= cols || z < 0 || z >= Z ? -1 : fl[x][z])
  const sLab = (r: number, z: number) => (r < 0 || r >= rows || z < 0 || z >= Z ? -1 : sl[r][z])
  const frontOk = (x: number, y: number) => {
    for (let j = 0; j <= Z; j++) if (!ok(fLab(x, j - 1), fLab(x, j), F.h[x][j], y)) return false
    for (let j = 0; j < Z; j++) if (!ok(fLab(x - 1, j), fLab(x, j), F.v[x][j], y)) return false
    if (x === cols - 1) for (let j = 0; j < Z; j++) if (!ok(fLab(x, j), -1, F.v[cols][j], y)) return false
    return true
  }
  const sideOk = (r: number, x: number) => { // row r + 1 is already done in this column, row r - 1 is not
    for (let j = 0; j <= Z; j++) if (!ok(sLab(r, j - 1), sLab(r, j), S.h[r][j], x)) return false
    for (let j = 0; j < Z; j++) if (!ok(sLab(r, j), sLab(r + 1, j), S.v[r + 1][j], x)) return false
    if (r === 0) for (let j = 0; j < Z; j++) if (!ok(-1, sLab(0, j), S.v[0][j], x)) return false
    return true
  }

  let count = 0
  const rec = (k: number): void => {
    if (k === cols * rows) {
      const h = new Array<number>(cols * rows)
      for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) h[(rows - 1 - y) * cols + x] = hv[id(x, y)]
      if (sameViews(views(new HeightMap(cols, rows, h)), v)) count++ // the checks above are exact; this is a guard
      return
    }
    const x = Math.floor(k / rows), y = k % rows, r = rows - 1 - y, g = find(k)
    const own = regVal[g] < 0, from = own ? lo[g] : regVal[g], to = own ? hi[g] : regVal[g]
    for (let val = from; val <= to && count < limit; val++) {
      if (x > 0 && T.v[x][y] && hv[id(x - 1, y)] === val) continue
      if (y > 0 && T.h[x][y] && hv[id(x, y - 1)] === val) continue
      const undo: [number[], number, number][] = []
      const set = (a: number[], i: number, w: number) => { undo.push([a, i, a[i]]); a[i] = w }
      for (let z = 0; z < val; z++) {
        if (fl[x][z] === U) set(fl[x], z, y)
        if (sl[r][z] === U) set(sl[r], z, x)
      }
      if (y === rows - 1) for (let z = 0; z < Z; z++) if (fl[x][z] === U) set(fl[x], z, -1)
      if (x === cols - 1) for (let z = 0; z < Z; z++) if (sl[r][z] === U) set(sl[r], z, -1)
      if (frontOk(x, y) && sideOk(r, x)) {
        hv[k] = val
        if (own) regVal[g] = val
        rec(k + 1)
        if (own) regVal[g] = -1
        hv[k] = 0
      }
      for (let u = undo.length - 1; u >= 0; u--) undo[u][0][undo[u][1]] = undo[u][2]
    }
  }
  rec(0)
  return count
}

export function makePuzzle(level: number, seed: number): { seed: number; hm: HeightMap } {
  const { a, b, maxH } = LEVELS[level - 1], r = rng(seed), [cols, rows] = r() < 0.5 ? [a, b] : [b, a]
  for (;;) {
    const hm = sampleShape(cols, rows, maxH, r)
    if (fairPicture(hm) && countSolutions(views(hm), cols, rows, maxH) === 1) return { seed, hm } // fairPicture first: it is cheaper
  }
}

export function difficulty(hm: HeightMap): [number, number] {
  const seen = new Set([...visibleFaces(hm).values()].map(f => `${f.x},${f.y},${f.z}`))
  return [hm.cubeCount - seen.size, hm.cubeCount]
}

/** Heights that never fall toward the back or the right: every cell shows in the front and the side view, so hidden
 *  twins (a ramp a cube can stand in for) are rare. Measured: 10 of 17 fair candidates unique, against 1 of 26 for `sampleShape`. */
export function stairShape(cols: number, rows: number, maxH: number, r: Rng): HeightMap {
  const H: number[][] = Array.from({ length: cols }, () => new Array<number>(rows).fill(0)), h = new Array<number>(cols * rows).fill(0)
  for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
    H[x][y] = Math.min(maxH, Math.max(x ? H[x - 1][y] : 0, y ? H[x][y - 1] : 0) + (r() < 0.45 ? 1 : 0) + (x + y === 0 ? 1 : 0))
    h[(rows - 1 - y) * cols + x] = H[x][y]
  }
  return new HeightMap(cols, rows, h)
}

/** A Slopes candidate (3×3 or 3×4, maxH 3, 1–3 ramps): returned only when fair and with one solution among cube-and-ramp shapes. */
export function makeSlopeCandidate(seed: number): Shape | null {
  const r = rng(seed), [cols, rows] = r() < 0.5 ? [3, 3] : r() < 0.5 ? [3, 4] : [4, 3], hm = stairShape(cols, rows, 3, r)
  const dirs: Dir[] = ['E', 'W', 'N', 'S'], ramps: Ramp[] = [], want = 1 + pick(r, 3)
  for (let i = 0; i < 30 && ramps.length < want; i++) {
    const c: Ramp = { x: pick(r, cols), y: pick(r, rows), len: (1 + pick(r, 3)) as 1 | 2 | 3, dir: dirs[pick(r, 4)] }
    if (validShape({ hm, ramps: [...ramps, c] }, 3)) ramps.push(c)
  }
  const s = { hm, ramps }
  if (!ramps.length || !fairShape(s, 3)) return null
  return countShapeSolutions(shapeViews(s, 3), cols, rows, 3, 2) === 1 ? s : null
}

/** Cells whose stack height or ramp part differ (shapes of other sizes count as far apart). */
export function shapeDistance(a: Shape, b: Shape): number {
  if (a.hm.cols !== b.hm.cols || a.hm.rows !== b.hm.rows) return Infinity
  const sig = (s: Shape) => {
    const m = new Map<string, string>()
    s.ramps.forEach(r => rampCells(r).forEach(([x, y], i) => m.set(x + ',' + y, `${r.dir}${r.len}.${i}`)))
    return (x: number, y: number) => s.hm.at(x, s.hm.rows - 1 - y) + (m.get(x + ',' + y) ?? '')
  }
  const A = sig(a), B = sig(b)
  let d = 0
  for (let x = 0; x < a.hm.cols; x++) for (let y = 0; y < a.hm.rows; y++) if (A(x, y) !== B(x, y)) d++
  return d
}
