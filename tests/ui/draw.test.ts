// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { triAt } from '../../src/core/geometry'
import { exportSvg } from '../../src/ui/exportImage'
import { mountDrawList } from '../../src/ui/screens/draw'
import { deleteDrawing, exportBackup, importBackup, listDrawings, loadDrawing, saveDrawing } from '../../src/ui/storage'

const flushUi = () => new Promise(r => setTimeout(r, 20))
const root = () => document.getElementById('root')!

beforeEach(async () => {
  document.body.innerHTML = '<div id="root"></div>'
  for (const k of await listDrawings('draw/')) await deleteDrawing(k)
  location.hash = ''
})

describe('draw list', () => {
  it('newDrawingListed', async () => {
    const s = await mountDrawList(root())
    ;(root().querySelector('[data-new]') as HTMLElement).click()
    await flushUi()
    const keys = await listDrawings('draw/')
    expect(keys).toHaveLength(1)
    expect(location.hash).toBe('#/' + keys[0])
    expect((await loadDrawing(keys[0]))?.name).toBe('Drawing 1')
    s.destroy()
    const s2 = await mountDrawList(root())
    expect(root().querySelectorAll('.draw-row')).toHaveLength(1)
    expect(root().querySelector('.draw-row a')!.textContent).toBe('Drawing 1')
    s2.destroy()
  })

  it('renameDelete', async () => {
    saveDrawing('draw/a', { lines: [], fills: {}, name: 'Old' })
    const s = await mountDrawList(root())
    vi.stubGlobal('prompt', () => 'Fresh')
    ;(root().querySelector('[data-rename]') as HTMLElement).click()
    await flushUi()
    expect(root().querySelector('.draw-row a')!.textContent).toBe('Fresh')
    expect((await loadDrawing('draw/a'))?.name).toBe('Fresh')
    vi.stubGlobal('confirm', () => false)
    ;(root().querySelector('[data-delete]') as HTMLElement).click()
    await flushUi()
    expect(await listDrawings('draw/')).toHaveLength(1)
    vi.stubGlobal('confirm', () => true)
    ;(root().querySelector('[data-delete]') as HTMLElement).click()
    await flushUi()
    expect(await listDrawings('draw/')).toHaveLength(0)
    expect(root().querySelectorAll('.draw-row')).toHaveLength(0)
    s.destroy()
  })

  it('named drawing survives a backup round-trip', async () => {
    saveDrawing('draw/n', { lines: [], fills: {}, name: 'Keep me' })
    const text = await exportBackup()
    await deleteDrawing('draw/n')
    expect((await importBackup(text)).ok).toBe(true)
    expect((await loadDrawing('draw/n'))?.name).toBe('Keep me')
    expect((await importBackup(text.replace('"Keep me"', '5'))).ok).toBe(false)
  })
})

describe('exportSvg', () => {
  const d = { lines: ['0:0|0:1', '0:1|1:1'], fills: { [triAt(0.3, 0.3)]: 4 } as Record<string, number> }
  const view = { scale: 40, panU: 0, panV: 0 }
  beforeEach(() => {
    const st = document.documentElement.style
    st.setProperty('--bg', '#111111'); st.setProperty('--ink', '#222222'); st.setProperty('--palette-4', '#333333')
  })

  it('svgContainsLines', () => {
    const svg = exportSvg(d, view)
    expect(svg.match(/<line /g)).toHaveLength(d.lines.length)
    expect(svg).toContain('<polygon')
  })

  it('svg uses the chosen line width', () => {
    document.documentElement.style.setProperty('--stroke-line', '3px')
    expect(exportSvg(d, view)).toContain('stroke-width="3"')
  })

  it('svg contains arcs, stroked and unfilled', () => {
    const svg = exportSvg({ lines: [], arcs: ['Az|0:0|1|0'], fills: {} }, view)
    expect(svg.match(/<polyline /g)).toHaveLength(1)
    expect(svg).toContain('fill="none"')
  })

  it('svgStandalone', () => {
    const svg = exportSvg(d, view)
    expect(svg).not.toContain('var(')
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('#333333')
  })
})

describe('draw screen (round 3)', () => {
  it('opens closer: at least 40 px per grid step', async () => {
    const { mountDrawing } = await import('../../src/ui/screens/draw')
    const r = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 380, height: 520, right: 380, bottom: 520, x: 0, y: 0, toJSON() {} } as DOMRect)
    saveDrawing('draw/z', { lines: [], fills: {}, name: 'Z' })
    const s = await mountDrawing(root(), 'z')
    expect(s.grid.getView().scale).toBeGreaterThanOrEqual(40)
    s.destroy(); r.mockRestore()
  })
  it('Draw has the arc tool, after the line tool', async () => {
    const { mountDrawing } = await import('../../src/ui/screens/draw')
    saveDrawing('draw/y', { lines: [], fills: {}, name: 'Y' })
    const s = await mountDrawing(root(), 'y')
    const labels = [...root().querySelectorAll('.tool-bar button')].map(b => b.getAttribute('aria-label'))
    expect(labels.slice(0, 5)).toEqual(['Line', 'Arc', 'Freehand', 'Fill', 'Erase'])
    s.destroy()
  })
  it('Draw snaps only to grid crossings and arc points: no midpoint dots', async () => {
    const { mountDrawing } = await import('../../src/ui/screens/draw')
    const r = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 380, height: 520, right: 380, bottom: 520, x: 0, y: 0, toJSON() {} } as DOMRect)
    saveDrawing('draw/x', { lines: [], fills: {}, name: 'X' })
    const s = await mountDrawing(root(), 'x')
    expect(root().querySelectorAll('.g-snap circle')).toHaveLength(0)
    s.destroy(); r.mockRestore()
  })
  it('New drawing is one full-width button', async () => {
    const s = await mountDrawList(root())
    const b = root().querySelector('[data-new]')!
    expect(b.classList.contains('btn-full')).toBe(true)
    expect(b.parentElement!.children).toHaveLength(1)
    s.destroy()
  })
})
