import type { HeightMap } from '../../core/shape'
import { viewLabels, viewLines, type Labels } from '../../core/views'
import { mk } from '../grid/gestures'
import { h } from '../dom'
import { S } from '../strings'
import { keyPicture } from './keyPicture'

let folded = false // kept across puzzles for the session

/** One view (port of viewSVG): filled cells, dashed cell grid, thick plane lines. */
function viewSVG(L: Labels, title: string): HTMLElement {
  const W = L.length, H = L[0].length, pad = 0.15
  const svg = mk('svg', { viewBox: `${-pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad}`, role: 'img', 'aria-label': title })
  for (let i = 0; i < W; i++) for (let j = 0; j < H; j++)
    if (L[i][j] >= 0) mk('rect', { x: i, y: H - 1 - j, width: 1, height: 1, class: 'vcell' }, svg)
  for (let i = 0; i <= W; i++) mk('line', { x1: i, y1: 0, x2: i, y2: H, class: 'vgrid' }, svg)
  for (let j = 0; j <= H; j++) mk('line', { x1: 0, y1: j, x2: W, y2: j, class: 'vgrid' }, svg)
  for (const k of viewLines(L)) {
    const [[x1, y1], [x2, y2]] = k.split('|').map(p => p.split(':').map(Number))
    mk('line', { x1, y1, x2, y2, class: 'vline' }, svg)
  }
  return h('figure', { class: 'view' }, svg, h('figcaption', { text: title }))
}

function keyView(): HTMLElement {
  return h('figure', { class: 'view' }, keyPicture(), h('figcaption', { text: S.key }))
}

/** 2×2 views (KEY, TOP / SIDE, FRONT as the page orders them) with a HIDE VIEWS toggle; folded shows a KEY badge. */
export function createViewsPanel(hm: HeightMap, maxH: number): HTMLElement {
  const l = viewLabels(hm, maxH)
  const views = h('div', { class: 'views' }, keyView(), viewSVG(l.top, S.top), viewSVG(l.side, S.side), viewSVG(l.front, S.front))
  const badge = h('div', { class: 'key-badge' }, keyPicture())
  const toggle = h('button', { class: 'fold' })
  const panel = h('section', { class: 'views-panel' }, views, badge, toggle)
  const sync = () => {
    panel.classList.toggle('folded', folded)
    toggle.textContent = folded ? S.showViews : S.hideViews
    toggle.setAttribute('aria-expanded', String(!folded))
  }
  toggle.addEventListener('click', () => { folded = !folded; sync() })
  sync()
  return panel
}
