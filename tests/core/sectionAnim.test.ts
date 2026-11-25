import { describe, expect, it } from 'vitest'
import { SectionAnimation } from '../../src/core/sectionAnim'
import { makeSectionPuzzle } from '../../src/core/sectionPuzzle'
import { cut, planeThrough, similar, trueShape } from '../../src/core/sections'
import type { V3 } from '../../src/core/solids'

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a: V3) => Math.hypot(...a)
const sides = (p: V3[]) => p.map((a, i) => len(sub(p[(i + 1) % p.length], a)))
const newell = (p: V3[]): V3 => p.reduce<V3>((n, a, i) => { const c = cross(a, p[(i + 1) % p.length]); return [n[0] + c[0], n[1] + c[1], n[2] + c[2]] }, [0, 0, 0])

const p = makeSectionPuzzle(2, 7)
const pl = planeThrough(...p.points)!
const real = cut(p.solid, pl)!

describe('SectionAnimation', () => {
  const a = new SectionAnimation(p)
  it('startsOutside', () => {
    const s = a.at(0)
    expect(s.cutVisible).toBe(false)
    expect(cut(p.solid, { n: pl.n, d: pl.d + s.planeOffset })).toBeNull()
  })
  it('cutAtMiddle', () => {
    const s = a.at(0.5)
    expect(s.cutVisible).toBe(true)
    expect(s.planeOffset).toBe(0)
    s.cutPoly3d.forEach((q, i) => q.forEach((x, k) => expect(x).toBeCloseTo(real[i][k], 9)))
  })
  it('facesViewerAtEnd', () => {
    const e = a.at(1).cutPoly3d
    const c = cross(newell(e), [1, 1, -1])
    expect(len(c) / len(newell(e))).toBeLessThan(1e-9)
    expect(similar(trueShape(e), trueShape(real))).toBe(true)
  })
  it('clamps t', () => {
    expect(a.at(-3)).toEqual(a.at(0))
    expect(a.at(9)).toEqual(a.at(1))
  })
  it('keeps shape while turning', () => {
    sides(a.at(0.8).cutPoly3d).forEach((x, i) => expect(Math.abs(x - sides(real)[i])).toBeLessThan(1e-9))
  })
})
