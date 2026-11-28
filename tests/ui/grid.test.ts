// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gridSegKey, segKey, toUV, type Pt } from '../../src/core/geometry'
import { eighthPoint, type Radius } from '../../src/core/arcs'
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
function mount(o: { tool?: Tool; pen?: boolean; free?: { half: boolean; mids?: boolean; radii?: readonly Radius[]; cut?: boolean }; lines?: string[]; arcs?: string[] } = {}) {
  const editor = new DrawingEditor({ lines: o.lines ?? [], arcs: o.arcs ?? [], fills: {} }, bounds, () => {})
  const state = { tool: o.tool ?? 'line' as Tool, pen: o.pen ?? false }
  const grid = createIsoGrid(el, {
    bounds, guide: { cols: 3, rows: 3, maxH: 2 }, arrows: true, editor,
    tool: () => state.tool, colour: () => 1, penOnly: () => state.pen, free: o.free,
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
  it('a saved arc renders as a polyline; a check mark on an arc too', () => {
    const editor = new DrawingEditor({ lines: [], arcs: ['Az|0:0|1|0'], fills: {} }, bounds, () => {})
    const grid = createIsoGrid(el, { bounds, arrows: false, editor, tool: () => 'line', colour: () => 1, penOnly: () => false })
    expect(el.querySelectorAll('.g-lines polyline')).toHaveLength(1)
    grid.setOverlay({ kind: 'check', result: { missing: new Set(), mistakes: new Set(['Az|0:0|1|0']), correct: false } })
    expect(el.querySelectorAll('.g-check polyline.g-mistake')).toHaveLength(1)
  })
  describe('free tools', () => {
    const uvPx = (v: View, [u, w]: [number, number]): [number, number] => [(u - v.panU) * v.scale, (v.panV - w) * v.scale]
    const dotPx = (v: View) => { const c = el.querySelector('.g-handle circle')!; return uvPx(v, [+c.getAttribute('cx')!, +c.getAttribute('cy')!]) }
    it('free line joins any two dots; with half off it still gives unit keys', () => {
      const m = mount({ free: { half: false } }), v = m.grid.getView()
      drag(el, [toPx(v, { t: 0, m: 0 }), toPx(v, { t: 0.05, m: 2.04 })])
      expect(m.editor.drawing.lines).toEqual(['0:0|0:1', '0:1|0:2'])
      drag(el, [toPx(v, { t: 0, m: 0 }), toPx(v, { t: 3, m: 1 })])
      expect(m.editor.drawing.lines).toContain('0:0|3:1')
    })
    it('half points snap only with half on', () => {
      const m = mount({ free: { half: true } }), v = m.grid.getView()
      drag(el, [toPx(v, { t: 0, m: 0 }), toPx(v, { t: 0.5, m: 0 })])
      expect(m.editor.drawing.lines).toEqual(['0.5:0|0:0'])
      el.replaceChildren()
      const n = mount({ free: { half: false } }), w = n.grid.getView()
      drag(el, [toPx(w, { t: 0, m: 0 }), toPx(w, { t: 0.5, m: 0 })])
      expect(n.editor.drawing.lines).not.toContain('0.5:0|0:0')
    })
    it('arc: two taps add the first candidate; dot drag replaces it; undo restores', () => {
      const m = mount({ free: { half: true }, tool: 'arc' }), v = m.grid.getView()
      drag(el, [toPx(v, { t: 1, m: 0 })]); drag(el, [toPx(v, { t: -1, m: 1 })])
      expect(m.editor.drawing.arcs).toEqual(['Az|0:1|1|4', 'Az|0:1|1|5']) // lower quarter ranks first (arcs test)
      drag(el, [dotPx(v), uvPx(v, toUV(eighthPoint('z', { t: 0, m: 0 }, 1, 5)))]) // to the far side of the circle round 0:0
      expect(m.editor.drawing.arcs).toEqual(['Az|0:0|1|2', 'Az|0:0|1|3', 'Az|0:0|1|4', 'Az|0:0|1|5', 'Az|0:0|1|6', 'Az|0:0|1|7'])
      m.editor.undo(); m.grid.render()
      expect(m.editor.drawing.arcs).toEqual(['Az|0:1|1|4', 'Az|0:1|1|5'])
      m.editor.undo(); m.grid.render()
      expect(m.editor.drawing.arcs).toEqual([])
      expect(el.querySelector('.g-handle circle')).toBeNull()
    })
    it('arc: two taps with no valid arc add nothing; the second tap becomes the first', () => {
      const m = mount({ free: { half: true }, tool: 'arc' }), v = m.grid.getView()
      drag(el, [toPx(v, { t: 0, m: 0 })]); drag(el, [toPx(v, { t: 5, m: 0 })])
      expect(m.editor.drawing.arcs).toEqual([])
      drag(el, [toPx(v, { t: 3, m: 1 })]) // same offset as 1:0 → -1:1, moved by t 4
      expect(m.editor.drawing.arcs).toEqual(['Az|4:1|1|4', 'Az|4:1|1|5'])
    })
    it('arc: 6 steps apart makes a radius-3 half circle in Draw, nothing in Views', () => {
      const draw = mount({ free: { half: false, radii: [3, 2.5, 2, 1.5, 1, 0.5] }, tool: 'arc' }), v = draw.grid.getView()
      drag(el, [toPx(v, { t: 0, m: 0 })]); drag(el, [toPx(v, { t: 6, m: 0 })])
      expect(draw.editor.drawing.arcs).toHaveLength(4)
      expect(draw.editor.drawing.arcs!.every(k => k.split('|')[2] === '3')).toBe(true)
      document.body.innerHTML = ''; el.innerHTML = ''; document.body.appendChild(el)
      const views = mount({ free: { half: false }, tool: 'arc' }), w = views.grid.getView()
      drag(el, [toPx(w, { t: 0, m: 0 })]); drag(el, [toPx(w, { t: 6, m: 0 })])
      expect(views.editor.drawing.arcs).toEqual([])
    })
    it('a second finger drops the first arc point', () => {
      const m = mount({ free: { half: true }, tool: 'arc' }), v = m.grid.getView()
      drag(el, [toPx(v, { t: 1, m: 0 })])
      fire(el, 'pointerdown', ...toPx(v, { t: 0, m: 0 }), 1); fire(el, 'pointerdown', ...toPx(v, { t: 2, m: 2 }), 2)
      fire(el, 'pointerup', ...toPx(v, { t: 0, m: 0 }), 1); fire(el, 'pointerup', ...toPx(v, { t: 2, m: 2 }), 2)
      drag(el, [toPx(v, { t: -1, m: 1 })])
      expect(m.editor.drawing.arcs).toEqual([])
    })
    it('eraser takes the nearer of an arc and a line', () => {
      const m = mount({ free: { half: true }, tool: 'erase', arcs: ['Az|0:0|1|0'], lines: ['1:0|1:1'] }), v = m.grid.getView()
      const mid = toUV({ t: 0, m: 0 }) // the arc's middle, at 22.5°
      const c = Math.cos(Math.PI / 8), sn = Math.sin(Math.PI / 8), x = toUV({ t: 1, m: 0 }), y = toUV({ t: -1, m: 1 })
      drag(el, [uvPx(v, [mid[0] + c * x[0] + sn * y[0], mid[1] + c * x[1] + sn * y[1]])])
      expect(m.editor.drawing.arcs).toEqual([]); expect(m.editor.drawing.lines).toEqual(['1:0|1:1'])
    })
    it('snap dots show only for line and arc tools', () => {
      const m = mount({ free: { half: true } })
      expect(el.querySelectorAll('.g-snap circle').length).toBeGreaterThan(0)
      m.state.tool = 'fill'; m.grid.render()
      expect(el.querySelectorAll('.g-snap circle')).toHaveLength(0)
    })
    it('half snap dots hide when zoomed out (no thousands of circles per frame)', () => {
      const m = mount({ free: { half: true } })
      expect(el.querySelectorAll('.g-snap circle').length).toBeGreaterThan(0)
      m.grid.zoomBy(22 / m.grid.getView().scale)
      expect(el.querySelectorAll('.g-snap circle')).toHaveLength(0)
    })
    it('a tap on the arc dot is a tap: it starts the next arc there', () => {
      const m = mount({ free: { half: true }, tool: 'arc' }), v = m.grid.getView()
      drag(el, [toPx(v, { t: 1, m: 0 })]); drag(el, [toPx(v, { t: -1, m: 1 })])
      expect(m.editor.drawing.arcs).toHaveLength(2)
      drag(el, [dotPx(v)]) // the dot sits on eighth 5 of the circle round 0:1, a snap point
      drag(el, [toPx(v, { t: 1, m: 1 })]) // eighth 0 of the same circle
      expect(m.editor.drawing.arcs!.length).toBeGreaterThan(2)
    })
    it('fill stops at a free line', () => {
      const m = mount({ free: { half: false }, lines: ['0:0|1:0', '1:0|1:1', '0:1|1:1', '0:0|0:1', '0:0|1:1'] }), v = m.grid.getView()
      m.state.tool = 'fill'
      drag(el, [uvPx(v, toUV({ t: 2 / 3, m: 1 / 3 }))])
      expect(m.editor.drawing.areas).toHaveLength(1)
      expect(m.editor.drawing.fills).toEqual({})
      expect(el.querySelectorAll('.g-fills polygon')).toHaveLength(1)
    })
    it('an eraser tap far from lines takes the area under it', () => {
      const big = ['0:0|1:0', '1:0|2:0', '2:0|2:1', '2:1|2:2', '1:2|2:2', '0:2|1:2', '0:1|0:2', '0:0|0:1'] // 2×2 rhombus
      const m = mount({ free: { half: false }, lines: big }), v = m.grid.getView()
      m.state.tool = 'fill'; drag(el, [uvPx(v, toUV({ t: 1, m: 1 }))])
      expect(m.editor.drawing.areas).toHaveLength(1)
      m.state.tool = 'erase'; drag(el, [uvPx(v, toUV({ t: 1, m: 1 }))])
      expect(m.editor.drawing.areas).toEqual([])
      expect(m.editor.drawing.lines).toHaveLength(8)
    })
    it('Views-style grid (no mids): no snap dot in the middle of a drawn line', () => {
      const m = mount({ free: { half: false } }), v = m.grid.getView()
      drag(el, [toPx(v, { t: 0, m: 0 }), toPx(v, { t: 0, m: 1 })])
      expect(el.querySelectorAll('.g-snap circle')).toHaveLength(0)
    })
    it('a tap on a circle centre with a little jitter is still a tap', () => {
      const m = mount({ free: { half: false }, tool: 'arc', arcs: ['Az|0:0|1|0'] }), v = m.grid.getView()
      drag(el, [uvPx(v, [0, 0]), uvPx(v, [0.15, 0.1])])
      expect(el.querySelectorAll('.g-handle circle.first')).toHaveLength(1)
    })
    it('a drawn line gets a snap dot in its middle', () => {
      const m = mount({ free: { half: false, mids: true } }), v = m.grid.getView()
      drag(el, [toPx(v, { t: 0, m: 0 }), toPx(v, { t: 0, m: 1 })])
      expect(el.querySelectorAll('.g-snap circle')).toHaveLength(1)
      drag(el, [toPx(v, { t: 1, m: 0 }), toPx(v, { t: 0.05, m: 0.45 })])
      expect(m.editor.drawing.lines).toContain('0:0.5|1:0')
    })
    it('drag from a circle centre makes a cylinder in one undo step', () => {
      const full = ['Az|0:0|1|0', 'Az|0:0|1|1', 'Az|0:0|1|2', 'Az|0:0|1|3', 'Az|0:0|1|4', 'Az|0:0|1|5', 'Az|0:0|1|6', 'Az|0:0|1|7']
      const m = mount({ free: { half: false }, tool: 'arc', arcs: full }), v = m.grid.getView()
      expect(el.querySelectorAll('.g-handle circle.centre')).toHaveLength(1)
      drag(el, [uvPx(v, [0, 0]), uvPx(v, [0.1, 1]), uvPx(v, [0.1, 2.1])])
      expect(m.editor.drawing.arcs).toHaveLength(16)
      expect(m.editor.drawing.lines).toEqual(['0~-1:0~0.5|0~-1:2~0.5', '0~1:0~-0.5|0~1:2~-0.5'])
      m.editor.undo(); m.grid.render()
      expect(m.editor.drawing.arcs).toHaveLength(8); expect(m.editor.drawing.lines).toEqual([])
    })
    it('a tap on a circle centre is a normal arc tap', () => {
      const m = mount({ free: { half: false }, tool: 'arc', arcs: ['Az|0:0|1|0'] }), v = m.grid.getView()
      drag(el, [uvPx(v, [0, 0])])
      expect(el.querySelectorAll('.g-handle circle.first')).toHaveLength(1)
      expect(m.editor.drawing.arcs).toEqual(['Az|0:0|1|0'])
    })
    it('without free the line tool keeps the 3-direction snap', () => {
      const m = mount(), v = m.grid.getView()
      drag(el, [toPx(v, { t: 0, m: 0 }), toPx(v, { t: 3, m: 1 })])
      expect(m.editor.drawing.lines).not.toContain('0:0|3:1')
    })
  })
  it('a saved diagonal renders', () => {
    mount({ lines: ['0:0|1:1'] })
    expect(el.querySelectorAll('.g-lines line')).toHaveLength(1)
  })
  describe('cut eraser', () => {
    const X = [segKey({ t: 0, m: -1 }, { t: 0, m: 1 }), segKey({ t: -1, m: 0 }, { t: 1, m: 0 })]
    it('Draw: a tap on one arm removes only that arm', () => {
      const m = mount({ free: { half: false, cut: true }, tool: 'erase', lines: X }), v = m.grid.getView()
      drag(el, [toPx(v, { t: 0.6, m: 0 })])
      expect(m.editor.drawing.lines).toEqual([segKey({ t: 0, m: -1 }, { t: 0, m: 1 }), segKey({ t: -1, m: 0 }, { t: 0, m: 0 })].sort())
    })
    it('Views: the same tap removes the whole piece', () => {
      const m = mount({ tool: 'erase', lines: X }), v = m.grid.getView()
      drag(el, [toPx(v, { t: 0.6, m: 0 })])
      expect(m.editor.drawing.lines).toEqual([X[0]])
    })
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
