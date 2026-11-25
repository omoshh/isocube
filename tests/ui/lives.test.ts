// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { gridSegKey } from '../../src/core/geometry'
import type { PuzzleFile } from '../../src/core/generator'
import { makeNetsPuzzle } from '../../src/core/nets'
import { HeightMap } from '../../src/core/shape'
import { viewLabels, viewLines } from '../../src/core/views'

const file: PuzzleFile = JSON.parse(readFileSync('public/puzzles.json', 'utf8'))
const load = async () => ({
  views: await import('../../src/ui/screens/viewsPuzzle'),
  reverse: await import('../../src/ui/screens/reversePuzzle'),
  nets: await import('../../src/ui/screens/nets'),
  settings: await import('../../src/ui/screens/settings'),
  storage: await import('../../src/ui/storage'),
})
const sized = () => {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 412, height: 915, right: 412, bottom: 915, x: 0, y: 0, toJSON() {} })
  document.body.appendChild(el)
  return el
}
const button = (root: Element, text: string) => [...root.querySelectorAll('button')].find(b => b.textContent?.trim() === text)!
const marks = (root: Element) => root.querySelector('[aria-label^="Lives"]')
const opts = (root: Element) => [...root.querySelectorAll<HTMLElement>('.netopt')]
const tick = () => new Promise(r => setTimeout(r, 20))
const wrongViews = (s: { editor: { addLines(l: { a: { t: number; m: number }; b: { t: number; m: number } }[]): void } }) =>
  s.editor.addLines([{ a: { t: 20, m: 0 }, b: { t: 20, m: 1 } }])

beforeEach(async () => { await (await import('idb-keyval')).clear(); vi.resetModules(); indexedDB = new IDBFactory(); document.body.replaceChildren(); sessionStorage.clear(); localStorage.clear() })

describe('lives', () => {
  it('shows 3 marks and loses one per failed check; reload keeps them', async () => {
    const { views } = await load()
    const root = sized()
    const s = await views.mountViewsPuzzle(root, file, 'L1-003')
    expect(marks(root)!.getAttribute('aria-label')).toBe('Lives: 3 of 3')
    wrongViews(s)
    button(root, 'Check').click()
    await vi.waitFor(() => expect(marks(root)!.getAttribute('aria-label')).toBe('Lives: 2 of 3'))
    s.destroy()
    const root2 = sized()
    await views.mountViewsPuzzle(root2, file, 'L1-003')
    expect(marks(root2)!.getAttribute('aria-label')).toBe('Lives: 2 of 3')
  })

  it('reloadKeepsLives from saved state', async () => {
    const { views, storage } = await load()
    await storage.saveLives('views/L1-004', { left: 1, revealed: false })
    const root = sized()
    await views.mountViewsPuzzle(root, file, 'L1-004')
    expect(marks(root)!.getAttribute('aria-label')).toBe('Lives: 1 of 3')
    expect(root.querySelectorAll('.life:not([data-lost])').length).toBe(1)
  })

  it('third failed check clears the drawing without an undo step and refills', async () => {
    const { views, storage } = await load()
    await storage.saveLives('views/L1-005', { left: 1, revealed: false })
    const root = sized()
    const s = await views.mountViewsPuzzle(root, file, 'L1-005')
    wrongViews(s)
    button(root, 'Check').click()
    await vi.waitFor(() => expect(marks(root)!.getAttribute('aria-label')).toBe('Lives: 3 of 3'))
    expect(s.editor.drawing.lines).toEqual([])
    expect(s.editor.canUndo).toBe(false)
    expect(root.textContent).toContain('Out of lives — the puzzle starts again')
  })

  it('answer then correct check does not solve', async () => {
    const { views, storage } = await load()
    const root = sized()
    const s = await views.mountViewsPuzzle(root, file, 'L1-006')
    button(root, 'Answer').click()
    expect(await storage.loadLives('views/L1-006')).toEqual({ left: 3, revealed: true })
    const { computeEdges, HeightMap } = await import('../../src/core/shape')
    const { segEnds } = await import('../../src/core/geometry')
    const e = file.puzzles.find(p => p.id === 'L1-006')!
    s.editor.addLines([...computeEdges(new HeightMap(e.cols, e.rows, e.h)).shape].map(k => { const [a, b] = segEnds(k); return { a, b } }))
    button(root, 'Check').click()
    await tick()
    expect(root.textContent).toContain('Solved')
    expect((await storage.loadProgress()).solved).toEqual([])
  })

  it('livesOffUnlimited', async () => {
    const { views, storage } = await load()
    await storage.saveSettings({ ...(await storage.loadSettings()), lives: false })
    const root = sized()
    const s = await views.mountViewsPuzzle(root, file, 'L1-007')
    expect(marks(root)).toBeNull()
    wrongViews(s)
    for (let i = 0; i < 5; i++) { button(root, 'Check').click(); await tick() }
    expect(s.editor.drawing.lines.length).toBeGreaterThan(0)
    expect(root.textContent).not.toContain('Out of lives')
    expect(await storage.loadLives('views/L1-007')).toEqual({ left: 3, revealed: false })
  })

  it('reverse: failed check costs a life', async () => {
    const { reverse } = await load()
    const root = sized()
    const s = await reverse.mountReversePuzzle(root, file, 'L1-003')
    const e = file.puzzles.find(q => q.id === 'L1-003')!, l = viewLabels(new HeightMap(e.cols, e.rows, e.h), e.maxH), a = viewLines(l.top)
    const extra = [0, 1].flatMap(x => [0, 1].map(y => gridSegKey({ x, y }, { x: x + 1, y }))).find(k => !a.has(k))!
    s.setLines('top', new Set([extra]))
    button(root, 'Check').click()
    await vi.waitFor(() => expect(marks(root)!.getAttribute('aria-label')).toBe('Lives: 2 of 3'))
  })

  it('wrongNetsPickCostsLife', async () => {
    const { nets, storage } = await load()
    localStorage.setItem('nets/1', JSON.stringify({ seed: 5, answered: false, pick: -1 }))
    const root = document.body, p = makeNetsPuzzle(1, 5), bad = (p.correct + 1) % 4
    await nets.mountNets(root, 1)
    expect(marks(root)!.getAttribute('aria-label')).toBe('Lives: 3 of 3')
    opts(root)[bad].click()
    expect(marks(root)!.getAttribute('aria-label')).toBe('Lives: 2 of 3')
    expect(opts(root)[bad].classList.contains('wrong')).toBe(true)
    expect(opts(root)[bad].textContent).toBe('Your pick')
    expect(opts(root)[p.correct].classList.contains('right')).toBe(false)
    expect(root.querySelector<HTMLElement>('.netresult')!.hidden).toBe(true)
    expect(await storage.loadLives('nets/1/5')).toEqual({ left: 2, revealed: false })
    opts(root)[p.correct].click() // pick again: right but not first
    expect(root.querySelector<HTMLElement>('.netresult')!.hidden).toBe(false)
    expect((await storage.updateProgress(x => x)).netsRight).toBe(0)
  })

  it('nets: out of lives restarts the same puzzle', async () => {
    const { nets, storage } = await load()
    localStorage.setItem('nets/1', JSON.stringify({ seed: 5, answered: false, pick: -1 }))
    await storage.saveLives('nets/1/5', { left: 1, revealed: false })
    const root = document.body, p = makeNetsPuzzle(1, 5), bad = (p.correct + 1) % 4
    await nets.mountNets(root, 1)
    opts(root)[bad].click()
    expect(marks(root)!.getAttribute('aria-label')).toBe('Lives: 3 of 3')
    expect(root.textContent).toContain('Out of lives — the puzzle starts again')
    expect(opts(root).some(o => o.classList.contains('wrong'))).toBe(false)
    expect(JSON.parse(localStorage.getItem('nets/1')!).seed).toBe(5)
  })

  it('nets with lives off keeps answer-once', async () => {
    const { nets, storage } = await load()
    await storage.saveSettings({ ...(await storage.loadSettings()), lives: false })
    localStorage.setItem('nets/1', JSON.stringify({ seed: 5, answered: false, pick: -1 }))
    const root = document.body, p = makeNetsPuzzle(1, 5), bad = (p.correct + 1) % 4
    await nets.mountNets(root, 1)
    expect(marks(root)).toBeNull()
    opts(root)[bad].click()
    expect(opts(root)[p.correct].classList.contains('right')).toBe(true)
  })

  it('old settings load with lives on; settings switch toggles', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
    const { settings, storage } = await load()
    expect((await storage.loadSettings()).lives).toBe(true)
    const root = sized()
    await settings.mountSettings(root)
    const sw = root.querySelector<HTMLElement>('[data-lives-switch]')!
    expect(sw.getAttribute('aria-checked')).toBe('true')
    sw.click()
    await vi.waitFor(async () => expect((await storage.loadSettings()).lives).toBe(false))
  })
})

describe('nets right-first-time with lives', () => {
  const seed = () => localStorage.setItem('nets/1', JSON.stringify({ seed: 5, answered: false, pick: -1 }))
  const setup = async () => {
    const m = await load()
    seed()
    const p = makeNetsPuzzle(1, 5), bads = [0, 1, 2, 3].filter(i => i !== p.correct)
    return { ...m, p, bads, n0: (await m.storage.updateProgress(x => x)).netsRight }
  }
  const nr = async (s: Awaited<ReturnType<typeof load>>['storage']) => (await s.updateProgress(x => x)).netsRight

  it('right first pick counts with lives on', async () => {
    const { nets, storage, p, n0 } = await setup()
    await nets.mountNets(document.body, 1)
    opts(document.body)[p.correct].click()
    expect(await nr(storage)).toBe(n0 + 1)
  })

  it('restart then right pick does not count', async () => {
    const { nets, storage, p, bads, n0 } = await setup()
    await nets.mountNets(document.body, 1)
    bads.forEach(i => opts(document.body)[i].click())
    expect(marks(document.body)!.getAttribute('aria-label')).toBe('Lives: 3 of 3')
    opts(document.body)[p.correct].click()
    expect(await nr(storage)).toBe(n0)
  })

  it('same after a reload following the restart', async () => {
    const { nets, storage, p, bads, n0 } = await setup()
    const s = await nets.mountNets(document.body, 1)
    bads.forEach(i => opts(document.body)[i].click())
    s.destroy()
    await nets.mountNets(document.body, 1)
    opts(document.body)[p.correct].click()
    expect(await nr(storage)).toBe(n0)
  })
})
