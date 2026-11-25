import { rng } from './generator'
import { cut, markedPoints, planeThrough, similar, trueShape, validCut } from './sections'
import { makeSolid, type Solid, type SolidId, type V3 } from './solids'

export type SectionPuzzle = {
  level: 1 | 2 | 3; seed: number; solid: Solid; points: [V3, V3, V3]
  options: [number, number][][]; correct: number; optionAngles: number[]
}

const SOLIDS: Record<1 | 2 | 3, SolidId[]> = {
  1: ['cube'], 2: ['cube', 'triPrism', 'hexPrism'], 3: ['sqPyramid', 'tetra', 'cuboid'],
}

const MAX_PLANES = 3000
const APART = 0.1 // distractors must differ from every other option by more than this (relative)
const near = (a: Shape, b: Shape) => similar(a, b, APART)
type Shape = [number, number][]
type Cls = { shape: Shape; triples: [V3, V3, V3][] }

// Every valid cut of a solid, grouped into classes of similar shapes. Built once per solid and level.
const cache = new Map<string, { solid: Solid; classes: Cls[] }>()
function classesOf(id: SolidId, level: 1 | 2 | 3) {
  const key = `${id}:${level}`
  let hit = cache.get(key)
  if (hit) return hit
  const solid = makeSolid(id), pts = markedPoints(solid, level), classes: Cls[] = [], seen = new Set<string>()
  const planes: [V3, V3, V3][] = []
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) for (let k = j + 1; k < pts.length; k++) {
    const pl = planeThrough(pts[i], pts[j], pts[k])
    if (!pl) continue
    const sg = Math.sign(pl.n.find((x) => Math.abs(x) > 1e-9)!) // same plane from other triples: skip
    const key = [...pl.n, pl.d].map((x) => Math.round(x * sg * 1e6) + 0).join()
    if (seen.has(key)) continue
    seen.add(key)
    planes.push([pts[i], pts[j], pts[k]])
  }
  // shortcut: big solids (hex prism, ~20k planes) classify a fixed random 3000, rare shapes may be missed; raise MAX_PLANES if shapes feel repetitive
  const sr = rng(1)
  for (let i = planes.length - 1; i > 0; i--) { const j = Math.floor(sr() * (i + 1)); [planes[i], planes[j]] = [planes[j], planes[i]] }
  for (const t of planes.slice(0, MAX_PLANES)) {
    const pl = planeThrough(...t)!
    const poly = cut(solid, pl)
    if (!validCut(solid, pl, poly)) continue
    const shape = trueShape(poly!)
    const c = classes.find((x) => x.shape.length === shape.length && similar(x.shape, shape))
    if (c) c.triples.push(t); else classes.push({ shape, triples: [t] })
  }
  hit = { solid, classes }
  cache.set(key, hit)
  return hit
}

function normalize(s: Shape): Shape {
  const n = s.length
  const cx = s.reduce((t, p) => t + p[0], 0) / n, cy = s.reduce((t, p) => t + p[1], 0) / n
  const longest = Math.max(...s.map((p, i) => Math.hypot(s[(i + 1) % n][0] - p[0], s[(i + 1) % n][1] - p[1])))
  return s.map((p) => [(p[0] - cx) / longest, (p[1] - cy) / longest])
}

export function makeSectionPuzzle(level: 1 | 2 | 3, seed: number): SectionPuzzle {
  const r = rng(seed)
  const ids = SOLIDS[level], first = Math.floor(r() * ids.length)
  const pickOf = <T>(a: T[]) => a[Math.floor(r() * a.length)]
  // Try the picked solid first, then the others, so a seed always yields a puzzle.
  for (let s = 0; s < ids.length; s++) {
    const { solid, classes } = classesOf(ids[(first + s) % ids.length], level)
    if (classes.length < 4) continue
    const ans = pickOf(classes)
    const others = classes.filter((c) => c !== ans && !near(c.shape, ans.shape))
    const dis: Cls[] = []
    const take = (pool: Cls[]) => {
      const ok = pool.filter((c) => !dis.includes(c) && dis.every((d) => !near(d.shape, c.shape)))
      if (ok.length) dis.push(pickOf(ok))
    }
    if (level >= 2) take(others.filter((c) => c.shape.length === ans.shape.length))
    while (dis.length < 3) { const n = dis.length; take(others); if (dis.length === n) break }
    if (dis.length < 3) continue
    const order = [ans, ...dis].map((c, i) => ({ c, i, k: r() })).sort((a, b) => a.k - b.k)
    return {
      level, seed, solid, points: pickOf(ans.triples),
      options: order.map(({ c }) => normalize(c.shape)),
      correct: order.findIndex((o) => o.i === 0),
      optionAngles: order.map(() => r() * 2 * Math.PI),
    }
  }
  throw new Error(`no section puzzle for level ${level}`)
}
