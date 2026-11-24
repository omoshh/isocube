// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { gridSegKey } from '../../src/core/geometry'
import type { PuzzleFile } from '../../src/core/generator'
import { HeightMap } from '../../src/core/shape'
import { viewLabels, viewLines, views } from '../../src/core/views'

const file: PuzzleFile = JSON.parse(readFileSync('public/puzzles.json', 'utf8'))
const load = async () => ({
  reverse: await import('../../src/ui/screens/reversePuzzle'),
  levels: await import('../../src/ui/screens/levels'),
  storage: await import('../../src/ui/storage'),
})
const sized = () => {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 412, height: 915, right: 412, bottom: 915, x: 0, y: 0, toJSON() {} })
  document.body.appendChild(el)
  return el
}
const button = (root: Element, text: string) => [...root.querySelectorAll('button')].find(b => b.textContent?.trim() === text)!
const answerOf = (f: PuzzleFile, id: string) => {
  const e = f.puzzles.find(p => p.id === id)!, l = viewLabels(new HeightMap(e.cols, e.rows, e.h), e.maxH)
  return { top: viewLines(l.top), front: viewLines(l.front), side: viewLines(l.side) }
}
type Scr = Awaited<ReturnType<Awaited<ReturnType<typeof load>>['reverse']['mountReversePuzzle']>>
const drawAll = (s: Scr, a: ReturnType<typeof answerOf>) => (['top', 'front', 'side'] as const).forEach(v => s.setLines(v, a[v]))

// idb-keyval keeps its store across resetModules, so progress can carry over between tests: use distinct ids
beforeEach(() => { vi.resetModules(); indexedDB = new IDBFactory(); document.body.replaceChildren(); sessionStorage.clear() })

describe('reverse puzzle screen', () => {
  it('exactViewsSolve', async () => {
    const { reverse, storage } = await load()
    const root = sized()
    const s = await reverse.mountReversePuzzle(root, file, 'L1-001')
    expect(root.textContent).toContain('Reverse: level 1')
    expect(root.querySelectorAll('.rv-view').length).toBe(3)
    drawAll(s, answerOf(file, 'L1-001'))
    button(root, 'Check').click()
    await vi.waitFor(async () => expect((await storage.loadProgress()).solved).toEqual(['R-L1-001']))
    expect(root.textContent).toContain('Solved')
    button(root, 'Next puzzle').click()
    expect(location.hash).toBe('#/reverse/L1-002')
    s.destroy()
    expect(root.children.length).toBe(0)
  })

  it('viewRestoredFromSession', async () => {
    const { reverse } = await load()
    const v = { panU: 1.5, panV: -2, scale: 33 }
    sessionStorage.setItem('view/reverse/R-L1-004/top', JSON.stringify(v))
    const root = sized()
    const s = await reverse.mountReversePuzzle(root, file, 'L1-004')
    const stored = JSON.parse(sessionStorage.getItem('view/reverse/R-L1-004/top')!)
    expect(stored).toEqual(v)
    button(root, 'Fit').click() // FIT resets and stores
    expect(JSON.parse(sessionStorage.getItem('view/reverse/R-L1-004/top')!)).not.toEqual(v)
    s.destroy()
  })

  it('extraLineFails', async () => {
    const { reverse, storage } = await load()
    const root = sized()
    const s = await reverse.mountReversePuzzle(root, file, 'L1-002')
    const a = answerOf(file, 'L1-002')
    const extra = [0, 1, 2].flatMap(x => [0, 1, 2, 3].map(y => gridSegKey({ x, y }, { x: x + 1, y }))).find(k => !a.top.has(k))!
    drawAll(s, a)
    s.setLines('top', new Set([...a.top, extra]))
    button(root, 'Check').click()
    const count = (v: string) => root.querySelector(`.rv-view[data-view="${v}"] .rv-count`)!.textContent
    expect(count('top')).toBe('1 mistake')
    expect(count('front')).toBe('Solved')
    expect(count('side')).toBe('Solved')
    expect((await storage.loadProgress()).solved).not.toContain('R-L1-002')
    s.setLines('top', a.top) // an edit clears the marks
    expect(count('top')).toBe('')
    s.destroy()
  })

  it('restoredAfterReload', async () => {
    let { reverse, storage } = await load()
    let root = sized()
    let s = await reverse.mountReversePuzzle(root, file, 'L2-003')
    const k = gridSegKey({ x: 0, y: 0 }, { x: 1, y: 0 })
    s.setLines('front', new Set([k]))
    s.destroy()
    await storage.flush()
    expect(await storage.loadDrawing('reverse/L2-003')).toEqual({ lines: ['front:' + k], fills: {} })
    vi.resetModules();
    ({ reverse, storage } = await load())
    root = sized()
    s = await reverse.mountReversePuzzle(root, file, 'L2-003')
    expect([...s.drawn.front]).toEqual([k])
    expect(s.drawn.top.size + s.drawn.side.size).toBe(0)
    s.destroy()
  })

  it('lowShapeUsesLevelHeight', async () => {
    const { reverse, storage } = await load()
    // max height 1 in a level with maxH 3: the FRONT/SIDE grids are 3 high and the shape sits on the bottom row
    const low: PuzzleFile = { version: 1, puzzles: [{ id: 'L2-001', set: 'level', level: 2, cols: 3, rows: 4, maxH: 3, h: [1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1] }] }
    const root = sized()
    const s = await reverse.mountReversePuzzle(root, low, 'L2-001')
    const shifted = views(new HeightMap(3, 4, low.puzzles[0].h))
    drawAll(s, { ...answerOf(low, 'L2-001'), front: shifted.front })
    button(root, 'Check').click()
    expect(root.querySelector('.rv-view[data-view="front"] .rv-count')!.textContent).toMatch(/missing/)
    drawAll(s, answerOf(low, 'L2-001'))
    button(root, 'Check').click()
    await vi.waitFor(async () => expect((await storage.loadProgress()).solved).toContain('R-L2-001'))
    s.destroy()
  })

  it('levelListLinksToReverse', async () => {
    const { levels, storage } = await load()
    await storage.updateProgress(p => ({ ...p, solved: ['R-RL1-001', 'RL1-002', 'R-L1-003'] }))
    const root = sized()
    const s = await levels.mountLevels(root, file, 'reverse')
    const t = root.querySelector('[data-level="1"]')!
    expect(t.querySelector('.num')!.getAttribute('href')).toBe('#/reverse/RL1-001')
    expect(t.querySelector('.tile-count')!.textContent).toBe('1 / 50')
    expect(t.querySelector('a.btn')!.getAttribute('href')).toBe('#/reverse/E1-new')
    s.destroy()
  })
})
