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

// Cells are (x = column, y = row index of L); a line separates cells with different labels, outside counts as -1.
export function viewLines(L: Labels): Set<string> {
  const rows = L.length, cols = L[0].length, out = new Set<string>()
  const lab = (x: number, y: number) => (x < 0 || y < 0 || x >= cols || y >= rows ? -1 : L[y][x])
  for (let y = 0; y < rows; y++) for (let x = 0; x <= cols; x++)
    if (lab(x - 1, y) !== lab(x, y)) out.add(gridSegKey({ x, y }, { x, y: y + 1 }))
  for (let y = 0; y <= rows; y++) for (let x = 0; x < cols; x++)
    if (lab(x, y - 1) !== lab(x, y)) out.add(gridSegKey({ x, y }, { x: x + 1, y }))
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
