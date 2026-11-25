// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeNetsPuzzle } from '../../src/core/nets'

const load = async () => ({
  nets: await import('../../src/ui/screens/nets'),
  storage: await import('../../src/ui/storage'),
  fold: await import('../../src/core/fold'), // same module copy as the screen's, so spies hit
})
const opts = (root: Element) => [...root.querySelectorAll<HTMLElement>('.netopt')]
const seedAt = (level: number, seed: number) => localStorage.setItem('nets/' + level, JSON.stringify({ seed, answered: false, pick: -1 }))
const right = async (s: Awaited<ReturnType<typeof load>>['storage']) => (await s.updateProgress(p => p)).netsRight

beforeEach(async () => { await (await import('idb-keyval')).clear(); vi.resetModules(); indexedDB = new IDBFactory(); document.body.replaceChildren(); localStorage.clear() })

describe('nets screen', () => {
  it('rightFirstChoiceCounts', async () => {
    const { nets, storage } = await load()
    seedAt(1, 5)
    const root = document.body, p = makeNetsPuzzle(1, 5), n0 = await right(storage)
    await nets.mountNets(root, 1)
    expect(opts(root).map(o => o.textContent)).toEqual(['A', 'B', 'C', 'D'])
    opts(root)[p.correct].click()
    expect(await right(storage)).toBe(n0 + 1)
    opts(root)[p.correct].click()
    expect(await right(storage)).toBe(n0 + 1)
  })

  it('wrongShowsCorrect', async () => {
    const { nets, storage } = await load()
    await storage.saveSettings({ ...(await storage.loadSettings()), lives: false }) // these tests cover the answer-once behaviour
    seedAt(1, 5)
    const root = document.body, p = makeNetsPuzzle(1, 5), bad = (p.correct + 1) % 4, n0 = await right(storage)
    await nets.mountNets(root, 1)
    opts(root)[bad].click()
    expect(opts(root)[bad].classList.contains('wrong')).toBe(true)
    expect(opts(root)[p.correct].classList.contains('right')).toBe(true)
    opts(root)[p.correct].click() // later taps do nothing
    expect(await right(storage)).toBe(n0)
  })

  it('scoreLineAndNewShape', async () => {
    const { nets } = await load()
    seedAt(1, 5)
    const root = document.body
    await nets.mountNets(root, 1)
    expect(root.querySelector('.score')!.textContent).toMatch(/^\d+ right first time$/)
    expect(root.querySelector('.score-n')!.textContent).toMatch(/^\d+$/)
    expect([...root.querySelectorAll('button')].some(b => b.textContent === 'New shape')).toBe(true)
    expect(root.querySelector<HTMLElement>('.netresult')!.hidden).toBe(true)
  })

  it('wrongPickMarkedAndResultBar', async () => {
    const { nets, storage } = await load()
    await storage.saveSettings({ ...(await storage.loadSettings()), lives: false }) // these tests cover the answer-once behaviour
    seedAt(1, 5)
    const root = document.body, p = makeNetsPuzzle(1, 5), bad = (p.correct + 1) % 4
    await nets.mountNets(root, 1)
    opts(root)[bad].click()
    expect(opts(root)[bad].textContent).toBe('Your pick')
    expect(opts(root)[p.correct].querySelector('.badge svg')).toBeTruthy()
    expect(opts(root)[bad].querySelector('.badge')).toBeNull()
    const bar = root.querySelector<HTMLElement>('.netresult')!
    expect(bar.hidden).toBe(false)
    expect(bar.getAttribute('aria-live')).toBe('polite')
    expect(bar.textContent).toContain('Not this one')
    expect([...bar.querySelectorAll('button')].map(b => b.textContent)).toEqual(['Fold'])
  })

  it('rightPickGetsBadgeNoYourPick', async () => {
    const { nets } = await load()
    seedAt(1, 5)
    const root = document.body, p = makeNetsPuzzle(1, 5)
    await nets.mountNets(root, 1)
    opts(root)[p.correct].click()
    expect(opts(root)[p.correct].querySelector('.badge svg')).toBeTruthy()
    expect(root.querySelector('.netresult')!.textContent).toContain('Correct!')
    expect(root.textContent).not.toContain('Your pick')
  })

  it('seedSurvivesReload', async () => {
    const { nets, storage } = await load()
    const root = document.body, n0 = await right(storage)
    const s = await nets.mountNets(root, 2)
    const html = root.querySelector('.netopts')!.innerHTML, seed = localStorage.getItem('nets/2')
    expect(seed).toBeTruthy()
    s.destroy()
    expect(root.children.length).toBe(0)
    const s2 = await nets.mountNets(root, 2)
    expect(root.querySelector('.netopts')!.innerHTML).toBe(html)
    expect(localStorage.getItem('nets/2')).toBe(seed)
    const p = makeNetsPuzzle(2, JSON.parse(seed!).seed)
    opts(root)[p.correct].click()
    expect(await right(storage)).toBe(n0 + 1)
    s2.destroy()
    await nets.mountNets(root, 2) // reload after answering: no recount
    opts(root)[p.correct].click()
    expect(await right(storage)).toBe(n0 + 1)
  })

  it('sliderSetsPose', async () => {
    const { nets, fold: { FoldAnimation } } = await load()
    seedAt(1, 5)
    const root = document.body, p = makeNetsPuzzle(1, 5)
    await nets.mountNets(root, 1)
    expect(root.querySelector<HTMLElement>('.foldbox')!.hidden).toBe(true)
    opts(root)[p.correct].click()
    const squares = p.options[p.correct].map((_, i) => i), spy = vi.spyOn(FoldAnimation.prototype, 'pose')
    const slider = root.querySelector<HTMLInputElement>('input[type=range]')!
    slider.value = '500'
    slider.dispatchEvent(new Event('input'))
    expect(spy.mock.calls.map(c => c[0])).toEqual(squares)
    expect(spy.mock.calls.every(c => c[1] === 0.5)).toBe(true)
    // the first polygon drawn is some square's pose(i, 0.5) projected: x - y, (x + y) / 2 + z
    const fa = new FoldAnimation(p.options[p.correct], p.shape)
    const drawn = [...root.querySelectorAll('.foldbox polygon')].map(e => e.getAttribute('points'))
    const pts = (i: number) => fa.pose(i, 0.5).map(([x, y, z]) => `${x - y},${-((x + y) / 2 + z)}`).join(' ')
    expect(drawn.sort()).toEqual(squares.map(pts).sort())
  })
})
