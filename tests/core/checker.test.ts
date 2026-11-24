import { describe, expect, it } from 'vitest'
import { HeightMap, computeEdges } from '../../src/core/shape'
import { views } from '../../src/core/views'
import { segKey } from '../../src/core/geometry'
import { checkDrawing, checkViews } from '../../src/core/checker'

const h = new HeightMap(2, 2, [1, 2, 1, 1])
const e = computeEdges(h)
describe('checker', () => {
  it('ownEdgesCorrect', () => {
    const r = checkDrawing(new Set(e.shape), e)
    expect(r.correct).toBe(true)
  })
  it('removedEdgeIsOneMissing', () => {
    const d = new Set(e.shape); const k = [...d][0]; d.delete(k)
    const r = checkDrawing(d, e)
    expect([...r.missing]).toEqual([k]); expect(r.mistakes.size).toBe(0); expect(r.correct).toBe(false)
  })
  it('lineInEmptySpaceIsOneMistake', () => {
    const k = segKey({ t: 40, m: 40 }, { t: 40, m: 41 })
    const r = checkDrawing(new Set([...e.shape, k]), e)
    expect([...r.mistakes]).toEqual([k]); expect(r.correct).toBe(false)
  })
  it('seamsAreNotMistakes', () => {
    expect(checkDrawing(new Set([...e.shape, ...e.seams]), e).correct).toBe(true)
  })
  it('viewsExact', () => {
    const v = views(h)
    expect(checkViews(v, v).correct).toBe(true)
    const r = checkViews({ ...v, front: new Set([...v.front, '90:90|90:91']) }, v)
    expect(r.front.mistakes.size).toBe(1); expect(r.correct).toBe(false)
  })
})
