import { checkViews } from '../../core/checker'
import type { PuzzleFile } from '../../core/generator'
import { HeightMap } from '../../core/shape'
import { viewLabels, viewLines, type ViewSet } from '../../core/views'
import { createLives } from '../components/lives'
import { keyPicture } from '../components/keyPicture'
import { createTopBar } from '../components/topBar'
import { turnablePicture } from '../shapePicture'
import { h } from '../dom'
import { createSquareGrid } from '../grid/SquareGrid'
import type { View } from '../grid/transform'
import { loadDrawing, saveDrawing, saveLast, updateProgress } from '../storage'
import { S } from '../strings'
import type { Puzzle } from './viewsPuzzle'

type V = keyof ViewSet
const VIEWS: V[] = ['top', 'side', 'front'] // the page's order after KEY
let penOnly = false // kept across puzzles for the session

/** #/reverse/<id> for a level id (the router checks it exists). Solved as R-<id>. */
export function mountReversePuzzle(root: HTMLElement, file: PuzzleFile, id: string) {
  const e = file.puzzles.find(p => p.id === id)!
  const list = file.puzzles.filter(p => p.set === e.set && p.level === e.level)
  const idx = list.indexOf(e), next = list[idx + 1]
  void saveLast({ kind: 'reverse', level: e.level, n: idx + 1, route: '#/reverse/' + id })
  return mountReverse(root, {
    id: 'R-' + id, key: 'reverse/' + id, cols: e.cols, rows: e.rows, maxH: e.maxH, h: e.h,
    title: `${S.reverse}: ${S.level(e.level).toLowerCase()}`,
    subtitle: S.puzzle(idx + 1, list.length, e.cols, e.rows, e.maxH),
    nextRoute: next ? '#/reverse/' + next.id : '#/levels/reverse',
  })
}

/** The reverse puzzle screen: the shaded shape, then TOP / SIDE / FRONT square grids in the level's frame (height maxH). */
export async function mountReverse(root: HTMLElement, e: Puzzle) {
  const { id, key } = e
  const hm = new HeightMap(e.cols, e.rows, e.h), l = viewLabels(hm, e.maxH)
  // the same frame as the grids: views(hm) would use the shape's own height and shift low shapes
  const answer: ViewSet = { top: viewLines(l.top), front: viewLines(l.front), side: viewLines(l.side) }
  const size: Record<V, [number, number]> = { top: [e.cols, e.rows], front: [e.cols, e.maxH], side: [e.rows, e.maxH] }
  const saved = (await loadDrawing(key))?.lines ?? []
  const drawn = Object.fromEntries(VIEWS.map(v => [v, new Set(saved.filter(k => k.startsWith(v + ':')).map(k => k.slice(v.length + 1)))])) as ViewSet
  let checked = false
  const lv = await createLives(key)

  const cell = () => ({ grid: h('div', { class: 'rv-grid' }), count: h('span', { class: 'rv-count', 'aria-live': 'polite' }) })
  const cells = { top: cell(), front: cell(), side: cell() }
  const grids = {} as Record<V, ReturnType<typeof createSquareGrid>>

  const changed = () => {
    saveDrawing(key, { lines: VIEWS.flatMap(v => [...drawn[v]].map(k => v + ':' + k)), fills: {} })
    if (!checked) return
    checked = false; setNext(false)
    for (const v of VIEWS) { grids[v].setResult(null); cells[v].count.textContent = '' }
  }
  const viewKey = (v: V) => `view/reverse/${id}/${v}`
  const readView = (v: V): View | undefined => { try { const s = sessionStorage.getItem(viewKey(v)); return s ? JSON.parse(s) : undefined } catch { return undefined } }
  const writeView = (v: V, w: View) => { try { sessionStorage.setItem(viewKey(v), JSON.stringify(w)) } catch { /* convenience */ } }
  const makeGrid = (v: V) => {
    const view = grids[v]?.getView() ?? readView(v)
    grids[v]?.destroy()
    grids[v] = createSquareGrid(cells[v].grid, {
      cols: size[v][0], rows: size[v][1], lines: drawn[v], penOnly: () => penOnly, initialView: view, onViewChange: w => writeView(v, w),
      onChange: lines => { drawn[v] = lines; changed() },
    })
  }
  /** Replace one view's lines (Clear, tests). */
  const setLines = (v: V, lines: Set<string>) => { drawn[v] = new Set(lines); makeGrid(v); changed() }

  const top = createTopBar({
    title: e.title, subtitle: e.subtitle, back: '/levels/reverse', lives: lv.el,
    menu: [
      { label: S.clear, onClick: () => VIEWS.forEach(v => setLines(v, new Set())) },
      { label: S.penOnly, pressed: () => penOnly, onClick: () => { penOnly = !penOnly } },
    ],
  })
  const checkBtn = h('button', { class: 'btn btn-accent', text: S.check, onclick: () => void (checkBtn.dataset.next ? (location.hash = e.nextRoute) : check()) })
  const setNext = (on: boolean) => {
    checkBtn.textContent = on ? S.next : S.check
    if (on) checkBtn.dataset.next = '1'; else delete checkBtn.dataset.next
  }

  async function check() {
    const r = checkViews(drawn, answer)
    checked = true
    for (const v of VIEWS) {
      grids[v].setResult(r[v])
      cells[v].count.textContent = r[v].correct ? S.solved : S.counts(r[v].missing.size, r[v].mistakes.size)
    }
    if (!r.correct) {
      if (lv.fail()) { VIEWS.forEach(v => setLines(v, new Set())); lv.say(S.outOfLives) }
      return
    }
    setNext(true)
    await updateProgress(p => p.solved.includes(id) ? p : { ...p, solved: [...p.solved, id] })
  }

  const label = { top: S.top, front: S.front, side: S.side }
  const shapeCell = h('figure', { class: 'rv-cell rv-shape' }, ...turnablePicture(hm), h('div', { class: 'key-badge' }, keyPicture()))
  const el = h('div', { class: 'screen rv' }, top,
    lv.notice,
    h('main', { class: 'rv-body' },
      shapeCell,
      ...VIEWS.map(v => h('figure', { class: 'rv-cell rv-view', 'data-view': v },
        h('figcaption', {}, h('span', { text: label[v] }), cells[v].count), cells[v].grid))),
    h('div', { class: 'action-row' },
      h('button', { class: 'btn btn-outline', text: S.fitAll, onclick: () => VIEWS.forEach(v => grids[v].fit()) }), checkBtn))
  root.append(el)
  VIEWS.forEach(makeGrid)

  return {
    drawn, setLines,
    destroy() { VIEWS.forEach(v => grids[v].destroy()); el.remove() },
  }
}
