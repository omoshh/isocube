import { gridSegKey } from './geometry'
import type { HeightMap } from './shape'

export type Labels = number[][]
export type ViewSet = { top: Set<string>; front: Set<string>; side: Set<string> }

// Z = puzzle height (label length); a puzzle can be shorter than Z, and extra empty rows never change viewLines.
// Label arrays are indexed [x][y] (page convention): top by cube column x / depth y, front by x / z, side by r / z.
export function viewLabels(h: HeightMap, Z = Math.max(0, ...h.h)): { top: Labels; front: Labels; side: Labels } {
  const H = (x: number, y: number) => h.at(x, h.rows - 1 - y)
  const top = Array.from({ length: h.cols }, (_, x) => Array.from({ length: h.rows }, (_, y) => H(x, y) || -1))
  const front = Array.from({ length: h.cols }, (_, x) => Array.from({ length: Z }, (_, z) => {
    for (let y = 0; y < h.rows; y++) if (H(x, y) > z) return y
    return -1
  }))
  const side = Array.from({ length: h.rows }, (_, r) => Array.from({ length: Z }, (_, z) => {
    for (let x = 0; x < h.cols; x++) if (h.at(x, r) > z) return x
    return -1
  }))
  return { top, front, side }
}

// L is indexed [i][j] like the page's labels. Keys use viewSVG's screen coordinates: cell (i, j) is the unit square
// with top-left (i, H-1-j) (x right, y down, H = L[0].length); a line separates cells with different labels, outside counts as -1.
export function viewLines(L: Labels): Set<string> {
  const W = L.length, out = new Set<string>()
  if (!W || !L[0].length) return out
  const H = L[0].length
  const lab = (i: number, j: number) => (i < 0 || j < 0 || i >= W || j >= H ? -1 : L[i][j])
  for (let i = 0; i <= W; i++) for (let j = 0; j < H; j++)
    if (lab(i - 1, j) !== lab(i, j)) out.add(gridSegKey({ x: i, y: H - j }, { x: i, y: H - j - 1 }))
  for (let i = 0; i < W; i++) for (let j = 0; j <= H; j++)
    if (lab(i, j - 1) !== lab(i, j)) out.add(gridSegKey({ x: i, y: H - j }, { x: i + 1, y: H - j }))
  return out
}

export function views(h: HeightMap): ViewSet {
  const l = viewLabels(h)
  return { top: viewLines(l.top), front: viewLines(l.front), side: viewLines(l.side) }
}

export function sameViews(a: ViewSet, b: ViewSet): boolean {
  const eq = (p: Set<string>, q: Set<string>) => p.size === q.size && [...p].every(k => q.has(k))
  return eq(a.top, b.top) && eq(a.front, b.front) && eq(a.side, b.side)
}
