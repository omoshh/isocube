// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { segEnds, segKey } from '../../src/core/geometry'
import type { PuzzleFile } from '../../src/core/generator'
import { HeightMap } from '../../src/core/shape'
import { shadowCells, shadowOutline, type Light } from '../../src/core/shadows'

const file: PuzzleFile = JSON.parse(readFileSync('public/puzzles.json', 'utf8'))
const SQ = Math.sqrt(3) / 2
const LIGHTS: Light[] = ['down', 'front', 'side', 'slant']
const load = async () => ({
  shadow: await import('../../src/ui/screens/shadowPuzzle'),
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
const outline = (id: string, level: number) => {
  const e = file.puzzles.find(p => p.id === id)!
  const hm = new HeightMap(e.cols, e.rows, e.h), l = LIGHTS[level - 1]
  return shadowOutline(shadowCells(hm, l), l, hm)
}
const segs = (s: Set<string>) => [...s].map(k => { const [a, b] = segEnds(k); return { a, b } })

beforeEach(() => { vi.resetModules(); indexedDB = new IDBFactory(); document.body.replaceChildren(); sessionStorage.clear() })

describe('shadow puzzle screen', () => {
  it('exactOutlineSolves', async () => {
    const { shadow, storage } = await load()
    const root = sized()
    const s = await shadow.mountShadowPuzzle(root, file, 1, 'L1-001')
    expect(root.textContent).toContain('Shadows')
    s.editor.addLines(segs(outline('L1-001', 1)))
    button(root, 'Check').click()
    await vi.waitFor(async () => expect((await storage.loadProgress()).solved).toEqual(['S1-L1-001']))
    expect(root.textContent).toContain('Solved')
    button(root, 'Next puzzle').click()
    expect(location.hash).toBe('#/shadows/1/L1-002')
    expect((await storage.loadProgress()).solved).toEqual(['S1-L1-001'])
    expect((await storage.loadLast())).toMatchObject({ kind: 'shadows', level: 1, n: 1, route: '#/shadows/1/L1-001' })
    s.destroy()
    expect(root.children.length).toBe(0)
  })

  it('extraSegmentIsMistake, and a failed Check costs a life', async () => {
    const { shadow, storage } = await load()
    const root = sized()
    const s = await shadow.mountShadowPuzzle(root, file, 2, 'L2-001')
    const out = outline('L2-001', 2)
    s.editor.addLines(segs(out))
    // a unit step up from an outline corner that is not itself part of the outline
    const extra = [...out].flatMap(k => segEnds(k)).map(a => ({ a, b: { t: a.t, m: a.m + 1 } })).find(l => !out.has(segKey(l.a, l.b)))!
    s.editor.addLines([extra])
    button(root, 'Check').click()
    expect(root.textContent).toContain('1 mistake')
    expect(root.textContent).not.toContain('missing')
    await vi.waitFor(async () => expect(await storage.loadLives('shadow/2/L2-001')).toEqual({ left: 2, revealed: false }))
    expect((await storage.loadProgress()).solved).not.toContain('S2-L2-001')
    s.destroy()
  })

  it('figure is apart from the drawing field, which stays drawable', async () => {
    const { shadow } = await load()
    const root = sized()
    const s = await shadow.mountShadowPuzzle(root, file, 1, 'L1-003')
    expect(root.querySelector('.vp-grid .g-shape')).toBeNull() // no figure on the grid
    expect(root.querySelector('.g-plane polygon')).toBeTruthy()
    const surface = root.querySelector<HTMLElement>('.vp-grid')!
    surface.setPointerCapture = vi.fn(); surface.releasePointerCapture = vi.fn()
    const v = s.grid.getView(), px = (t: number, m: number): [number, number] => [(t * SQ - v.panU) * v.scale, (v.panV - (m + t / 2)) * v.scale]
    const PE = class extends MouseEvent { pointerId = 1; pointerType = 'touch'; isPrimary = true }
    const fire = (type: string, [x, y]: [number, number]) => surface.dispatchEvent(new PE(type, { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true }))
    fire('pointerdown', px(0, 1)); fire('pointermove', px(0, 1.5)); fire('pointermove', px(0, 2)); fire('pointerup', px(0, 2))
    expect(s.editor.drawing.lines.length).toBe(1)
    s.destroy()
  })

  it('the figure turns to the back and back again', async () => {
    const { shadow } = await load()
    const root = sized()
    const s = await shadow.mountShadowPuzzle(root, file, 1, 'L1-003')
    const fig = root.querySelector('.sp-figure')!, turn = fig.querySelector<HTMLButtonElement>('.turn-btn')!
    const pic = () => [...fig.querySelectorAll('.rv-pic polygon')].map(p => p.getAttribute('points')).join(' ')
    const front = pic()
    expect(fig.querySelector('.side-label')!.textContent).toBe('Front')
    turn.click()
    expect(fig.querySelector('.side-label')!.textContent).toBe('Back')
    expect(turn.getAttribute('aria-pressed')).toBe('true')
    expect(pic()).not.toBe(front)
    fig.querySelector('.rv-pic')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(pic()).toBe(front)
    s.destroy()
  })

  it('turning the figure turns a sideways light arrow, not the light from above', async () => {
    const { shadow } = await load()
    for (const [level, id, turns] of [[2, 'L2-005', true], [1, 'L1-004', false]] as const) {
      const root = sized()
      const s = await shadow.mountShadowPuzzle(root, file, level, id)
      root.querySelector<HTMLButtonElement>('.sp-figure .turn-btn')!.click()
      expect(root.querySelector('.light-badge')!.classList.contains('turned'), `level ${level}`).toBe(turns)
      root.querySelector<HTMLButtonElement>('.sp-figure .turn-btn')!.click()
      expect(root.querySelector('.light-badge')!.classList.contains('turned')).toBe(false)
      s.destroy()
    }
  })

  it('figure area shows the shaded figure and the light', async () => {
    const { shadow } = await load()
    const root = sized()
    const s = await shadow.mountShadowPuzzle(root, file, 3, 'L3-001')
    const fig = root.querySelector('.sp-figure')!
    expect(fig.querySelectorAll('svg.rv-pic polygon').length).toBeGreaterThan(0)
    expect(fig.querySelector('[aria-label="Light from the side"]')).toBeTruthy()
    expect(fig.closest('.vp-gridwrap')).toBeNull() // its own area, not inside the drawing field
    s.destroy()
  })

  it('level 4 names the slant rule and draws no arrow; level 1 has an arrow', async () => {
    const { shadow } = await load()
    const root = sized()
    const s = await shadow.mountShadowPuzzle(root, file, 4, 'L4-001')
    const rule = 'For each step down, the light moves +1 in x and +1 in y.'
    expect(root.querySelector('.light-caption')!.textContent).toBe(rule)
    expect(root.querySelector('.light-badge')!.getAttribute('aria-label')).toContain(rule)
    expect(root.querySelectorAll('.light-badge path').length).toBe(8) // sun rays only
    s.destroy()
    const s1 = await shadow.mountShadowPuzzle(root, file, 1, 'L1-001')
    expect(root.querySelectorAll('.light-badge path').length).toBe(10)
    s1.destroy()
  })

  it('only the target plane is drawable', async () => {
    const { shadow } = await load()
    const root = sized()
    const s = await shadow.mountShadowPuzzle(root, file, 1, 'L1-004') // floor: t -3..3, m 0..3
    s.editor.addLines([{ a: { t: 0, m: 5 }, b: { t: 0, m: 6 } }, { a: { t: 0, m: 2 }, b: { t: 0, m: 4 } }, { a: { t: 5, m: 0 }, b: { t: 6, m: 0 } }])
    expect(s.editor.drawing.lines.length).toBe(0)
    s.editor.addLines([{ a: { t: 0, m: 1 }, b: { t: 0, m: 2 } }, { a: { t: -3, m: 3 }, b: { t: 0, m: 3 } }]) // inside; boundary
    expect(s.editor.drawing.lines.length).toBe(4)
    s.destroy()
  })

  it('persists the drawing under shadow/<level>/<id>', async () => {
    const { shadow, storage } = await load()
    const root = sized()
    const s = await shadow.mountShadowPuzzle(root, file, 4, 'L4-001')
    s.editor.addLines(segs(outline('L4-001', 4)).slice(0, 2))
    await vi.waitFor(async () => expect((await storage.loadDrawing('shadow/4/L4-001'))?.lines.length).toBe(2))
    s.destroy()
  })

  it('levels screen: 4 cards naming the light, bar from S<level>-<id>', async () => {
    const { levels, storage } = await load()
    await storage.updateProgress(p => ({ ...p, solved: ['S1-L1-001', 'L1-002'] }))
    const root = sized()
    const s = await levels.mountLevels(root, file, 'shadows')
    expect(root.querySelectorAll('.tile').length).toBe(4)
    expect(root.querySelector('[data-set="classic"]')).toBeNull()
    expect(root.textContent).not.toContain('Endless')
    expect(root.textContent).toContain('Light from above')
    expect(root.textContent).toContain('Light slanted')
    expect(root.querySelector<HTMLElement>('[data-level="1"] .bar span')!.style.width).toBe('2%')
    expect(root.querySelector<HTMLAnchorElement>('[data-level="2"] .num')!.getAttribute('href')).toBe('#/shadows/2/L2-001')
    s.destroy()
  })
})
