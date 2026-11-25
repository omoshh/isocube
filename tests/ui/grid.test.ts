// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gridSegKey, segKey, type Pt } from '../../src/core/geometry'
import { DrawingEditor } from '../../src/core/drawing'
import { fitView, guideBounds, zoomAt, type View } from '../../src/ui/grid/transform'
import { createIsoGrid, type Tool } from '../../src/ui/grid/IsoGrid'
import { createSquareGrid } from '../../src/ui/grid/SquareGrid'

const S = Math.sqrt(3) / 2
const W = 412, H = 500

// jsdom: PointerEvent may lack pointerId/pointerType init support, so build on MouseEvent.
class PE extends MouseEvent {
  pointerId: number; pointerType: string; isPrimary: boolean
  constructor(type: string, init: MouseEventInit & { pointerId?: number; pointerType?: string }) {
    super(type, { bubbles: true, cancelable: true, ...init })
    this.pointerId = init.pointerId ?? 1; this.isPrimary = this.pointerId === 1; this.pointerType = init.pointerType ?? 'touch'
  }
}
const fire = (el: Element, type: string, x: number, y: number, id = 1, pointerType = 'touch', button = 0) => {
  const e = new PE(type, { clientX: x, clientY: y, pointerId: id, pointerType, button })
  el.dispatchEvent(e)
  return e
}
const drag = (el: Element, pts: [number, number][], id = 1, type = 'touch') => {
  fire(el, 'pointerdown', ...pts[0], id, type)
  for (const p of pts.slice(1)) fire(el, 'pointermove', ...p, id, type)
  fire(el, 'pointerup', ...pts[pts.length - 1], id, type)
}
const toPx = (v: View, p: Pt): [number, number] => [(p.t * S - v.panU) * v.scale, (v.panV - (p.m + p.t / 2)) * v.scale]
const gridAt = (v: View, x: number, y: number) => ({ u: v.panU + x / v.scale, v: v.panV - y / v.scale })

let el: HTMLDivElement
beforeEach(() => {
  el = document.createElement('div')
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: W, height: H, right: W, bottom: H, x: 0, y: 0, toJSON() {} })
  el.setPointerCapture = vi.fn()
  el.releasePointerCapture = vi.fn()
  document.body.appendChild(el)
})
afterEach(() => { el.remove() })

const bounds = { t0: -6, t1: 6, v0: -2.6, v1: 6.5 }
function mount(o: { tool?: Tool; pen?: boolean } = {}) {
  const editor = new DrawingEditor({ lines: [], fills: {} }, bounds, () => {})
  const state = { tool: o.tool ?? 'line' as Tool, pen: o.pen ?? false }
  const grid = createIsoGrid(el, {
    bounds, guide: { cols: 3, rows: 3, maxH: 2 }, arrows: true, editor,
    tool: () => state.tool, colour: () => 1, penOnly: () => state.pen,
  })
  return { editor, grid, state }
}

describe('transform', () => {
  it('fitStepAtLeast40', () => {
    expect(fitView(guideBounds(3, 3, 2), 412, 500).scale).toBeGreaterThanOrEqual(40)
  })
  it('fit centres the content with one step of margin', () => {
    const b = guideBounds(3, 3, 2), v = fitView(b, 412, 500)
    const cu = (b.t0 + b.t1) / 2 * S, cv = (b.v0 + b.v1) / 2
    expect(v.panU + 206 / v.scale).toBeCloseTo(cu)
    expect(v.panV - 250 / v.scale).toBeCloseTo(cv)
    expect(v.scale).toBeCloseTo(Math.min(412 / ((b.t1 - b.t0) * S + 2), 500 / (b.v1 - b.v0 + 2)))
  })
  it('zoomAt keeps the point under the pointer and clamps', () => {
    const v = { scale: 50, panU: -3, panV: 5 }
    const z = zoomAt(v, 2, 100, 80)
    expect(z.scale).toBe(100)
    expect(gridAt(z, 100, 80).u).toBeCloseTo(gridAt(v, 100, 80).u)
    expect(gridAt(z, 100, 80).v).toBeCloseTo(gridAt(v, 100, 80).v)
    expect(zoomAt(v, 10, 0, 0, [25, 200]).scale).toBe(200)
    expect(zoomAt(v, 0.01, 0, 0, [25, 200]).scale).toBe(25)
  })
})

describe('iso grid', () => {
  it('gestureStylesSet', () => {
    mount()
    expect(el.style.touchAction).toBe('none')
    expect(el.style.getPropertyValue('overscroll-behavior')).toBe('none')
  })

  it('fitStepAtLeast40 on the mounted grid', () => {
    expect(mount().grid.getView().scale).toBeGreaterThanOrEqual(40)
  })

  it('dragAddsLine', () => {
    const { editor, grid } = mount()
    const v = grid.getView()
    const down = fire(el, 'pointerdown', ...toPx(v, { t: 0, m: 0 }))
    const move = fire(el, 'pointermove', ...toPx(v, { t: 0, m: 1.2 }))
    expect(el.querySelectorAll('.g-prev line').length).toBe(1) // live preview
    fire(el, 'pointermove', ...toPx(v, { t: 0.1, m: 2.1 }))
    fire(el, 'pointerup', ...toPx(v, { t: 0.1, m: 2.1 }))
    expect(down.defaultPrevented && move.defaultPrevented).toBe(true)
    expect(el.setPointerCapture).toHaveBeenCalledWith(1)
    expect(editor.drawing.lines).toEqual([segKey({ t: 0, m: 0 }, { t: 0, m: 1 }), segKey({ t: 0, m: 1 }, { t: 0, m: 2 })].sort())
    expect(el.querySelectorAll('.g-lines line').length).toBe(2)
    expect(el.querySelectorAll('.g-prev *').length).toBe(0)
  })

  it('secondPointerCancelsStroke', () => {
    const { editor, grid } = mount()
    const v = grid.getView()
    fire(el, 'pointerdown', ...toPx(v, { t: 0, m: 0 }), 1)
    fire(el, 'pointermove', ...toPx(v, { t: 0, m: 2 }), 1)
    fire(el, 'pointerdown', 300, 300, 2)
    fire(el, 'pointermove', 320, 320, 2)
    fire(el, 'pointerup', 320, 320, 2)
    fire(el, 'pointermove', ...toPx(v, { t: 0, m: 3 }), 1)
    fire(el, 'pointerup', ...toPx(v, { t: 0, m: 3 }), 1)
    expect(editor.drawing.lines).toEqual([])
    expect(el.querySelectorAll('.g-prev *').length).toBe(0)
  })

  it('lostPointerRecovers', () => {
    const { editor, grid } = mount()
    const v = grid.getView()
    fire(el, 'pointerdown', ...toPx(v, { t: 0, m: 0 }), 1) // its pointerup never arrives
    fire(el, 'pointerdown', ...toPx(v, { t: 0, m: 0 }), 1) // a new primary touch clears the stale entry
    fire(el, 'pointermove', ...toPx(v, { t: 0, m: 1.2 }), 1)
    fire(el, 'pointerup', ...toPx(v, { t: 0, m: 1.2 }), 1)
    expect(editor.drawing.lines).toEqual([segKey({ t: 0, m: 0 }, { t: 0, m: 1 })])
    fire(el, 'pointerdown', ...toPx(v, { t: 1, m: 0 }), 3) // stale second finger, then lostpointercapture
    fire(el, 'lostpointercapture', 0, 0, 3)
    fire(el, 'pointerdown', ...toPx(v, { t: 0, m: 3 }), 4)
    fire(el, 'pointermove', ...toPx(v, { t: 0, m: 4.2 }), 4)
    fire(el, 'pointerup', ...toPx(v, { t: 0, m: 4.2 }), 4)
    expect(editor.drawing.lines.length).toBeGreaterThan(1)
  })

  it('penOnlyIgnoresTouch', () => {
    const { editor, grid } = mount({ pen: true })
    const v = grid.getView()
    const pts: [number, number][] = [toPx(v, { t: 0, m: 0 }), toPx(v, { t: 0, m: 2 })]
    drag(el, pts, 1, 'touch')
    expect(editor.drawing.lines).toEqual([])
    const after = grid.getView() // a lone finger pans instead
    drag(el, [toPx(after, { t: 0, m: 0 }), toPx(after, { t: 0, m: 2 })], 2, 'pen')
    expect(editor.drawing.lines.length).toBe(2)
  })

  it('pinchZooms around the midpoint', () => {
    const { editor, grid } = mount()
    const v0 = grid.getView()
    fire(el, 'pointerdown', 150, 250, 1)
    fire(el, 'pointerdown', 250, 250, 2)
    const g = gridAt(v0, 200, 250)
    const mv = fire(el, 'pointermove', 300, 250, 2) // distance 100 -> 150, midpoint moves to 225
    fire(el, 'pointerup', 300, 250, 2); fire(el, 'pointerup', 150, 250, 1)
    const v1 = grid.getView()
    expect(mv.defaultPrevented).toBe(true)
    expect(v1.scale).toBeCloseTo(v0.scale * 1.5)
    expect(gridAt(v1, 225, 250).u).toBeCloseTo(g.u)
    expect(gridAt(v1, 225, 250).v).toBeCloseTo(g.v)
    expect(editor.drawing.lines).toEqual([])
  })

  it('wheelZoomsAroundPointer', () => {
    const { grid } = mount()
    const v0 = grid.getView(), g = gridAt(v0, 150, 200)
    const e = new WheelEvent('wheel', { clientX: 150, clientY: 200, deltaY: -100, cancelable: true, bubbles: true })
    el.dispatchEvent(e)
    const v1 = grid.getView()
    expect(e.defaultPrevented).toBe(true)
    expect(v1.scale).toBeGreaterThan(v0.scale)
    expect(gridAt(v1, 150, 200).u).toBeCloseTo(g.u)
    expect(gridAt(v1, 150, 200).v).toBeCloseTo(g.v)
  })

  it('fitRestores', () => {
    const { grid } = mount()
    const v0 = grid.getView()
    grid.zoomBy(2)
    expect(grid.getView().scale).toBeCloseTo(v0.scale * 2)
    grid.zoomBy(100)
    expect(grid.getView().scale).toBeCloseTo(v0.scale * 4) // clamped at 4x fit
    fire(el, 'pointerdown', 10, 10, 1, 'mouse', 1); fire(el, 'pointermove', 60, 40, 1, 'mouse', 1); fire(el, 'pointerup', 60, 40, 1, 'mouse', 1)
    grid.fit()
    expect(grid.getView()).toEqual(v0)
  })

  it('middle-button drag pans and draws nothing; context menu is suppressed', () => {
    const { editor, grid } = mount()
    const v0 = grid.getView()
    fire(el, 'pointerdown', 10, 10, 1, 'mouse', 1); fire(el, 'pointermove', 60, 40, 1, 'mouse', 1); fire(el, 'pointerup', 60, 40, 1, 'mouse', 1)
    const v1 = grid.getView()
    expect(v1.panU).toBeCloseTo(v0.panU - 50 / v0.scale)
    expect(v1.panV).toBeCloseTo(v0.panV + 30 / v0.scale)
    expect(editor.drawing.lines).toEqual([])
    const cm = new MouseEvent('contextmenu', { cancelable: true, bubbles: true })
    el.dispatchEvent(cm)
    expect(cm.defaultPrevented).toBe(true)
  })

  it('touchmove is prevented so the page never scrolls or refreshes', () => {
    mount()
    const t = new TouchEvent('touchmove', { cancelable: true, bubbles: true })
    el.dispatchEvent(t)
    expect(t.defaultPrevented).toBe(true)
  })

  it('erase and fill tools', () => {
    const m = mount()
    let v = m.grid.getView()
    drag(el, [toPx(v, { t: 0, m: 0 }), toPx(v, { t: 0, m: 1 })])
    expect(m.editor.drawing.lines.length).toBe(1)
    m.state.tool = 'erase'
    drag(el, [toPx(v, { t: 0.3, m: 0.4 })]) // 0.26 from the segment
    expect(m.editor.drawing.lines).toEqual([])
    // closed triangle then fill
    m.state.tool = 'line'
    drag(el, [toPx(v, { t: 0, m: 0 }), toPx(v, { t: 0, m: 1 })])
    drag(el, [toPx(v, { t: 0, m: 1 }), toPx(v, { t: 1, m: 0 })])
    drag(el, [toPx(v, { t: 1, m: 0 }), toPx(v, { t: 0, m: 0 })])
    m.state.tool = 'fill'
    v = m.grid.getView()
    drag(el, [toPx(v, { t: 0.3, m: 0.3 })])
    expect(Object.values(m.editor.drawing.fills)).toEqual([1])
    expect(el.querySelector('.g-fills polygon')?.getAttribute('style')).toContain('var(--tone-1)')
  })
  describe('eraser takes only the line under the finger', () => {
    const two = (a: [Pt, Pt], b: [Pt, Pt]) => {
      const m = mount(), v = m.grid.getView()
      drag(el, [toPx(v, a[0]), toPx(v, a[1])]); drag(el, [toPx(v, b[0]), toPx(v, b[1])])
      expect(m.editor.drawing.lines.length).toBe(2)
      m.state.tool = 'erase'
      return { m, v }
    }
    it('tap near a shared end point erases one line', () => {
      const { m, v } = two([{ t: 0, m: 0 }, { t: 0, m: 1 }], [{ t: 0, m: 0 }, { t: 1, m: 0 }])
      drag(el, [toPx(v, { t: 0, m: 0.1 })]) // 0.1 from the node along the first line, 0.09 from the second
      expect(m.editor.drawing.lines).toEqual(['0:0|1:0'])
    })
    it('tap near one of two parallel lines erases only that one', () => {
      const { m, v } = two([{ t: 0, m: 0 }, { t: 0, m: 1 }], [{ t: 1, m: 0 }, { t: 1, m: 1 }])
      drag(el, [toPx(v, { t: 0.35, m: 0.4 })]) // 0.30 from the first line, 0.56 from the second
      expect(m.editor.drawing.lines).toEqual(['1:0|1:1'])
    })
    it('drag across two touching lines erases both', () => {
      const { m, v } = two([{ t: 0, m: 0 }, { t: 0, m: 1 }], [{ t: 0, m: 0 }, { t: 1, m: 0 }])
      drag(el, [toPx(v, { t: 0, m: 0.5 }), toPx(v, { t: 0.1, m: 0.4 }), toPx(v, { t: 0.3, m: 0.2 }), toPx(v, { t: 0.5, m: 0 })])
      expect(m.editor.drawing.lines).toEqual([])
    })
  })
  it('an eraser tap with no line nearby clears the colour under it', () => {
    const m = mount()
    const v = m.grid.getView()
    drag(el, [toPx(v, { t: 0, m: 0 }), toPx(v, { t: 0, m: 1 })])
    drag(el, [toPx(v, { t: 0, m: 1 }), toPx(v, { t: 1, m: 0 })])
    drag(el, [toPx(v, { t: 1, m: 0 }), toPx(v, { t: 0, m: 0 })])
    m.state.tool = 'fill'
    drag(el, [toPx(v, { t: 0.3, m: 0.3 })])
    m.state.tool = 'erase'
    for (const p of [{ t: 0, m: 0.5 }, { t: 0.5, m: 0.5 }, { t: 0.5, m: 0 }]) drag(el, [toPx(v, p)])
    expect(m.editor.drawing.lines).toEqual([]) // lines gone, colour still there
    expect(Object.keys(m.editor.drawing.fills).length).toBe(1)
    drag(el, [toPx(v, { t: 0.33, m: 0.33 })])
    expect(m.editor.drawing.fills).toEqual({})
    expect(el.querySelector('.g-fills polygon')).toBeNull()
  })

  it('a second finger cancels an erase stroke: nothing is erased', () => {
    const m = mount()
    const v = m.grid.getView()
    drag(el, [toPx(v, { t: 0, m: 0 }), toPx(v, { t: 0, m: 1 })])
    drag(el, [toPx(v, { t: 1, m: 0 }), toPx(v, { t: 1, m: 1 })])
    m.state.tool = 'erase'
    fire(el, 'pointerdown', ...toPx(v, { t: 0, m: 0.5 }), 1)
    fire(el, 'pointermove', ...toPx(v, { t: 1, m: 0.5 }), 1) // drags across the second line too
    expect(el.querySelectorAll('.g-lines line').length).toBe(0) // hidden while pending
    fire(el, 'pointerdown', 300, 300, 2)
    expect(m.editor.drawing.lines.length).toBe(2)
    expect(el.querySelectorAll('.g-lines line').length).toBe(2)
    fire(el, 'pointerup', 300, 300, 2); fire(el, 'pointerup', ...toPx(v, { t: 1, m: 0.5 }), 1)
    expect(m.editor.drawing.lines.length).toBe(2)
  })

  it('setOverlay draws answer and check marks; render() picks up outside edits', () => {
    const { editor, grid } = mount()
    const a = segKey({ t: 0, m: 0 }, { t: 0, m: 1 }), b = segKey({ t: 1, m: 0 }, { t: 1, m: 1 })
    grid.setOverlay({ kind: 'answer', edges: new Set([a, b]) })
    expect(el.querySelectorAll('.g-ans line').length).toBe(2)
    grid.setOverlay({ kind: 'check', result: { missing: new Set([a]), mistakes: new Set([b]), correct: false } })
    expect(el.querySelectorAll('.g-ans line').length).toBe(0)
    expect(el.querySelectorAll('.g-missing').length).toBe(1)
    expect(el.querySelectorAll('.g-mistake').length).toBe(1)
    grid.setOverlay(null)
    expect(el.querySelectorAll('.g-missing, .g-mistake').length).toBe(0)
    editor.addLines([{ a: { t: 0, m: 0 }, b: { t: 0, m: 1 } }])
    grid.render()
    expect(el.querySelectorAll('.g-lines line').length).toBe(1)
  })

  it('initialView and onViewChange', () => {
    const seen: View[] = []
    const editor = new DrawingEditor({ lines: [], fills: {} }, bounds, () => {})
    const iv = { scale: 60, panU: -4, panV: 7 }
    const grid = createIsoGrid(el, { bounds, arrows: false, editor, tool: () => 'line', colour: () => 1, penOnly: () => false, initialView: iv, onViewChange: v => seen.push(v) })
    expect(grid.getView()).toEqual(iv)
    grid.zoomBy(1.5)
    expect(seen.at(-1)).toEqual(grid.getView())
    grid.destroy()
    expect(el.children.length).toBe(0)
  })
})

describe('square grid', () => {
  it('drag adds segments, tap near a segment removes it, second pointer cancels', () => {
    const changes: Set<string>[] = []
    const g = createSquareGrid(el, { cols: 3, rows: 3, lines: new Set(), onChange: l => changes.push(l), penOnly: () => false })
    expect(el.style.touchAction).toBe('none')
    const v = g.getView()
    const px = (x: number, y: number): [number, number] => [(x - v.panU) * v.scale, (v.panV + y) * v.scale]
    drag(el, [px(0, 0), px(1.1, 0.2), px(2.2, 0.1)])
    expect([...changes.at(-1)!].sort()).toEqual([gridSegKey({ x: 0, y: 0 }, { x: 1, y: 0 }), gridSegKey({ x: 1, y: 0 }, { x: 2, y: 0 })].sort())
    drag(el, [px(1.5, 0.3)])
    expect([...changes.at(-1)!]).toEqual([gridSegKey({ x: 0, y: 0 }, { x: 1, y: 0 })])
    const n = changes.length
    fire(el, 'pointerdown', ...px(0, 1), 1); fire(el, 'pointermove', ...px(0, 3), 1)
    fire(el, 'pointerdown', 300, 300, 2); fire(el, 'pointerup', 300, 300, 2); fire(el, 'pointerup', ...px(0, 3), 1)
    expect(changes.length).toBe(n)
    g.setResult({ missing: new Set([gridSegKey({ x: 0, y: 1 }, { x: 0, y: 2 })]), mistakes: new Set(), correct: false })
    expect(el.querySelectorAll('.g-missing').length).toBe(1)
  })
})
