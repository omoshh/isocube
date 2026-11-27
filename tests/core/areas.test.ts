import { describe, expect, it } from 'vitest'
import { areaAt, inPoly, polyArea, type P2 } from '../../src/core/areas'

const ring = (pts: P2[]): [P2, P2][] => pts.map((p, i) => [p, pts[(i + 1) % pts.length]])
const sq = (x: number, y: number, s: number): P2[] => [[x, y], [x + s, y], [x + s, y + s], [x, y + s]]

describe('areaAt', () => {
  it('unit square', () => {
    const a = areaAt(ring(sq(0, 0, 1)), [0.5, 0.5])!
    expect(polyArea(a)).toBeCloseTo(1, 9)
  })
  it('a diagonal splits the square; q below it gets the lower triangle', () => {
    const a = areaAt([...ring(sq(0, 0, 1)), [[0, 0], [1, 1]]], [0.7, 0.2])!
    expect(polyArea(a)).toBeCloseTo(0.5, 9)
    expect(inPoly(a, [0.7, 0.2])).toBe(true)
    expect(inPoly(a, [0.2, 0.7])).toBe(false)
  })
  it('lines that cross in the middle split the area too', () => {
    const a = areaAt([...ring(sq(0, 0, 2)), [[0, 0], [2, 2]], [[0, 2], [2, 0]]], [1, 0.3])!
    expect(polyArea(a)).toBeCloseTo(1, 9) // a quarter of the 2×2 square
  })
  it('an open U gives null', () => {
    expect(areaAt([[[0, 1], [0, 0]], [[0, 0], [1, 0]], [[1, 0], [1, 1]]], [0.5, 0.5])).toBeNull()
  })
  it('a dangling line inside does not change the area', () => {
    const a = areaAt([...ring(sq(0, 0, 1)), [[0, 0], [0.5, 0.5]]], [0.7, 0.3])!
    expect(Math.abs(polyArea(a))).toBeCloseTo(1, 9)
  })
  it('an island: between the squares → the outer square; inside the island → the island', () => {
    const segs = [...ring(sq(0, 0, 4)), ...ring(sq(1, 1, 1))]
    expect(polyArea(areaAt(segs, [3, 1.5])!)).toBeCloseTo(16, 9)
    expect(polyArea(areaAt(segs, [0.5, 1.5])!)).toBeCloseTo(16, 9) // the ray from here hits the island first
    expect(polyArea(areaAt(segs, [1.5, 1.5])!)).toBeCloseTo(1, 9)
  })
  it('outside everything gives null', () => {
    expect(areaAt(ring(sq(0, 0, 1)), [5, 5])).toBeNull()
    expect(areaAt(ring(sq(0, 0, 1)), [-1, 0.5])).toBeNull()
  })
  it('half disc from an arc polyline and its diameter', () => {
    const arc: P2[] = Array.from({ length: 13 }, (_, i) => [Math.cos(Math.PI * i / 12), Math.sin(Math.PI * i / 12)])
    const segs: [P2, P2][] = [...arc.slice(1).map((p, i): [P2, P2] => [arc[i], p]), [[-1, 0], [1, 0]]]
    expect(polyArea(areaAt(segs, [0, 0.5])!)).toBeCloseTo(Math.PI / 2, 1)
  })
})
