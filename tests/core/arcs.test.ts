import { describe, expect, it } from 'vitest'
import { arcMid, arcPieces, arcPolyline, arcSnapPoints, arcsThrough, eighthPoint, isArcKey, pieceEnds } from '../../src/core/arcs'
import { ptKey, toUV } from '../../src/core/geometry'

describe('arcs', () => {
  it('eighth points are exact', () => {
    const c = { t: 0, m: 0 }
    expect(ptKey(eighthPoint('z', c, 1, 0))).toBe('1:0')
    expect(ptKey(eighthPoint('z', c, 1, 1))).toBe('0~0:0~0.5')
    expect(ptKey(eighthPoint('z', c, 1, 7))).toBe('0~1:0~-0.5')
    expect(ptKey(eighthPoint('y', c, 0.5, 2))).toBe('0:0.5')
    expect(ptKey(eighthPoint('x', c, 1, 0))).toBe('-1:1') // side plane starts along Y
  })
  it('the 45° point of the top circle lies on the true circle', () => {
    const [u, v] = toUV(eighthPoint('z', { t: 0, m: 0 }, 1, 1)) // x = y = √2/2
    const h = Math.SQRT2 / 2
    expect(u).toBeCloseTo(0, 12)
    expect(v).toBeCloseTo(h, 12) // t = x − y = 0, m = y = √2/2
  })
  it('a quarter of the top circle is the first candidate', () => {
    const as = arcsThrough({ t: 1, m: 0 }, { t: -1, m: 1 })
    // two top circles r 1 pass through both points (centres 0:0 and 0:1); the lower quarter ranks first
    expect(as.map(a => `${a.plane} ${a.c.t}:${a.c.m} ${a.k0}+${a.n}`)).toEqual(['z 0:1 4+2', 'z 0:0 0+2', 'z 0:0 2+6', 'z 0:1 6+6'])
  })
  it('no arc joins points too far apart', () => expect(arcsThrough({ t: 0, m: 0 }, { t: 5, m: 0 })).toEqual([]))
  it('pieces, ends and snap points', () => {
    const ps = arcPieces({ plane: 'z', c: { t: 0, m: 0 }, r: 1, k0: 7, n: 2 })
    expect(ps).toEqual(['Az|0:0|1|7', 'Az|0:0|1|0'])
    expect(ps.every(isArcKey)).toBe(true)
    expect(isArcKey('0:0|1:0')).toBe(false)
    expect(pieceEnds(ps[0]).map(ptKey)).toEqual(['0~1:0~-0.5', '1:0'])
    expect(arcSnapPoints(ps).map(ptKey).sort()).toEqual(['0~0:0~0.5', '0~1:0~-0.5', '1:0'].sort())
    const pl = arcPolyline(ps[1])
    expect(pl).toHaveLength(7)
    expect(pl[0]).toEqual(toUV({ t: 1, m: 0 }))
  })
  it('a full circle has 8 pieces; the arc midpoint is on the arc', () => {
    expect(arcPieces({ plane: 'y', c: { t: 0, m: 0.5 }, r: 0.5, k0: 3, n: 8 })).toHaveLength(8)
    const mid = arcMid({ plane: 'z', c: { t: 0, m: 0 }, r: 1, k0: 0, n: 2 })
    const p = toUV(eighthPoint('z', { t: 0, m: 0 }, 1, 1))
    expect(mid[0]).toBeCloseTo(p[0], 12); expect(mid[1]).toBeCloseTo(p[1], 12)
  })
})
