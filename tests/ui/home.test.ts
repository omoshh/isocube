// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PuzzleFile } from '../../src/core/generator'

const file: PuzzleFile = JSON.parse(readFileSync('public/puzzles.json', 'utf8'))
const load = async () => ({
  home: await import('../../src/ui/screens/home'),
  levels: await import('../../src/ui/screens/levels'),
  puzzle: await import('../../src/ui/screens/viewsPuzzle'),
  reverse: await import('../../src/ui/screens/reversePuzzle'),
  storage: await import('../../src/ui/storage'),
})
const sized = () => {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 412, height: 915, right: 412, bottom: 915, x: 0, y: 0, toJSON() {} })
  document.body.appendChild(el)
  return el
}
beforeEach(() => { vi.resetModules(); indexedDB = new IDBFactory(); document.body.replaceChildren(); sessionStorage.clear() })

describe('home', () => {
  it('hidesContinueWithoutLastPuzzle', async () => {
    const { home } = await load()
    const root = sized(), s = await home.mountHome(root)
    expect(root.querySelector('.home-continue')).toBeNull()
    expect(root.querySelector('[aria-label="Settings"]')!.getAttribute('href')).toBe('#/settings')
    s.destroy()
  })

  it('hidesContinueOnUnreadableValue', async () => {
    const { home, storage } = await load()
    await storage.saveLast({ nonsense: 1 } as never)
    const root = sized(), s = await home.mountHome(root)
    expect(root.querySelector('.home-continue')).toBeNull()
    s.destroy()
  })

  it('showsContinueAfterAPuzzleOpens', async () => {
    const { home, puzzle, storage } = await load()
    const l3 = file.puzzles.filter(p => p.set === 'level' && p.level === 3)
    const p = await puzzle.mountViewsPuzzle(sized(), file, l3[7].id)
    await vi.waitFor(async () => expect(await storage.loadLast()).toBeDefined())
    p.destroy()
    const root = sized(), s = await home.mountHome(root)
    const c = root.querySelector('a.home-continue')!
    expect(c.textContent).toContain('Views, level 3, puzzle 8')
    expect(c.getAttribute('href')).toBe('#/views/' + l3[7].id)
    s.destroy()
  })

  it('reversePuzzleWritesLast', async () => {
    const { reverse, storage } = await load()
    const e = file.puzzles.find(p => p.set === 'reverse' && p.level === 2)!
    const p = await reverse.mountReversePuzzle(sized(), file, e.id)
    expect(await storage.loadLast()).toEqual({ kind: 'reverse', level: 2, n: 1, route: '#/reverse/' + e.id })
    p.destroy()
  })

  it('netsWritesLastWithItsRoute', async () => {
    const { storage } = await load()
    const nets = await import('../../src/ui/screens/nets')
    const p = await nets.mountNets(sized(), 2)
    expect(await storage.loadLast()).toEqual({ kind: 'nets', level: 2, route: '#/nets/2' })
    p.destroy()
  })

  it('tileCounts', async () => {
    const { home, storage } = await load()
    await storage.saveProgress({ solved: ['L1-001', 'L1-002', 'E1-5', 'R-RL1-001'], netsRight: 6, endlessSeeds: {} })
    storage.saveDrawing('draw/a', { lines: [], fills: {} }); storage.saveDrawing('draw/b', { lines: [], fills: {} })
    const root = sized(), s = await home.mountHome(root)
    const count = (k: string) => root.querySelector(`[data-tile="${k}"] .tile-big`)!.textContent
    expect(root.querySelector('.home-total')!.textContent).toBe('10')
    expect([count('views'), count('reverse'), count('nets'), count('draw')]).toEqual(['3', '1', '6', '2'])
    expect(root.querySelector('[data-tile="views"]')!.getAttribute('href')).toBe('#/levels/views')
    s.destroy()
  })

  it('homeShowsNewTiles', async () => {
    const { home, storage } = await load()
    await storage.saveProgress({ solved: ['L1-001', 'X1-5', 'X2-1', 'S2-L3-004', 'R-RL1-001'], netsRight: 0, endlessSeeds: {} })
    const root = sized(), s = await home.mountHome(root)
    const t = (k: string) => root.querySelector(`[data-tile="${k}"]`)!
    const count = (k: string) => t(k).querySelector('.tile-big')!.textContent
    expect([...root.querySelectorAll('[data-tile]')].map(e => e.getAttribute('data-tile'))).toEqual(['views', 'reverse', 'nets', 'shadows', 'draw']) // Sections removed for now
    expect(t('shadows').getAttribute('href')).toBe('#/levels/shadows')
    expect(t('shadows').textContent).toContain('Draw the shadow')
    expect([count('views'), count('shadows')]).toEqual(['1', '1']) // X… ids (Sections) still do not count as Views
    expect(root.querySelector('.home-total')!.textContent).toBe('5')
    s.destroy()
  })
})

describe('levels cards', () => {
  it('statesBarAndSizes', async () => {
    const { levels, storage } = await load()
    const l1 = file.puzzles.filter(p => p.set === 'level' && p.level === 1)
    const l2 = file.puzzles.filter(p => p.set === 'level' && p.level === 2)
    await storage.saveProgress({ solved: l1.map(p => p.id).concat(l2[0].id), netsRight: 0, endlessSeeds: {} })
    await storage.saveLast({ kind: 'views', level: 2, n: 1, route: '#/views/' + l2[0].id })
    const root = sized(), s = await levels.mountLevels(root, file)
    const state = (sel: string) => root.querySelector(sel)!.getAttribute('data-state')
    expect(state('[data-level="1"]')).toBe('complete')
    expect(state('[data-level="2"]')).toBe('last')
    expect(state('[data-level="3"]')).toBeNull()
    expect(root.querySelector('.dot')).toBeNull()
    expect(root.querySelector<HTMLElement>('[data-level="2"] .bar span')!.style.width).toBe('2%')
    expect(root.querySelector<HTMLElement>('[data-level="1"] .bar span')!.style.width).toBe('100%')
    expect(root.querySelector('[data-level="1"] .tile-size')!.textContent).toBe('3×3×2')
    expect(root.querySelector('[data-level="6"] .tile-size')!.textContent).toBe('5×6×5')
    expect(root.querySelector('.levels-hint')!.textContent).toBe('Tap a level to see its puzzles.')
    expect(root.querySelectorAll('[data-level="2"] a.num').length).toBe(l2.length)
    s.destroy()
  })

  it('stylesKeepEndlessVisibleAndOneColumn', () => {
    const css = readFileSync('src/ui/styles/screens.css', 'utf8')
    expect(css).toMatch(/\.tile\[data-state\] > \.btn \{ color: inherit; \}/)
    expect(css).toMatch(/\.tiles \{ display: flex; flex-direction: column;/)
    expect(css).toMatch(/\.endless-picker \.tile-name::after \{ display: none; \}/) // it does not open or close
    expect(css).toMatch(/\.netbar \.btn \{ height: var\(--size-touch\)/)
    expect(css).toMatch(/\.netresult \.btn \{ min-height: var\(--size-touch\)/)
    expect(css).toMatch(/\.tool-bar \.icon-btn \{[^}]*border-radius: 50%/)
  })

  it('endlessLinkSitsDirectlyInStatefulCard', async () => {
    const { levels, storage } = await load()
    const l1 = file.puzzles.filter(p => p.set === 'level' && p.level === 1)
    await storage.saveProgress({ solved: l1.map(p => p.id), netsRight: 0, endlessSeeds: {} })
    const r = file.puzzles.filter(p => p.set === 'reverse' && p.level === 1)
    await storage.saveProgress({ solved: r.map(p => 'R-' + p.id), netsRight: 0, endlessSeeds: {} })
    const root = sized(), s = await levels.mountLevels(root, file, 'reverse')
    expect(root.querySelector('[data-level="1"][data-state="complete"] > a.btn')!.getAttribute('href')).toBe('#/reverse/E1-new')
    s.destroy()
  })

  it('lastOpenedOnlyForSameKind', async () => {
    const { levels, storage } = await load()
    await storage.saveLast({ kind: 'reverse', level: 2, n: 1, route: '#/reverse/x' })
    const root = sized(), s = await levels.mountLevels(root, file)
    expect(root.querySelector('[data-state="last"]')).toBeNull()
    s.destroy()
    const r2 = sized(), s2 = await levels.mountLevels(r2, file, 'reverse')
    expect(r2.querySelector('[data-level="2"]')!.getAttribute('data-state')).toBe('last')
    s2.destroy()
  })
})

describe('endless picker (round 4)', () => {
  const tile = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-set="endless"]')!
  const start = (root: HTMLElement) => tile(root).querySelector('a.btn')!.getAttribute('href')
  const btn = (root: HTMLElement, label: string) => tile(root).querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
  const value = (root: HTMLElement, name: string) => tile(root).querySelector(`[data-value="${name}"]`)!.textContent
  // idb-keyval keeps its store across vi.resetModules, so a size saved by one test would reach the next
  beforeEach(async () => { await (await load()).storage.saveEndlessSpec({ cols: 3, rows: 3, maxH: 2, slopes: false }) })

  it('viewsHasOneEndlessTile', async () => {
    const { levels } = await load()
    const root = sized(), s = await levels.mountLevels(root, file)
    expect(root.querySelector('a[href^="#/endless/"]:not([data-set="endless"] a)')).toBeNull()
    expect(root.querySelectorAll('[data-set="endless"]').length).toBe(1)
    expect(start(root)).toBe('#/endless/3x3x2/new')
    expect(tile(root).textContent).toContain('Endless')
    s.destroy()
  })

  it('reverseKeepsLevelEndless', async () => {
    const { levels } = await load()
    const root = sized(), s = await levels.mountLevels(root, file, 'reverse')
    expect([...root.querySelectorAll('a.btn')].map(a => a.getAttribute('href'))).toEqual([1, 2, 3, 4, 5, 6].map(n => `#/reverse/E${n}-new`))
    expect(root.querySelector('[data-set="endless"]')).toBeNull()
    s.destroy()
  })

  it('stepperLimits', async () => {
    const { levels } = await load()
    const root = sized(), s = await levels.mountLevels(root, file)
    while (!btn(root, 'Width larger').disabled) btn(root, 'Width larger').click()
    expect(value(root, 'cols')).toBe('6')
    expect(start(root)).toBe('#/endless/6x3x2/new')
    btn(root, 'Height smaller').click()
    expect(value(root, 'maxH')).toBe('1')
    expect(btn(root, 'Height smaller').disabled).toBe(true)
    expect(start(root)).toBe('#/endless/6x3x1/new')
    s.destroy()
  })

  it('slopesClamps', async () => {
    const { levels } = await load()
    const root = sized(), s = await levels.mountLevels(root, file)
    for (let i = 0; i < 2; i++) { btn(root, 'Width larger').click(); btn(root, 'Depth larger').click(); btn(root, 'Height larger').click() }
    expect(start(root)).toBe('#/endless/5x5x4/new')
    const sw = tile(root).querySelector<HTMLButtonElement>('button[role="switch"]')!
    sw.click()
    expect(sw.getAttribute('aria-checked')).toBe('true')
    expect([value(root, 'cols'), value(root, 'rows'), value(root, 'maxH')]).toEqual(['4', '3', '3']) // 4x4 is over the width x depth limit of 12
    expect(start(root)).toBe('#/endless/4x3x3s/new')
    expect(btn(root, 'Width larger').disabled).toBe(true)
    expect(btn(root, 'Depth larger').disabled).toBe(true)
    btn(root, 'Width smaller').click(); btn(root, 'Depth larger').click(); btn(root, 'Depth larger').click() // 3x4
    expect([value(root, 'cols'), value(root, 'rows')]).toEqual(['3', '4'])
    expect(btn(root, 'Width larger').disabled).toBe(true)
    btn(root, 'Depth smaller').click(); btn(root, 'Width larger').click() // back to 4x3
    expect(btn(root, 'Height larger').disabled).toBe(true)
    expect(btn(root, 'Height smaller').disabled).toBe(false) // 2 still allowed; 1 never finds a ramp
    for (let i = 0; i < 3; i++) btn(root, 'Height smaller').click()
    expect(value(root, 'maxH')).toBe('2')
    expect(btn(root, 'Height smaller').disabled).toBe(true)
    s.destroy()
  })

  it('specRemembered', async () => {
    const { levels, storage } = await load()
    let root = sized(), s = await levels.mountLevels(root, file)
    btn(root, 'Depth larger').click()
    tile(root).querySelector<HTMLButtonElement>('button[role="switch"]')!.click()
    await vi.waitFor(async () => expect(await storage.loadEndlessSpec()).toEqual({ cols: 3, rows: 4, maxH: 2, slopes: true }))
    s.destroy()
    root = sized(); s = await levels.mountLevels(root, file)
    expect(start(root)).toBe('#/endless/3x4x2s/new')
    s.destroy()
    await storage.saveEndlessSpec({ cols: 9, rows: 'x' } as never)
    expect(await storage.loadEndlessSpec()).toEqual({ cols: 3, rows: 3, maxH: 2, slopes: false })
  })

  it('slopesTilesBySizeHiddenWhenEmpty', async () => {
    const { levels, storage } = await load()
    const sl = file.puzzles.find(p => p.id === 'SL-001')!
    const big = { ...file, puzzles: [...file.puzzles, { ...sl, id: 'SL2-001', level: 2 }, { ...sl, id: 'SL2-002', level: 2 }] }
    await storage.saveLast({ kind: 'views', level: 2, n: 2, route: '#/views/SL2-002' })
    const root = sized(), s = await levels.mountLevels(root, big)
    const tiles = [...root.querySelectorAll('.tile')].map(t => t.getAttribute('data-level') ?? (t.getAttribute('data-slopes') && 's' + t.getAttribute('data-slopes')))
    expect(tiles.slice(0, 6)).toEqual(['1', '2', 's1', 's2', '3', '4']) // Slopes 3 is empty, so hidden
    const s2 = root.querySelector('[data-slopes="2"]')!
    expect([s2.querySelector('.tile-name')!.textContent, s2.querySelector('.tile-size')!.textContent]).toEqual(['Slopes 2', '4×4×3'])
    expect(root.querySelector('[data-slopes="1"] .tile-name')!.textContent).toBe('Slopes 1')
    expect(s2.querySelectorAll('a.num')).toHaveLength(2)
    expect(s2.getAttribute('data-state')).toBe('last') // by the puzzle, not by level 2
    expect(root.querySelector('[data-level="2"]')!.getAttribute('data-state')).toBeNull()
    s.destroy()
  })

  it('endlessPlayDoesNotMarkSlopesTile', async () => {
    const { levels, storage } = await load()
    await storage.saveLast({ kind: 'views', level: 0, route: '#/endless/3x3x2s/5' })
    const root = sized(), s = await levels.mountLevels(root, file)
    expect(root.querySelector('[data-set="slopes"]')!.getAttribute('data-state')).toBeNull()
    s.destroy()
  })
})
