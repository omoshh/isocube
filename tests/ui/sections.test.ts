// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeSectionPuzzle } from '../../src/core/sectionPuzzle'

const load = async () => ({
  sections: await import('../../src/ui/screens/sections'),
  storage: await import('../../src/ui/storage'),
  anim: await import('../../src/core/sectionAnim'), // same module copy as the screen's, so spies hit
})
const opts = (root: Element) => [...root.querySelectorAll<HTMLElement>('.netopt')]
const seedAt = (level: number, seed: number, extra = {}) => localStorage.setItem('sections/' + level, JSON.stringify({ seed, answered: false, pick: -1, ...extra }))
const solved = async (s: Awaited<ReturnType<typeof load>>['storage']) => (await s.updateProgress(p => p)).solved.filter(x => x.startsWith('X'))
const noLives = async (s: Awaited<ReturnType<typeof load>>['storage']) => s.saveSettings({ ...(await s.loadSettings()), lives: false })

beforeEach(async () => { await (await import('idb-keyval')).clear(); vi.resetModules(); indexedDB = new IDBFactory(); document.body.replaceChildren(); localStorage.clear() })

describe('sections screen', { timeout: 30000 }, () => {
  it('rightPickSolves', async () => {
    const { sections, storage } = await load()
    seedAt(1, 5)
    const root = document.body, p = makeSectionPuzzle(1, 5)
    await sections.mountSections(root, 1)
    expect(opts(root).map(o => o.textContent)).toEqual(['A', 'B', 'C', 'D'])
    expect(opts(root).map(o => o.getAttribute('aria-label'))).toEqual(['A', 'B', 'C', 'D'])
    expect(root.querySelector('.netq')!.textContent).toBe('Which shape is the cut?')
    expect(root.querySelectorAll('.netshape .secpoint').length).toBe(3)
    opts(root)[p.correct].click()
    expect(await solved(storage)).toEqual(['X1-5'])
    opts(root)[p.correct].click()
    expect(await solved(storage)).toEqual(['X1-5'])
    expect(opts(root)[p.correct].querySelector('.badge svg')).toBeTruthy()
    expect(root.querySelector<HTMLElement>('.foldbox')!.hidden).toBe(false)
  })

  it('wrongPickCostsLife', async () => {
    const { sections, storage } = await load()
    seedAt(1, 5)
    const root = document.body, p = makeSectionPuzzle(1, 5), bad = (p.correct + 1) % 4
    await sections.mountSections(root, 1)
    opts(root)[bad].click()
    expect(opts(root)[bad].classList.contains('wrong')).toBe(true)
    expect(opts(root)[bad].textContent).toBe('Your pick')
    expect(opts(root)[p.correct].classList.contains('right')).toBe(false) // not revealed
    expect(root.querySelector('[aria-label="Lives: 2 of 3"]')).toBeTruthy()
    expect(root.querySelector<HTMLElement>('.foldbox')!.hidden).toBe(true)
    opts(root)[p.correct].click()
    expect(opts(root)[p.correct].classList.contains('right')).toBe(true)
    expect(await solved(storage)).toEqual([]) // a wrong pick happened first
  })

  it('wrongPickNeverSolvesAfterRestartAndReload', async () => {
    const { sections, storage } = await load()
    seedAt(1, 5)
    const root = document.body, p = makeSectionPuzzle(1, 5), wrong = [0, 1, 2, 3].filter(i => i !== p.correct)
    const s = await sections.mountSections(root, 1)
    for (const i of wrong) opts(root)[i].click() // third wrong pick: out of lives, same puzzle restarts
    expect(root.querySelector('.lives-note')!.textContent).toContain('Out of lives')
    expect(JSON.parse(localStorage.getItem('sections/1')!).seed).toBe(5)
    expect(opts(root).every(o => !o.classList.contains('wrong'))).toBe(true)
    s.destroy()
    await sections.mountSections(root, 1) // reload
    opts(root)[p.correct].click()
    expect(await solved(storage)).toEqual([])
  })

  it('livesOffAnswersOnce', async () => {
    const { sections, storage } = await load()
    await noLives(storage)
    seedAt(1, 5)
    const root = document.body, p = makeSectionPuzzle(1, 5), bad = (p.correct + 1) % 4
    await sections.mountSections(root, 1)
    expect(root.querySelector('[aria-label^="Lives"]')).toBeNull()
    opts(root)[bad].click()
    expect(opts(root)[bad].classList.contains('wrong')).toBe(true)
    expect(opts(root)[p.correct].classList.contains('right')).toBe(true)
    opts(root)[p.correct].click()
    expect(await solved(storage)).toEqual([])
  })

  it('seedSurvivesReload', async () => {
    const { sections, storage } = await load()
    const root = document.body
    const s = await sections.mountSections(root, 2)
    const html = root.querySelector('.netopts')!.innerHTML, seed = localStorage.getItem('sections/2')
    expect(seed).toBeTruthy()
    s.destroy()
    expect(root.children.length).toBe(0)
    await sections.mountSections(root, 2)
    expect(root.querySelector('.netopts')!.innerHTML).toBe(html)
    expect(localStorage.getItem('sections/2')).toBe(seed)
    const { seed: n } = JSON.parse(seed!)
    opts(root)[makeSectionPuzzle(2, n).correct].click()
    expect(await solved(storage)).toEqual([`X2-${n}`])
  })

  it('sliderDrivesAnimation', async () => {
    const { sections, anim } = await load()
    seedAt(1, 5)
    const root = document.body, p = makeSectionPuzzle(1, 5)
    await sections.mountSections(root, 1)
    opts(root)[p.correct].click()
    expect(root.querySelector('.foldbox .seccut')).toBeNull() // t = 0: plane only
    const spy = vi.spyOn(anim.SectionAnimation.prototype, 'at')
    const slider = root.querySelector<HTMLInputElement>('input[type=range]')!
    slider.value = '500'
    slider.dispatchEvent(new Event('input'))
    expect(spy).toHaveBeenLastCalledWith(0.5)
    expect(root.querySelector('.foldbox .seccut')).toBeTruthy()
  })

  it('routeRejectsLevelsOutsideOneToThree', async () => {
    const { startRouter } = await import('../../src/ui/router')
    for (const lv of ['0', '4']) {
      document.body.replaceChildren()
      location.hash = '#/sections/' + lv
      const stop = startRouter(document.body, { puzzles: [] } as never)
      await new Promise(r => setTimeout(r, 30))
      expect(document.body.querySelector('.placeholder')).toBeTruthy()
      stop()
    }
  })
})

describe('sections plane', { timeout: 30000 }, () => {
  it('planeVisibleInViewBoxAtT02', async () => {
    const { sections } = await load()
    seedAt(1, 5)
    const root = document.body, p = makeSectionPuzzle(1, 5)
    await sections.mountSections(root, 1)
    opts(root)[p.correct].click()
    const slider = root.querySelector<HTMLInputElement>('input[type=range]')!
    slider.value = '200'
    slider.dispatchEvent(new Event('input'))
    const pl = root.querySelector('.foldbox .secplane')!, vb = root.querySelector('.foldbox svg')!.getAttribute('viewBox')!.split(' ').map(Number)
    expect(pl).toBeTruthy()
    const pts = pl.getAttribute('points')!.split(' ').map(s => s.split(',').map(Number))
    expect(pts.some(([x, y]) => x >= vb[0] && x <= vb[0] + vb[2] && y >= vb[1] && y <= vb[1] + vb[3])).toBe(true)
  })
})
