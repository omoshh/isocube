import { describe, expect, it } from 'vitest'
import { makeSectionPuzzle } from '../../src/core/sectionPuzzle'
import { cut, planeThrough, similar, trueShape, validCut } from '../../src/core/sections'

const seeds = Array.from({ length: 500 }, (_, i) => i + 1)
const levels = [1, 2, 3] as const
const answerShape = (p: ReturnType<typeof makeSectionPuzzle>) => {
  const pl = planeThrough(...p.points)!
  return { pl, poly: cut(p.solid, pl) }
}

describe('makeSectionPuzzle', { timeout: 30000 }, () => {
  it('is deterministic', () => {
    for (const l of levels) expect(makeSectionPuzzle(l, 42)).toEqual(makeSectionPuzzle(l, 42))
  })
  it('answer cut is valid', () => {
    for (const l of levels) for (const s of seeds) {
      const p = makeSectionPuzzle(l, s); const { pl, poly } = answerShape(p)
      expect(validCut(p.solid, pl, poly)).toBe(true)
    }
  })
  it('options are pairwise distinct, 4 with angles', () => {
    for (const l of levels) for (const s of seeds) {
      const p = makeSectionPuzzle(l, s)
      expect(p.options.length).toBe(4)
      expect(p.optionAngles.length).toBe(4)
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) expect(similar(p.options[i], p.options[j])).toBe(false)
    }
  })
  it('exactly one option is correct', () => {
    for (const l of levels) for (const s of seeds) {
      const p = makeSectionPuzzle(l, s)
      const t = trueShape(answerShape(p).poly!)
      p.options.forEach((o, i) => expect(similar(o, t)).toBe(i === p.correct))
    }
  })
  it('level 2 usually has a distractor with the same corner count', () => {
    let ok = 0
    for (const s of seeds) {
      const p = makeSectionPuzzle(2, s)
      if (p.options.some((o, i) => i !== p.correct && o.length === p.options[p.correct].length)) ok++
    }
    expect(ok / seeds.length).toBeGreaterThanOrEqual(0.8)
  })
  it('uses the solids of the spec table', () => {
    const want = { 1: ['cube'], 2: ['cube', 'triPrism', 'hexPrism'], 3: ['sqPyramid', 'tetra', 'cuboid'] }
    for (const l of levels) {
      const used = new Set(seeds.map((s) => makeSectionPuzzle(l, s).solid.id))
      expect([...used].sort()).toEqual([...want[l]].sort())
    }
  })
})
