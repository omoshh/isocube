import { describe, expect, it } from 'vitest'
import { lineCuts } from '../../src/core/cut'
import { arcPieces } from '../../src/core/arcs'
import { DrawingEditor } from '../../src/core/drawing'
import { segEnds, segKey } from '../../src/core/geometry'

const S = Math.sqrt(3) / 2
const L = (a: number, b: number, c: number, d: number) => segKey({ t: a, m: b }, { t: c, m: d })
const ed = (lines: string[]) => new DrawingEditor({ lines, arcs: [], fills: {} }, { t0: -9, t1: 9, v0: -9, v1: 9 }, () => {})

describe('lineCuts', () => {
  it('an X cuts at the middle', () => {
    const a = L(0, 0, 4, 0), b = L(1, -1, 3, 1), c = lineCuts(a, [a, b], [])
    expect(c).toHaveLength(1); expect(c[0]).toBeCloseTo(0.5, 9)
  })
  it('a T junction cuts', () => expect(lineCuts(L(0, 0, 4, 0), [L(2, 0, 2, 2)], [])[0]).toBeCloseTo(0.5, 9))
  it('no crossing gives none', () => expect(lineCuts(L(0, 0, 4, 0), [L(0, 1, 4, 1)], [])).toEqual([]))
  it('a circle of radius 1 is crossed twice, at the ellipse points', () => {
    const key = L(-3, 0, 3, 0), cuts = lineCuts(key, [], arcPieces({ plane: 'z', c: { t: 0, m: 0 }, r: 1, k0: 0, n: 8 }))
    expect(cuts).toHaveLength(2)
    // circle point (cosθ, sinθ) in (x,y): t = cosθ - sinθ, m = sinθ; m = 0 → sinθ=0, t = ±1 → s = (±1+3)/6
    expect(cuts[0]).toBeCloseTo(2 / 6, 6); expect(cuts[1]).toBeCloseTo(4 / 6, 6)
  })
})

describe('cutErase', () => {
  const a = L(0, 0, 4, 0), b = L(2, -2, 2, 2)
  it('removes only the part near the finger, one undo step', () => {
    const e = ed([a, b])
    e.cutErase(a, { u: 3 * S, v: 1.5 })
    expect(e.drawing.lines).toEqual([b, L(0, 0, 2, 0)].sort())
    e.undo(); expect(e.drawing.lines).toEqual([a, b].sort())
  })
  it('no cuts removes the line', () => {
    const e = ed([a]); e.cutErase(a, { u: S, v: 0.5 }); expect(e.drawing.lines).toEqual([])
  })
  it('drops a part shorter than 0.01', () => {
    const c = L(0, 0, 4, 0), e = ed([c, L(0.004, -1, 0.004, 1)])
    e.cutErase(c, { u: 3 * S, v: 1.5 })
    expect(e.drawing.lines).toEqual([L(0.004, -1, 0.004, 1)])
  })
  it('stores cut points with 6 decimals', () => {
    const c = L(0, 0, 3, 0), d = L(1, -1, 2, 2), e = ed([c, d])
    e.cutErase(c, { u: 0.1, v: 0.05 })
    const k = e.drawing.lines.find(x => x !== d)!
    expect(segEnds(k).every(p => Math.abs(p.t * 1e6 - Math.round(p.t * 1e6)) < 1e-6)).toBe(true)
  })
})
