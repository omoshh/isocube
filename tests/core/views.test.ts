import { describe, expect, it } from 'vitest'
import { HeightMap } from '../../src/core/shape'
import { viewLabels, views, viewLines } from '../../src/core/views'
import puzzles from '../fixtures/reference-puzzles.json'

describe('views', () => {
  it('labelsMatchReference', () => {
    expect(puzzles.length).toBe(49)
    for (const p of puzzles) {
      const h = new HeightMap(p.plan[0].length, p.plan.length, p.plan.flat())
      expect(viewLabels(h, p.Z), JSON.stringify(p.plan)).toEqual({ top: p.top, front: p.front, side: p.side })
    }
  })
  it('oneCubeViewsAreSquares', () => {
    const v = views(new HeightMap(1, 1, [1]))
    for (const s of [v.top, v.front, v.side]) expect(s.size).toBe(4)
    expect(viewLines([[0]]).size).toBe(4)
  })
  it('viewLinesUseScreenCoordinates', () => {
    // 1 wide, 2 high: j=0 is the bottom cell (label 1), j=1 the top cell (label 2)
    expect([...viewLines([[1, 2]])].sort()).toEqual(
      ['0:0|0:1', '0:0|1:0', '0:1|0:2', '0:1|1:1', '0:2|1:2', '1:0|1:1', '1:1|1:2'])
  })
})
