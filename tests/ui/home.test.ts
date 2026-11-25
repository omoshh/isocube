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
    expect(css).toMatch(/\.netbar \.btn \{ height: var\(--size-touch\)/)
    expect(css).toMatch(/\.netresult \.btn \{ min-height: var\(--size-touch\)/)
    expect(css).toMatch(/\.tool-bar \.icon-btn \{[^}]*border-radius: 50%/)
  })

  it('endlessLinkSitsDirectlyInStatefulCard', async () => {
    const { levels, storage } = await load()
    const l1 = file.puzzles.filter(p => p.set === 'level' && p.level === 1)
    await storage.saveProgress({ solved: l1.map(p => p.id), netsRight: 0, endlessSeeds: {} })
    const root = sized(), s = await levels.mountLevels(root, file)
    expect(root.querySelector('[data-level="1"][data-state="complete"] > a.btn')!.getAttribute('href')).toBe('#/endless/1/new')
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
