import { countsAsSolved } from '../../core/lives'
import { checkDrawing } from '../../core/checker'
import { DrawingEditor, type Bounds } from '../../core/drawing'
import { segEnds } from '../../core/geometry'
import type { PuzzleFile } from '../../core/generator'
import { HeightMap, computeEdges } from '../../core/shape'
import { shadowCells, shadowOutline, shadowPlaneBounds, type Light } from '../../core/shadows'
import { createLives } from '../components/lives'
import { createToolBar } from '../components/toolBar'
import { createTopBar } from '../components/topBar'
import { h, icon } from '../dom'
import { createIsoGrid, type Tool } from '../grid/IsoGrid'
import type { View } from '../grid/transform'
import { loadDrawing, saveDrawing, saveLast, updateProgress } from '../storage'
import { S } from '../strings'

const LIGHTS: Light[] = ['down', 'front', 'side', 'slant']
// kept across puzzles for the session
let tool: Tool = 'line', penOnly = false

const readView = (id: string): View | undefined => {
  try { const s = sessionStorage.getItem('view/' + id); return s ? JSON.parse(s) : undefined } catch { return undefined }
}
const writeView = (id: string, v: View) => { try { sessionStorage.setItem('view/' + id, JSON.stringify(v)) } catch { /* view is a convenience */ } }

// Light travel on screen (y down): straight down; +y and +x run up-left / up-right in the iso view; the slant leans down-right.
const DIR: Record<Light, [number, number]> = { down: [0, 1], front: [-0.87, -0.5], side: [0.87, -0.5], slant: [0.6, 0.8] }

/** A small sun with an arrow showing which way the light travels. Drawn in the ink token only. */
function lightBadge(light: Light, label: string) {
  const [dx, dy] = DIR[light], c = 24, r = 15
  const sx = c - dx * r, sy = c - dy * r, ex = c + dx * r, ey = c + dy * r, nx = -dy, ny = dx
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = i * Math.PI / 4
    return `<path d="M${sx + Math.cos(a) * 6} ${sy + Math.sin(a) * 6}L${sx + Math.cos(a) * 9} ${sy + Math.sin(a) * 9}"/>`
  }).join('')
  const b = h('span', { class: 'light-badge', role: 'img', 'aria-label': label })
  b.innerHTML = `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" fill="none" style="stroke:var(--ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="${sx}" cy="${sy}" r="4"/>${rays}<path d="M${sx + dx * 11} ${sy + dy * 11}L${ex} ${ey}"/>
    <path d="M${ex - dx * 6 + nx * 4} ${ey - dy * 6 + ny * 4}L${ex} ${ey}L${ex - dx * 6 - nx * 4} ${ey - dy * 6 - ny * 4}"/></svg>`
  return b
}

function iconBtn(label: string, paths: string, onclick: () => void) {
  const b = h('button', { class: 'icon-btn', 'aria-label': label, title: label, onclick })
  b.innerHTML = icon(paths)
  return b
}

/** #/shadows/<level>/<id>: draw the outline of the shape's shadow. The caller (router) checks that `id` is a views puzzle of `level`. */
export async function mountShadowPuzzle(root: HTMLElement, file: PuzzleFile, level: number, id: string) {
  const e = file.puzzles.find(p => p.id === id)!
  const list = file.puzzles.filter(p => p.set === 'level' && p.level === level)
  const idx = list.indexOf(e), next = list[idx + 1]
  const light = LIGHTS[level - 1], key = `shadow/${level}/${id}`, solvedId = `S${level}-${id}`
  const nextRoute = next ? `#/shadows/${level}/${next.id}` : '#/levels/shadows'
  void saveLast({ kind: 'shadows', level, n: idx + 1, route: `#/shadows/${level}/${id}` })

  const hm = new HeightMap(e.cols, e.rows, e.h)
  const answer = { shape: shadowOutline(shadowCells(hm, light), light, hm), seams: new Set<string>() }
  const shape = computeEdges(hm).shape
  const plane = shadowPlaneBounds(hm, light)
  // the grid frames the plane and the shape above it; the editor only accepts lines on the plane
  const pts = [...shape].flatMap(segEnds)
  const bounds: Bounds = {
    t0: Math.min(plane.t0, ...pts.map(p => p.t)), t1: Math.max(plane.t1, ...pts.map(p => p.t)),
    v0: Math.min(plane.v0, ...pts.map(p => p.m + p.t / 2)), v1: Math.max(plane.v1, ...pts.map(p => p.m + p.t / 2)),
  }
  const saved = await loadDrawing(key)
  const lv = await createLives(key)
  let checked = false, answerOn = false

  const editor = new DrawingEditor(saved ?? { lines: [], fills: {} }, plane, d => {
    saveDrawing(key, d)
    bar.setHistory(editor.canUndo, editor.canRedo)
    if (checked) { checked = false; grid.setOverlay(null); counts.textContent = ''; setNext(false) }
  })

  const top = createTopBar({
    title: S.shadows, subtitle: `${S.level(level)}, ${S.puzzle(idx + 1, list.length, e.cols, e.rows)}`,
    back: '/levels/shadows', lives: lv.el,
    menu: [
      { label: S.clear, onClick: () => { editor.clear(); grid.render() } },
      { label: S.penOnly, pressed: () => penOnly, onClick: () => { penOnly = !penOnly } },
    ],
  })
  const gridEl = h('div', { class: 'vp-grid' })
  const zoom = h('div', { class: 'vp-zoom' },
    iconBtn(S.zoomIn, '<path d="M12 5v14M5 12h14"/>', () => grid.zoomBy(1.25)),
    iconBtn(S.zoomOut, '<path d="M5 12h14"/>', () => grid.zoomBy(0.8)),
    h('button', { class: 'icon-btn fit', text: S.fit, onclick: () => grid.fit() }))
  const counts = h('span', { class: 'vp-counts-text', 'aria-live': 'polite' })
  const bar = createToolBar({
    tool, onTool: t => { tool = t },
    onUndo: () => { editor.undo(); grid.render() },
    onRedo: () => { editor.redo(); grid.render() },
  })
  const ansBtn = h('button', { class: 'btn btn-outline', 'aria-pressed': 'false', text: S.answer, onclick: () => {
    answerOn = !answerOn; checked = false
    if (answerOn) lv.reveal()
    counts.textContent = ''
    ansBtn.setAttribute('aria-pressed', String(answerOn))
    grid.setOverlay(answerOn ? { kind: 'answer', edges: answer.shape } : null)
  } })
  const checkBtn = h('button', { class: 'btn btn-accent', text: S.check, onclick: () => void (checkBtn.dataset.next ? (location.hash = nextRoute) : check()) })
  const setNext = (on: boolean) => {
    checkBtn.textContent = on ? S.next : S.check
    if (on) checkBtn.dataset.next = '1'; else delete checkBtn.dataset.next
  }

  async function check() {
    const result = checkDrawing(new Set(editor.drawing.lines), answer)
    checked = true; answerOn = false; ansBtn.setAttribute('aria-pressed', 'false')
    grid.setOverlay({ kind: 'check', result })
    counts.textContent = result.correct ? S.solved : S.counts(result.missing.size, result.mistakes.size)
    if (!result.correct) {
      if (lv.fail()) { editor.reset(); grid.render(); lv.say(S.outOfLives) }
      return
    }
    setNext(true)
    if (!countsAsSolved(lv.state, lv.on)) return
    await updateProgress(p => p.solved.includes(solvedId) ? p : { ...p, solved: [...p.solved, solvedId] })
  }

  const el = h('div', { class: 'screen vp' }, top,
    h('div', { class: 'vp-body' }, h('div', { class: 'vp-gridwrap' }, gridEl, lightBadge(light, S.lights[level - 1]), zoom)),
    h('div', { class: 'vp-counts' }, counts, lv.notice),
    bar.el,
    h('div', { class: 'action-row' }, ansBtn, checkBtn))
  const layout = () => { const r = root.getBoundingClientRect(); el.classList.toggle('vp--side', r.width > r.height) }
  layout()
  root.append(el)
  bar.setHistory(editor.canUndo, editor.canRedo)

  const grid = createIsoGrid(gridEl, {
    bounds, arrows: false, editor, shape,
    tool: () => tool, colour: () => 1, penOnly: () => penOnly,
    initialView: readView(key), onViewChange: v => writeView(key, v),
  })
  window.addEventListener('resize', layout)

  return {
    editor, grid,
    destroy() { window.removeEventListener('resize', layout); grid.destroy(); el.remove() },
  }
}
