import { expect, test } from 'vitest'
import { proj, segKey, segEnds, linePieces, ptKey, toUV, samePt, segTriangles, triEdges, triAt, triNeighbours, gridSegKey } from '../../src/core/geometry'

test('proj matches the page', () => { expect(proj(1,0,0)).toEqual({t:1,m:0}); expect(proj(0,1,0)).toEqual({t:-1,m:1}); expect(proj(0,0,1)).toEqual({t:0,m:1}) })
test('segKey is undirected', () => { const p={t:0,m:0}, q={t:1,m:0}; expect(segKey(p,q)).toBe(segKey(q,p)) })
test('segKey rejects the same point twice', () => { expect(() => segKey({t:0,m:0},{t:0,m:0})).toThrow() })
test('linePieces splits at lattice points only', () => {
  expect(linePieces({ a: { t: 0, m: 0 }, b: { t: 0, m: 3 } })).toEqual(['0:0|0:1', '0:1|0:2', '0:2|0:3'])
  expect(linePieces({ a: { t: 0, m: 0 }, b: { t: 2, m: 2 } })).toEqual(['0:0|1:1', '1:1|2:2']) // round 3 diagonal keys
  expect(linePieces({ a: { t: 0, m: 0 }, b: { t: 3, m: 1 } })).toEqual(['0:0|3:1'])
  expect(linePieces({ a: { t: 0.5, m: 0 }, b: { t: 2.5, m: 0 } })).toEqual(['0.5:0|1:0', '1:0|2:0', '2.5:0|2:0'])
  expect(linePieces({ a: { t: 0, m: 0, rt: 1 }, b: { t: 0, m: 2, rt: 1 } })).toEqual(['0~1:0~0|0~1:2~0'])
  expect(linePieces({ a: { t: 1, m: 1 }, b: { t: 1, m: 1 } })).toEqual([])
})
test('irrational point keys round-trip and project exactly', () => {
  const p = { t: 0, m: 0, rt: 0, rm: 0.5 } // top circle r 1 at 45°
  expect(ptKey(p)).toBe('0~0:0~0.5')
  expect(segEnds(segKey(p, { t: 1, m: 0 }))).toEqual([{ t: 0, m: 0, rt: 0, rm: 0.5 }, { t: 1, m: 0 }])
  expect(toUV(p)[1]).toBeCloseTo(Math.SQRT2 / 2, 12)
  expect(samePt({ t: 1, m: 0, rt: 0, rm: 0 }, { t: 1, m: 0 })).toBe(true)
})
test('old unit and diagonal keys still parse', () => {
  expect(segEnds('0:0|1:1')).toEqual([{ t: 0, m: 0 }, { t: 1, m: 1 }])
})
test('segEnds round-trips', () => { const p={t:-1,m:2}, q={t:0,m:2}; expect(new Set(segEnds(segKey(p,q)).map(x=>x.t+':'+x.m))).toEqual(new Set(['-1:2','0:2'])) })
test('two triangles per segment', () => { const [a,b] = segTriangles(segKey({t:0,m:0},{t:1,m:0})); expect(a).not.toBe(b)
  expect(triEdges(a)).toContain(segKey({t:0,m:0},{t:1,m:0})); expect(triEdges(b)).toContain(segKey({t:0,m:0},{t:1,m:0})) })
test('every direction: both triangles contain the segment, 3 edges, 3 neighbours', () => {
  for (const [p,q] of [[{t:2,m:-1},{t:2,m:0}],[{t:2,m:-1},{t:3,m:-1}],[{t:2,m:-1},{t:3,m:-2}]]) {
    const s = segKey(p,q), ts = segTriangles(s)
    for (const t of ts) { expect(triEdges(t)).toHaveLength(3); expect(triEdges(t)).toContain(s); expect(triNeighbours(t)).toHaveLength(3) }
    expect(triNeighbours(ts[0])).toContain(ts[1])
  }
})
test('triAt finds the triangle containing a point', () => {
  const t = triAt(0.5 * Math.sqrt(3) / 2, 0.3)
  expect(triEdges(t)).toContain(segKey({t:0,m:0},{t:1,m:0}))
})
test('gridSegKey', () => {
  expect(gridSegKey({x:0,y:0},{x:1,y:0})).toBe(gridSegKey({x:1,y:0},{x:0,y:0}))
  expect(() => gridSegKey({x:0,y:0},{x:1,y:1})).toThrow()
})
