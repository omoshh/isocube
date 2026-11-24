// Nets of polycubes. Port of the NETS MODE code in reference/index.html.
import { rng, type Rng } from './generator'

export type Cell = { c: number; r: number }
export type Net = Cell[] // normalized: min c = min r = 0
export type Polycube = [number, number, number][]
export type NetsPuzzle = { level: 1 | 2 | 3; shape: Polycube; options: Net[]; correct: number }

type V3 = [number, number, number]
type P2 = [number, number]
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const neg = (a: V3): V3 => [-a[0], -a[1], -a[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const key = (a: number[]) => a.join(',')
const AXES: V3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
const DIRS: P2[] = [[1, 0], [-1, 0], [0, 1], [0, -1]]

// shapes per level (x right, y back, z up), as on the page
export const NET_SHAPES: Record<1 | 2 | 3, Polycube[]> = {
  1: [[[0, 0, 0]], [[0, 0, 0], [1, 0, 0]], [[0, 0, 0], [0, 0, 1]], [[0, 0, 0], [1, 0, 0], [2, 0, 0]]],
  2: [[[0, 0, 0], [1, 0, 0], [0, 1, 0]],
    [[0, 0, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]],
    [[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1]],
    [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]]],
  3: [[[0, 0, 0], [1, 0, 0], [2, 0, 0], [1, 1, 0]],
    [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 1, 0]],
    [[0, 1, 0], [1, 1, 0], [1, 0, 0], [2, 0, 0]],
    [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]],
    [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 0, 1]],
    [[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1]]],
}

type Face = { c: V3; n: V3 }
type Solid = { filled: (c: V3) => boolean; faces: Face[] }
function makeSolid(cells: Polycube): Solid {
  const set = new Set(cells.map(key))
  const filled = (c: V3) => set.has(key(c))
  const faces: Face[] = []
  for (const c of cells) for (const n of AXES) if (!filled(add(c, n))) faces.push({ c, n })
  return { filled, faces }
}
const fkey = (f: Face) => key(f.c) + '|' + key(f.n)

// cross one face edge in direction d: next face and the rotation of the frame
function crossEdge(solid: Solid, c: V3, n: V3, d: V3) {
  const s = cross(n, d)
  const up = add(add(c, d), n), side = add(c, d)
  let nc: V3, Rn: V3, Rd: V3, type: number
  if (solid.filled(up)) { nc = up; Rn = neg(d); Rd = n; type = -1 } // concave
  else if (solid.filled(side)) { nc = side; Rn = n; Rd = d; type = 0 } // flat
  else { nc = c; Rn = d; Rd = neg(n); type = 1 } // convex
  const R = (v: V3): V3 => add(add(scale(Rn, dot(v, n)), scale(Rd, dot(v, d))), scale(s, dot(v, s)))
  return { c: nc, n: Rn, R, type }
}
const dir3 = (a: V3, b: V3, k: number) => [a, neg(a), b, neg(b)][k]

function adjCount(cells: P2[]) {
  const set = new Set(cells.map(key))
  let n = 0
  for (const [i, j] of cells) { if (set.has(key([i + 1, j]))) n++; if (set.has(key([i, j + 1]))) n++ }
  return n
}
function connected(cells: P2[]) {
  const set = new Set(cells.map(key)), seen = new Set([key(cells[0])]), st = [cells[0]]
  while (st.length) {
    const [i, j] = st.pop()!
    for (const [di, dj] of DIRS) {
      const k = key([i + di, j + dj])
      if (set.has(k) && !seen.has(k)) { seen.add(k); st.push([i + di, j + dj]) }
    }
  }
  return seen.size === cells.length
}
const isTree = (cells: P2[]) => connected(cells) && adjCount(cells) === cells.length - 1

const pick = <T>(a: T[], r: Rng) => a[Math.floor(r() * a.length)]
function shuffle<T>(a: T[], r: Rng): T[] {
  const b = a.slice()
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] }
  return b
}
const normalize = (ps: P2[]): Net => {
  const mi = Math.min(...ps.map(p => p[0])), mj = Math.min(...ps.map(p => p[1]))
  return ps.map(([i, j]) => ({ c: i - mi, r: j - mj }))
}
const toP = (n: Net): P2[] => n.map(x => [x.c, x.r])

export type UnfoldStep = { pos: P2; c: V3; n: V3; a: V3; b: V3; parent: number; k: number; type: number; idx: number }

/** Random unfolding with the root face on the bottom (z=-1). `tree` (placement order, parents, fold types) is for the fold animation. */
export function unfoldTree(shape: Polycube, r: Rng): { net: Net; tree: UnfoldStep[] } | null {
  const solid = makeSolid(shape)
  const roots = solid.faces.filter(f => f.n[2] === -1)
  for (let tries = 0; tries < 400; tries++) {
    const f0 = pick(roots, r)
    const a0 = pick(AXES.filter(x => dot(x, f0.n) === 0), r)
    const st: UnfoldStep = { pos: [0, 0], c: f0.c, n: f0.n, a: a0, b: cross(f0.n, a0), parent: -1, k: -1, type: 0, idx: 0 }
    const placed = new Set(['0,0']), used = new Set([fkey(f0)]), stack = [st], order = [st]
    while (stack.length) {
      const i = Math.floor(r() * stack.length), cur = stack[i]
      let grown = false
      for (const k of shuffle([0, 1, 2, 3], r)) {
        const p: P2 = [cur.pos[0] + DIRS[k][0], cur.pos[1] + DIRS[k][1]]
        if (placed.has(key(p))) continue
        const nx = crossEdge(solid, cur.c, cur.n, dir3(cur.a, cur.b, k))
        const fk = key(nx.c) + '|' + key(nx.n)
        if (used.has(fk)) continue
        const ns: UnfoldStep = { pos: p, c: nx.c, n: nx.n, a: nx.R(cur.a), b: nx.R(cur.b), parent: cur.idx, k, type: nx.type, idx: order.length }
        placed.add(key(p)); used.add(fk); stack.push(ns); order.push(ns); grown = true
        break
      }
      if (!grown) stack.splice(i, 1)
    }
    if (used.size !== solid.faces.length) continue
    const cells = order.map(s => s.pos)
    if (isTree(cells)) return { net: normalize(cells), tree: order } // tree[i].pos is un-normalized; use as laid out
  }
  return null
}

export function unfold(shape: Polycube, r: Rng): Net {
  const u = unfoldTree(shape, r)
  if (!u) throw new Error('unfold failed')
  return u.net
}

/** Does the net (every shared edge folds) fold onto exactly the surface of shape? Tries every start face and both paper sides. */
export function folds(net: Net, shape: Polycube): boolean {
  const solid = makeSolid(shape)
  const cells = toP(net)
  if (cells.length !== solid.faces.length) return false
  const set = new Map(cells.map((p, i) => [key(p), i]))
  for (const f0 of solid.faces) for (const a0 of AXES.filter(x => dot(x, f0.n) === 0)) for (const flip of [1, -1]) {
    const st: ({ c: V3; n: V3; a: V3; b: V3 } | null)[] = new Array(cells.length).fill(null)
    const used = new Map<string, number>()
    st[0] = { c: f0.c, n: f0.n, a: a0, b: scale(cross(f0.n, a0), flip) }
    used.set(fkey(f0), 0)
    const q = [0]
    let ok = true
    while (q.length && ok) {
      const i = q.shift()!, cur = st[i]!
      for (let k = 0; k < 4 && ok; k++) {
        const j = set.get(key([cells[i][0] + DIRS[k][0], cells[i][1] + DIRS[k][1]]))
        if (j === undefined) continue
        const nx = crossEdge(solid, cur.c, cur.n, dir3(cur.a, cur.b, k))
        const fk = key(nx.c) + '|' + key(nx.n)
        const sj = st[j]
        if (sj) { if (key(sj.c) + '|' + key(sj.n) !== fk) ok = false; continue }
        if (used.has(fk)) { ok = false; continue }
        st[j] = { c: nx.c, n: nx.n, a: nx.R(cur.a), b: nx.R(cur.b) }
        used.set(fk, j); q.push(j)
      }
    }
    if (ok && used.size === solid.faces.length) return true
  }
  return false
}

// net up to rotation and mirror (the page treats those as the same option)
const TRANS: ((p: P2) => P2)[] = [p => [p[0], p[1]], p => [-p[1], p[0]], p => [-p[0], -p[1]], p => [p[1], -p[0]],
  p => [-p[0], p[1]], p => [p[1], p[0]], p => [p[0], -p[1]], p => [-p[1], -p[0]]]
function canon(cells: P2[]): string {
  let best: string | null = null
  for (const t of TRANS) {
    const n = normalize(cells.map(t))
    const s = n.map(x => [x.c, x.r]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(key).join(';')
    if (best === null || s < best) best = s
  }
  return best!
}
function randomTransform(cells: P2[], r: Rng): P2[] {
  const k = Math.floor(r() * 4), m = r() < 0.5
  return cells.map(([i, j]) => { let p: P2 = m ? [-i, j] : [i, j]; for (let t = 0; t < k; t++) p = [-p[1], p[0]]; return p })
}

// wrong net: move one end square to another free place so that it no longer folds
function wrongNet(cells: P2[], shape: Polycube, r: Rng): P2[] | null {
  const set = new Set(cells.map(key))
  const deg = (p: P2) => DIRS.filter(([di, dj]) => set.has(key([p[0] + di, p[1] + dj]))).length
  const leaves = cells.filter(p => deg(p) === 1)
  for (let tries = 0; tries < 300; tries++) {
    const leaf = pick(leaves, r)
    const rest = cells.filter(p => p !== leaf)
    const rs = new Set(rest.map(key))
    const spots: P2[] = []
    for (const [i, j] of rest) for (const [di, dj] of DIRS) {
      const p: P2 = [i + di, j + dj], k = key(p)
      if (rs.has(k) || k === key(leaf)) continue
      if (DIRS.filter(([a, b]) => rs.has(key([p[0] + a, p[1] + b]))).length === 1) spots.push(p)
    }
    if (!spots.length) continue
    const cand = rest.concat([pick(spots, r)])
    if (isTree(cand) && !folds(normalize(cand), shape)) return cand
  }
  return null
}

export function makeNetsPuzzle(level: 1 | 2 | 3, seed: number): NetsPuzzle {
  const r = rng(seed)
  for (let attempt = 0; attempt < 50; attempt++) {
    const shape = pick(NET_SHAPES[level], r)
    const good = unfoldTree(shape, r)?.net
    if (!good) continue
    const opts: P2[][] = [toP(good)]
    const seen = new Set([canon(opts[0])])
    for (let k = 0; k < 40 && opts.length < 4; k++) {
      const w = wrongNet(opts[0], shape, r)
      if (w && !seen.has(canon(w))) { seen.add(canon(w)); opts.push(w) }
    }
    if (opts.length < 4) continue
    const order = shuffle([0, 1, 2, 3], r)
    return { level, shape, options: order.map(i => normalize(randomTransform(opts[i], r))), correct: order.indexOf(0) }
  }
  throw new Error(`no nets puzzle for level ${level} seed ${seed}`)
}
