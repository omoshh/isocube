import { fitRect, panBy, zoomAt, type View } from './transform'
import './grid.css'

// Shared surface for both grids: one SVG, a world group in grid units (u right, v up), the View,
// and pointer bookkeeping that turns raw events into draw callbacks or pan/zoom.

export type UV = { u: number; v: number }
export type DrawHandlers = { start(p: UV): void; move(p: UV): void; end(p: UV): void; cancel(): void }
export type SurfaceOpts = {
  content: () => [u0: number, u1: number, v0: number, v1: number] // what fit() frames
  penOnly: () => boolean
  draw: DrawHandlers
  onView: () => void // view changed: redraw whatever depends on the visible area
  initialView?: View
  onViewChange?: (v: View) => void
}
type Mode = 'draw' | 'pan' | 'pinch' | 'idle'
type Ptr = { x: number; y: number; mode: Mode }

const NS = 'http://www.w3.org/2000/svg'
export function mk<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element) {
  const e = document.createElementNS(NS, tag)
  for (const k in attrs) e.setAttribute(k, String(attrs[k]))
  parent?.appendChild(e)
  return e
}

export function createSurface(el: HTMLElement, o: SurfaceOpts) {
  el.style.touchAction = 'none'
  el.style.setProperty('overscroll-behavior', 'none')
  const svg = mk('svg', { class: 'grid-svg' }, el)
  const world = mk('g', {}, svg)
  let w = 0, h = 0, fitScale = 1, view: View = { scale: 1, panU: 0, panV: 0 }
  const fitNow = () => fitRect(...o.content(), w, h)
  const lim = (): [number, number] => [fitScale * 0.5, fitScale * 4]

  function setView(v: View, notify = true) {
    view = v
    const s = v.scale
    world.setAttribute('transform', `matrix(${s} 0 0 ${-s} ${-v.panU * s} ${v.panV * s})`)
    o.onView()
    if (notify) o.onViewChange?.(v)
  }

  function resize() {
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return
    const first = !w, dw = r.width - w, dh = r.height - h
    w = r.width; h = r.height; fitScale = fitNow().scale
    if (first) setView(o.initialView ?? fitNow(), false)
    else if (dw || dh) setView(panBy(view, dw / 2, dh / 2)) // keep the centre where it was
  }

  const ptrs = new Map<number, Ptr>()
  let space = false
  const local = (e: MouseEvent) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
  const toGrid = (x: number, y: number): UV => ({ u: view.panU + x / view.scale, v: view.panV - y / view.scale })

  function down(e: PointerEvent) {
    e.preventDefault()
    const p = local(e), others = [...ptrs.values()]
    let mode: Mode
    if (e.button === 1 || e.button === 2 || (space && e.pointerType === 'mouse')) mode = 'pan'
    else if (others.length) {
      // pen-only: a resting palm must not cancel the pen's stroke
      if (o.penOnly() && e.pointerType !== 'pen' && others.some(q => q.mode === 'draw')) mode = 'idle'
      else {
        for (const q of others) { if (q.mode === 'draw') o.draw.cancel(); q.mode = 'pinch' }
        mode = 'pinch'
      }
    } else if (!o.penOnly() || e.pointerType === 'pen') mode = 'draw'
    else mode = 'pan' // pen-only: a lone finger pans
    ptrs.set(e.pointerId, { ...p, mode })
    el.setPointerCapture?.(e.pointerId)
    if (mode === 'draw') o.draw.start(toGrid(p.x, p.y))
  }

  function move(e: PointerEvent) {
    const q = ptrs.get(e.pointerId)
    if (!q) return
    e.preventDefault()
    const p = local(e)
    if (q.mode === 'draw') o.draw.move(toGrid(p.x, p.y))
    else if (q.mode === 'pan') setView(panBy(view, p.x - q.x, p.y - q.y))
    else if (q.mode === 'pinch') {
      const pair = [...ptrs.values()].filter(r => r.mode === 'pinch').slice(0, 2)
      if (pair.length === 2 && pair.includes(q)) {
        const [a, b] = pair, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, d0 = Math.hypot(a.x - b.x, a.y - b.y)
        q.x = p.x; q.y = p.y
        const nx = (a.x + b.x) / 2, ny = (a.y + b.y) / 2, d1 = Math.hypot(a.x - b.x, a.y - b.y)
        setView(zoomAt(panBy(view, nx - mx, ny - my), d0 ? d1 / d0 : 1, nx, ny, lim()))
      }
    }
    q.x = p.x; q.y = p.y
  }

  function up(e: PointerEvent) {
    const q = ptrs.get(e.pointerId)
    if (!q) return
    e.preventDefault()
    ptrs.delete(e.pointerId)
    if (q.mode === 'draw') {
      if (e.type === 'pointerup') { const p = local(e); o.draw.end(toGrid(p.x, p.y)) } else o.draw.cancel()
    }
    const left = [...ptrs.values()].filter(r => r.mode === 'pinch')
    if (left.length === 1) left[0].mode = 'pan' // one finger still down after a pinch keeps panning
  }

  function wheel(e: WheelEvent) {
    e.preventDefault()
    const p = local(e), dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? h : 1)
    setView(zoomAt(view, Math.exp(-dy * 0.002), p.x, p.y, lim()))
  }

  const prevent = (e: Event) => e.preventDefault()
  const typing = (e: KeyboardEvent) => e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)
  const keydown = (e: KeyboardEvent) => { if (e.key === ' ' && !typing(e)) space = true }
  const keyup = (e: KeyboardEvent) => { if (e.key === ' ') space = false }
  const blur = () => { space = false }
  const on: [EventTarget, string, EventListener][] = [
    [el, 'pointerdown', down as EventListener], [el, 'pointermove', move as EventListener],
    [el, 'pointerup', up as EventListener], [el, 'pointercancel', up as EventListener],
    [el, 'wheel', wheel as EventListener], [el, 'contextmenu', prevent], [el, 'touchmove', prevent],
    [window, 'keydown', keydown as EventListener], [window, 'keyup', keyup as EventListener], [window, 'blur', blur],
  ]
  for (const [t, n, f] of on) t.addEventListener(n, f, { passive: false })
  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
  ro?.observe(el)
  resize()

  return {
    svg, world, toGrid,
    getView: (): View => ({ ...view }),
    /** visible area in grid units */
    visible: (): [number, number, number, number] => [view.panU, view.panU + w / view.scale, view.panV - h / view.scale, view.panV],
    fit: () => setView(fitNow()),
    zoomBy: (f: number) => setView(zoomAt(view, f, w / 2, h / 2, lim())),
    destroy() {
      for (const [t, n, f] of on) t.removeEventListener(n, f)
      ro?.disconnect()
      svg.remove()
    },
  }
}
