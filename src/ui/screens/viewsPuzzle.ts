import { countsAsSolved } from '../../core/lives'
import { checkDrawing } from '../../core/checker'
import { DrawingEditor, type Bounds } from '../../core/drawing'
import type { PuzzleFile } from '../../core/generator'
import { computeEdges, HeightMap } from '../../core/shape'
import { rotate180 } from '../../core/visibility'
import { turnButton } from './reversePuzzle'
import { createLives } from '../components/lives'
import { createToolBar } from '../components/toolBar'
import { createTopBar } from '../components/topBar'
import { createViewsPanel } from '../components/viewsPanel'
import { h, icon } from '../dom'
import { createIsoGrid, type Tool } from '../grid/IsoGrid'
import type { View } from '../grid/transform'
import { loadDrawing, saveDrawing, saveLast, updateProgress } from '../storage'
import { S } from '../strings'

// kept across puzzles for the session
let tool: Tool = 'line', colour = 1, penOnly = false

const readView = (id: string): View | undefined => {
  try { const s = sessionStorage.getItem('view/' + id); return s ? JSON.parse(s) : undefined } catch { return undefined }
}
const writeView = (id: string, v: View) => { try { sessionStorage.setItem('view/' + id, JSON.stringify(v)) } catch { /* view is a convenience */ } }

function iconBtn(label: string, paths: string, onclick: () => void) {
  const b = h('button', { class: 'icon-btn', 'aria-label': label, title: label, onclick })
  b.innerHTML = icon(paths)
  return b
}

/** What the puzzle screen needs. `id` is the solved id, `key` the drawing key (also keys the saved zoom/pan). */
export type Puzzle = { id: string; key: string; cols: number; rows: number; maxH: number; h: number[]; title: string; subtitle: string; nextRoute: string }

/** #/views/<id>. `id` must exist in the file (the router checks). */
export function mountViewsPuzzle(root: HTMLElement, file: PuzzleFile, id: string) {
  const e = file.puzzles.find(p => p.id === id)!
  const list = file.puzzles.filter(p => p.set === e.set && p.level === e.level)
  const idx = list.indexOf(e), next = list[idx + 1]
  void saveLast({ kind: 'views', level: e.level, n: idx + 1, route: '#/views/' + id })
  return mountPuzzle(root, {
    id, key: 'views/' + id, cols: e.cols, rows: e.rows, maxH: e.maxH, h: e.h,
    title: S.level(e.level),
    subtitle: S.puzzle(idx + 1, list.length, e.cols, e.rows),
    nextRoute: next ? '#/views/' + next.id : '#/levels/views',
  })
}

/** The views puzzle screen for any puzzle: level sets and endless. */
export async function mountPuzzle(root: HTMLElement, e: Puzzle) {
  const { id, key } = e
  const hm = new HeightMap(e.cols, e.rows, e.h), answer = computeEdges(hm), backEdges = computeEdges(rotate180(hm)).shape
  // the guide box (cube origin at 0,0,0) plus margin, as on the reference page
  const bounds: Bounds = { t0: -e.rows - 3, t1: e.cols + 3, v0: -2.6, v1: (e.cols + e.rows) / 2 + e.maxH + 1.5 }
  const saved = await loadDrawing(key)
  const lv = await createLives(key)
  let checked = false, answerOn = false

  const editor = new DrawingEditor(saved ?? { lines: [], fills: {} }, bounds, d => {
    saveDrawing(key, d)
    bar.setHistory(editor.canUndo, editor.canRedo)
    if (checked) { checked = false; grid.setOverlay(null); counts.textContent = ''; setNext(false) }
  })

  const top = createTopBar({
    title: e.title,
    subtitle: e.subtitle,
    back: '/levels/views', lives: lv.el,
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
  // the answer seen from the back; only while Answer is on
  const turn = turnButton(back => grid.setOverlay({ kind: 'answer', edges: back ? backEdges : answer.shape }))
  turn.el.hidden = true
  zoom.append(turn.el)
  const answerOff = () => { turn.el.hidden = true; turn.el.setAttribute('aria-pressed', 'false') }
  const counts = h('span', { class: 'vp-counts-text', 'aria-live': 'polite' })
  const swatches = [1, 2, 3].map(n => h('button', {
    class: 'swatch', 'aria-label': S.tone(n), style: `--swatch: var(--tone-${n})`,
    onclick: () => { colour = n; tool = 'fill'; bar.setTool(tool); syncSwatches() },
  }))
  const syncSwatches = () => swatches.forEach((b, i) => b.setAttribute('aria-pressed', String(i + 1 === colour)))
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
    answerOff(); turn.el.hidden = !answerOn
    grid.setOverlay(answerOn ? { kind: 'answer', edges: answer.shape } : null)
  } })
  const checkBtn = h('button', { class: 'btn btn-accent', text: S.check, onclick: () => void (checkBtn.dataset.next ? goNext() : check()) })
  const setNext = (on: boolean) => {
    checkBtn.textContent = on ? S.next : S.check
    if (on) checkBtn.dataset.next = '1'; else delete checkBtn.dataset.next
  }
  const goNext = () => { location.hash = e.nextRoute }

  async function check() {
    const result = checkDrawing(new Set(editor.drawing.lines), answer)
    checked = true; answerOn = false; ansBtn.setAttribute('aria-pressed', 'false'); answerOff()
    grid.setOverlay({ kind: 'check', result })
    counts.textContent = result.correct ? S.solved : S.counts(result.missing.size, result.mistakes.size)
    if (!result.correct) {
      if (lv.fail()) { editor.reset(); grid.render(); lv.say(S.outOfLives) }
      return
    }
    setNext(true)
    if (!countsAsSolved(lv.state, lv.on)) return
    await updateProgress(p => p.solved.includes(id) ? p : { ...p, solved: [...p.solved, id] })
  }

  const el = h('div', { class: 'screen vp' }, top,
    h('div', { class: 'vp-body' }, createViewsPanel(hm, e.maxH), h('div', { class: 'vp-gridwrap' }, gridEl, zoom)),
    h('div', { class: 'vp-counts' }, counts, lv.notice, h('span', { class: 'swatches' }, ...swatches)),
    bar.el,
    h('div', { class: 'action-row' }, ansBtn, checkBtn))
  const layout = () => { const r = root.getBoundingClientRect(); el.classList.toggle('vp--side', r.width > r.height) }
  layout()
  root.append(el)
  syncSwatches()
  bar.setHistory(editor.canUndo, editor.canRedo)

  const grid = createIsoGrid(gridEl, {
    bounds, guide: { cols: e.cols, rows: e.rows, maxH: e.maxH }, arrows: true, editor,
    tool: () => tool, colour: () => colour, penOnly: () => penOnly,
    initialView: readView(key), onViewChange: v => writeView(key, v),
  })
  window.addEventListener('resize', layout)

  return {
    editor,
    destroy() { window.removeEventListener('resize', layout); grid.destroy(); el.remove() },
  }
}
