import { countsAsSolved } from '../../core/lives'
import { checkDrawing } from '../../core/checker'
import { DrawingEditor, type Bounds } from '../../core/drawing'
import type { Line, Pt } from '../../core/geometry'
import type { PuzzleFile } from '../../core/generator'
import { HeightMap } from '../../core/shape'
import { shadowCells, shadowOutline, shadowPlaneBounds, shadowPlaneCorners, type Light } from '../../core/shadows'
import { createLives } from '../components/lives'
import { createToolBar } from '../components/toolBar'
import { createTopBar } from '../components/topBar'
import { h, icon } from '../dom'
import { createIsoGrid, type Tool } from '../grid/IsoGrid'
import { shapePicture } from '../shapePicture'
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

// Light travel on screen (y down), from proj: down is -z; front travels +y (up-left toward the back wall), side +x (up-right toward the side wall).
// The slant (1,1,-1) is the view axis and projects to a point, so it gets a caption instead of an arrow.
const DIR: Partial<Record<Light, [number, number]>> = { down: [0, 1], front: [-0.87, -0.5], side: [0.87, -0.5] }

/** A small sun with an arrow showing which way the light travels. Drawn in the ink token only. */
function lightBadge(light: Light, label: string) {
  const dir = DIR[light], [dx, dy] = dir ?? [0, 0], c = 24, r = dir ? 15 : 0
  const sx = c - dx * r, sy = c - dy * r, ex = c + dx * r, ey = c + dy * r, nx = -dy, ny = dx
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = i * Math.PI / 4
    return `<path d="M${sx + Math.cos(a) * 6} ${sy + Math.sin(a) * 6}L${sx + Math.cos(a) * 9} ${sy + Math.sin(a) * 9}"/>`
  }).join('')
  const b = h('span', { class: 'light-badge', role: 'img', 'aria-label': label })
  b.innerHTML = `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" fill="none" style="stroke:var(--ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="${sx}" cy="${sy}" r="4"/>${rays}${dir ? `<path d="M${sx + dx * 11} ${sy + dy * 11}L${ex} ${ey}"/>
    <path d="M${ex - dx * 6 + nx * 4} ${ey - dy * 6 + ny * 4}L${ex} ${ey}L${ex - dx * 6 - nx * 4} ${ey - dy * 6 - ny * 4}"/>` : ''}</svg>`
  return b
}

function iconBtn(label: string, paths: string, onclick: () => void) {
  const b = h('button', { class: 'icon-btn', 'aria-label': label, title: label, onclick })
  b.innerHTML = icon(paths)
  return b
}

/** An editor that only accepts lines with both ends on the target plane (its boundary counts as inside). */
class PlaneEditor extends DrawingEditor {
  constructor(private quad: Pt[], ...a: ConstructorParameters<typeof DrawingEditor>) { super(...a) }
  private inside(p: Pt) {
    const q = this.quad, sign = Math.sign(cross(q[0], q[1], q[2]))
    return q.every((a, i) => cross(a, q[(i + 1) % q.length], p) * sign >= -1e-9)
  }
  addLines(ls: Line[]) { super.addLines(ls.filter(l => this.inside(l.a) && this.inside(l.b))) }
}
const cross = (a: Pt, b: Pt, c: Pt) => (b.t - a.t) * (c.m - a.m) - (b.m - a.m) * (c.t - a.t)

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
  const corners = shadowPlaneCorners(hm, light)
  const plane = shadowPlaneBounds(hm, light), bounds: Bounds = plane // the figure has its own area, so the field frames only the plane
  const saved = await loadDrawing(key)
  const lv = await createLives(key)
  let checked = false, answerOn = false

  const editor = new PlaneEditor(corners, saved ?? { lines: [], fills: {} }, plane, d => {
    saveDrawing(key, d)
    bar.setHistory(editor.canUndo, editor.canRedo)
    if (checked) { checked = false; grid.setOverlay(null); counts.textContent = ''; setNext(false) }
  })

  const top = createTopBar({
    title: S.shadows, subtitle: `${S.level(level)}, ${S.puzzle(idx + 1, list.length, e.cols, e.rows, e.maxH)}`,
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
    h('button', { class: 'icon-btn fit', text: S.fit, 'aria-label': S.fitHint, title: S.fitHint, onclick: () => grid.fit() }))
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
    h('div', { class: 'vp-body' },
      h('figure', { class: 'sp-figure' }, shapePicture(hm), lightBadge(light, light === 'slant' ? `${S.lights[3]}. ${S.slantRule}` : S.lights[level - 1])),
      h('div', { class: 'vp-gridwrap' }, gridEl, zoom)),
    ...(light === 'slant' ? [h('p', { class: 'light-caption', text: S.slantRule })] : []),
    h('div', { class: 'vp-counts' }, counts, lv.notice),
    bar.el,
    h('div', { class: 'action-row' }, ansBtn, checkBtn))
  const layout = () => { const r = root.getBoundingClientRect(); el.classList.toggle('vp--side', r.width > r.height) }
  layout()
  root.append(el)
  bar.setHistory(editor.canUndo, editor.canRedo)

  const grid = createIsoGrid(gridEl, {
    bounds, arrows: false, editor, plane: corners,
    tool: () => tool, colour: () => 1, penOnly: () => penOnly,
    initialView: readView(key), onViewChange: v => writeView(key, v),
  })
  window.addEventListener('resize', layout)

  return {
    editor, grid,
    destroy() { window.removeEventListener('resize', layout); grid.destroy(); el.remove() },
  }
}
