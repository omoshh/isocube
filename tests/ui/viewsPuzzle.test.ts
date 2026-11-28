// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { segEnds } from '../../src/core/geometry'
import { computeEdges, HeightMap } from '../../src/core/shape'
import type { PuzzleFile } from '../../src/core/generator'
import { rotate180 } from '../../src/core/visibility'

const file: PuzzleFile = JSON.parse(readFileSync('public/puzzles.json', 'utf8'))
const load = async () => ({
  puzzle: await import('../../src/ui/screens/viewsPuzzle'),
  levels: await import('../../src/ui/screens/levels'),
  storage: await import('../../src/ui/storage'),
})
const sized = (w: number, h: number) => {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: w, height: h, right: w, bottom: h, x: 0, y: 0, toJSON() {} })
  document.body.appendChild(el)
  return el
}
const button = (root: Element, text: string) =>
  [...root.querySelectorAll('button')].find(b => b.textContent?.trim() === text)!

// idb-keyval keeps its store across resetModules, so stored progress can carry over between tests: use distinct ids
beforeEach(() => { vi.resetModules(); indexedDB = new IDBFactory(); document.body.replaceChildren(); sessionStorage.clear() })

describe('views puzzle screen', () => {
  it('turn button shows only with Answer and turns the answer to the back', async () => {
    const { puzzle } = await load()
    const e = file.puzzles.find(p => p.id === 'L1-003')!, hm = new HeightMap(e.cols, e.rows, e.h)
    const root = sized(412, 915)
    const s = await puzzle.mountViewsPuzzle(root, file, 'L1-003')
    const turn = root.querySelector<HTMLButtonElement>('.turn-btn')!
    const ans = () => root.querySelectorAll('.g-ans line').length
    expect(turn.hidden).toBe(true)
    button(root, 'Answer').click()
    expect(turn.hidden).toBe(false)
    expect(ans()).toBe(computeEdges(hm).shape.size)
    turn.click()
    expect(turn.getAttribute('aria-pressed')).toBe('true')
    expect(ans()).toBe(computeEdges(rotate180(hm)).shape.size)
    button(root, 'Answer').click() // off: hidden and back to front
    expect(turn.hidden).toBe(true); expect(turn.getAttribute('aria-pressed')).toBe('false')
    button(root, 'Answer').click()
    expect(ans()).toBe(computeEdges(hm).shape.size)
    s.destroy()
  })
  it('the small Fit button says what it does', async () => {
    const { puzzle } = await load()
    const root = sized(412, 915)
    const s = await puzzle.mountViewsPuzzle(root, file, 'L1-009')
    const fit = root.querySelector('.vp-zoom .fit')!
    expect(fit.textContent).toBe('Fit')
    expect(fit.getAttribute('aria-label')).toBe('Show the whole grid')
    expect(fit.getAttribute('title')).toBe('Show the whole grid')
    s.destroy()
  })
  it('Check resets the turn to front', async () => {
    const { puzzle } = await load()
    const root = sized(412, 915)
    const s = await puzzle.mountViewsPuzzle(root, file, 'L1-008')
    const turn = root.querySelector<HTMLButtonElement>('.turn-btn')!
    button(root, 'Answer').click(); turn.click()
    button(root, 'Check').click()
    expect(turn.hidden).toBe(true); expect(turn.getAttribute('aria-pressed')).toBe('false')
    s.destroy()
  })

  it('correctDrawingSolves', async () => {
    const { puzzle, storage } = await load()
    const e = file.puzzles.find(p => p.id === 'L1-001')!
    const root = sized(412, 915)
    const s = await puzzle.mountViewsPuzzle(root, file, 'L1-001')
    const shape = computeEdges(new HeightMap(e.cols, e.rows, e.h)).shape
    s.editor.addLines([...shape].map(k => { const [a, b] = segEnds(k); return { a, b } }))
    button(root, 'Check').click()
    await vi.waitFor(async () => expect((await storage.loadProgress()).solved).toEqual(['L1-001']))
    expect(root.textContent).toContain('Solved')
    expect(button(root, 'Next puzzle')).toBeTruthy()
    button(root, 'Next puzzle').click()
    expect(location.hash).toBe('#/views/L1-002')
    expect(root.textContent).toContain(`Puzzle 1 of 50, ${e.cols}×${e.rows}×2`)
    s.destroy()
    expect(root.children.length).toBe(0)
  })

  it('wrongDrawingShowsCounts', async () => {
    const { puzzle, storage } = await load()
    const root = sized(412, 915)
    const s = await puzzle.mountViewsPuzzle(root, file, 'L1-002')
    s.editor.addLines([{ a: { t: 20, m: 0 }, b: { t: 20, m: 1 } }])
    button(root, 'Check').click()
    expect(root.textContent).toMatch(/\d+ missing, 1 mistake/)
    expect((await storage.loadProgress()).solved).not.toContain('L1-002')
    s.destroy()
  })

  it('an arc in a Views drawing counts as a mistake', async () => {
    const { puzzle } = await load()
    const e = file.puzzles.find(p => p.id === 'L1-005')!
    const root = sized(412, 915)
    const s = await puzzle.mountViewsPuzzle(root, file, 'L1-005')
    s.editor.addLines([...computeEdges(new HeightMap(e.cols, e.rows, e.h)).shape].map(k => { const [a, b] = segEnds(k); return { a, b } }))
    s.editor.addArc({ plane: 'z', c: { t: 20, m: 0 }, r: 1, k0: 0, n: 1 })
    button(root, 'Check').click()
    expect(root.querySelector('.vp-counts-text')!.textContent).toBe('1 mistake')
    s.destroy()
  })

  it('Views has the arc tool', async () => {
    const { puzzle } = await load()
    const root = sized(412, 915)
    const s = await puzzle.mountViewsPuzzle(root, file, 'L1-006')
    expect(root.querySelector('button[aria-label="Arc"]')).not.toBeNull()
    s.destroy()
  })

  it('answerClearsStaleCounts', async () => {
    const { puzzle } = await load()
    const root = sized(412, 915)
    const s = await puzzle.mountViewsPuzzle(root, file, 'L1-003')
    button(root, 'Check').click()
    const counts = root.querySelector('.vp-counts-text')!
    expect(counts.textContent).toMatch(/missing/)
    button(root, 'Answer').click()
    expect(counts.textContent).toBe('')
    s.destroy()
  })

  it('restartClearsRevealedAndReload', async () => {
    let { puzzle, storage } = await load()
    const e = file.puzzles.find(p => p.id === 'L1-004')!
    const shape = computeEdges(new HeightMap(e.cols, e.rows, e.h)).shape
    const solveRight = async () => {
      const root = sized(412, 915)
      const s = await puzzle.mountViewsPuzzle(root, file, 'L1-004')
      s.editor.addLines([...shape].map(k => { const [a, b] = segEnds(k); return { a, b } }))
      button(root, 'Check').click()
      await vi.waitFor(() => expect(root.textContent).toContain('Solved'))
      s.destroy()
    }
    const root = sized(412, 915)
    const s = await puzzle.mountViewsPuzzle(root, file, 'L1-004')
    button(root, 'Answer').click()
    for (let i = 0; i < 3; i++) button(root, 'Check').click() // empty drawing: three failures, lives restart
    expect(root.textContent).toContain('Out of lives')
    s.destroy()
    vi.resetModules(); ;({ puzzle, storage } = await load()) // reload: the restart was saved
    await solveRight() // a full restart clears revealed, so this counts
    await vi.waitFor(async () => expect((await storage.loadProgress()).solved).toContain('L1-004'))
  })

  it('drawingRestoredAfterReload', async () => {
    let { puzzle, storage } = await load()
    let root = sized(412, 915)
    let s = await puzzle.mountViewsPuzzle(root, file, 'L2-003')
    s.editor.addLines([{ a: { t: 0, m: 0 }, b: { t: 2, m: 0 } }])
    const drawn = s.editor.drawing
    s.destroy()
    await storage.flush()
    vi.resetModules();
    ({ puzzle, storage } = await load())
    root = sized(412, 915)
    s = await puzzle.mountViewsPuzzle(root, file, 'L2-003')
    expect(s.editor.drawing).toEqual(drawn)
    expect(drawn.lines.length).toBe(2)
    s.destroy()
  })

  it('panelBesideWhenWide', async () => {
    const { puzzle } = await load()
    const wide = sized(1200, 700)
    const a = await puzzle.mountViewsPuzzle(wide, file, 'L1-001')
    expect(wide.querySelector('.vp')!.classList.contains('vp--side')).toBe(true)
    const tall = sized(412, 915)
    const b = await puzzle.mountViewsPuzzle(tall, file, 'L1-001')
    expect(tall.querySelector('.vp')!.classList.contains('vp--side')).toBe(false)
    expect(tall.querySelectorAll('.view').length).toBe(4)
    expect(tall.textContent).toContain('Puzzle 1 of 50, 3×3×2')
    a.destroy(); b.destroy()
  })
})

describe('puzzle layout', () => {
  it('fourViewCardsToolBarAndActions', async () => {
    const { puzzle } = await load()
    const root = sized(412, 915)
    const s = await puzzle.mountViewsPuzzle(root, file, 'L1-001')
    expect([...root.querySelectorAll('.views > .view figcaption')].map(c => c.textContent)).toEqual(['Key', 'Top', 'Side', 'Front'])
    const toggle = button(root, 'Hide views')
    toggle.click()
    expect(root.querySelector('.views-panel')!.classList.contains('folded')).toBe(true)
    expect(toggle.textContent).toBe('Show views')
    const labels = [...root.querySelectorAll('.tool-bar > *')].map(b => b.getAttribute('aria-label') ?? b.className)
    expect(labels).toEqual(['Line', 'Arc', 'Freehand', 'Fill', 'Erase', 'divider', 'Undo', 'Redo'])
    expect(root.querySelector('.tool-bar [aria-pressed="true"]')!.getAttribute('aria-label')).toBe('Line')
    expect([...root.querySelectorAll('.action-row button')].map(b => b.textContent)).toEqual(['Answer', 'Check'])
    const bar = root.querySelector('.top-bar')!
    expect(bar.firstElementChild!.getAttribute('aria-label')).toBe('Back')
    expect(bar.lastElementChild!.querySelector('summary')!.getAttribute('aria-label')).toBe('More')
    s.destroy()
  })
})

describe('level list', () => {
  it('levelsListed (no Classic tile)', async () => {
    const { levels, storage } = await load()
    await storage.saveProgress({ solved: ['L1-001'], netsRight: 0, endlessSeeds: {} })
    const root = sized(412, 915)
    const s = await levels.mountLevels(root, file)
    expect(root.querySelector('[data-set="classic"]')).toBeNull()
    expect(root.querySelector('[data-level="1"]')!.textContent).toContain('1 / 50')
    expect(root.querySelectorAll('a[href^="#/endless/"]').length).toBe(1) // round 4: one Endless tile with a size picker
    s.destroy()
  })
})

describe('router', () => {
  it('mounts the matching screen and destroys the previous one', async () => {
    const { startRouter, navigate } = await import('../../src/ui/router')
    const root = sized(412, 915)
    navigate('/nowhere')
    const stop = startRouter(root, file)
    await vi.waitFor(() => expect(root.textContent).toContain('not built yet'))
    navigate('/levels/views')
    await vi.waitFor(() => expect(root.querySelectorAll('.tile').length).toBe(8)) // 6 levels, Slopes and Endless
    expect(root.children.length).toBe(1)
    navigate('/views/nope')
    await vi.waitFor(() => expect(root.textContent).toContain('Puzzle not found'))
    stop()
    expect(root.children.length).toBe(0)
  })
})

describe('Slopes set (round 4)', () => {
  it('levels: a Slopes row after level 2 with 25 numbers', async () => {
    const { levels } = await load()
    const root = sized(412, 915)
    await levels.mountLevels(root, file)
    const tiles = [...root.querySelectorAll('.tile')]
    const i = tiles.findIndex(t => t.getAttribute('data-set') === 'slopes')
    expect(tiles[i - 1].getAttribute('data-level')).toBe('2')
    expect(tiles[i].querySelectorAll('.nums a')).toHaveLength(25)
    expect(tiles[i].textContent).toContain('Slopes')
    expect(tiles[i].querySelector('.btn')).toBeNull() // no Endless on this row yet
  })
  it('title is Slopes N by set level', async () => {
    const { puzzle } = await load()
    const sl = file.puzzles.find(p => p.id === 'SL-001')!
    const big = { ...file, puzzles: [...file.puzzles, { ...sl, id: 'SL3-001', level: 3 }] }
    const root = sized(412, 915)
    const s = await puzzle.mountViewsPuzzle(root, big, 'SL3-001')
    expect(root.textContent).toContain('Slopes 3')
    s.destroy()
    const r1 = sized(412, 915), s1 = await puzzle.mountViewsPuzzle(r1, file, 'SL-001')
    expect(r1.textContent).toContain('Slopes 1')
    s1.destroy()
  })
  it('SL-001: title, a slanted view line, and the drawn answer solves it', async () => {
    const { puzzle, storage } = await load()
    const { entryShape } = await import('../../src/core/generator')
    const { shapeEdges } = await import('../../src/core/sketch')
    const root = sized(412, 915)
    const s = await puzzle.mountViewsPuzzle(root, file, 'SL-001')
    expect(root.textContent).toContain('Slopes')
    const slanted = [...root.querySelectorAll('.views .vline')].some(l => l.getAttribute('x1') !== l.getAttribute('x2') && l.getAttribute('y1') !== l.getAttribute('y2'))
    expect(slanted).toBe(true)
    const answer = shapeEdges(entryShape(file.puzzles.find(p => p.id === 'SL-001')!)).shape
    s.editor.addLines([...answer].map(k => { const [a, b] = segEnds(k); return { a, b } }))
    button(root, 'Check').click()
    await vi.waitFor(async () => expect((await storage.loadProgress()).solved).toContain('SL-001'))
    s.destroy()
  })
})
