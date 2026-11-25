// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { segEnds } from '../../src/core/geometry'
import { computeEdges, HeightMap } from '../../src/core/shape'
import type { PuzzleFile } from '../../src/core/generator'

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
    expect(tall.textContent).toContain('Puzzle 1 of 50, 3×3 base')
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
    expect(labels).toEqual(['Line', 'Freehand', 'Fill', 'Erase', 'divider', 'Undo', 'Redo'])
    expect(root.querySelector('.tool-bar [aria-pressed="true"]')!.getAttribute('aria-label')).toBe('Line')
    expect([...root.querySelectorAll('.action-row button')].map(b => b.textContent)).toEqual(['Answer', 'Check'])
    const bar = root.querySelector('.top-bar')!
    expect(bar.firstElementChild!.getAttribute('aria-label')).toBe('Back')
    expect(bar.lastElementChild!.querySelector('summary')!.getAttribute('aria-label')).toBe('More')
    s.destroy()
  })
})

describe('level list', () => {
  it('classicListed', async () => {
    const { levels, storage } = await load()
    await storage.saveProgress({ solved: ['C-002', 'L1-001'], netsRight: 0, endlessSeeds: {} })
    const root = sized(412, 915)
    const s = await levels.mountLevels(root, file)
    const classic = root.querySelector('[data-set="classic"]')!
    expect(classic.textContent).toContain('Classic')
    expect(classic.textContent).toContain('1 / 49')
    expect(classic.querySelectorAll('a.num').length).toBe(49)
    expect(root.querySelector('[data-level="1"]')!.textContent).toContain('1 / 50')
    expect(root.querySelectorAll('a[href^="#/endless/"]').length).toBe(6)
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
    await vi.waitFor(() => expect(root.querySelectorAll('.tile').length).toBe(7))
    expect(root.children.length).toBe(1)
    navigate('/views/nope')
    await vi.waitFor(() => expect(root.textContent).toContain('Puzzle not found'))
    stop()
    expect(root.children.length).toBe(0)
  })
})
