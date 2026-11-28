import { DrawingEditor, type Bounds } from '../../core/drawing'
import { createToolBar, FREE_TOOLS } from '../components/toolBar'
import { createTopBar } from '../components/topBar'
import { h, icon } from '../dom'
import { download, exportName, exportPng, exportSvg } from '../exportImage'
import { createIsoGrid, type Tool } from '../grid/IsoGrid'
import { deleteDrawing, listDrawings, loadDrawing, saveDrawing } from '../storage'
import { S } from '../strings'

const bounds: Bounds = { t0: -30, t1: 30, v0: -20, v1: 20 }
const DRAW_SCALE = 40 // px per grid step on open: finger-sized cells (owner checks on the Pixel 7)
let tool: Tool = 'line', colour = 1, penOnly = false

/** #/draw: saved drawings, New, rename, delete. */
export async function mountDrawList(root: HTMLElement) {
  const list = h('ul', { class: 'draw-list' })
  const btn = (label: string, attr: string, onclick: () => void) => h('button', { class: 'btn btn-outline', [attr]: true, text: label, onclick })
  async function refresh() {
    const rows = []
    for (const key of await listDrawings('draw/')) {
      const name = (await loadDrawing(key))?.name ?? key.slice(5)
      rows.push(h('li', { class: 'draw-row' },
        h('a', { href: '#/' + key, text: name }),
        btn(S.rename, 'data-rename', async () => {
          const n = prompt(S.renamePrompt, name)?.trim()
          const d = await loadDrawing(key)
          if (n && d) { saveDrawing(key, { ...d, name: n }); await refresh() }
        }),
        btn(S.del, 'data-delete', async () => {
          if (!confirm(S.deleteConfirm(name))) return
          await deleteDrawing(key); await refresh()
        })))
    }
    list.replaceChildren(...rows)
  }
  await refresh()
  const el = h('div', { class: 'screen' }, createTopBar({ title: S.draw, back: '/' }), list,
    h('div', { class: 'action-row' }, h('button', { class: 'btn btn-accent btn-full', 'data-new': true, text: S.newDrawing, onclick: async () => {
      const key = 'draw/' + crypto.randomUUID()
      saveDrawing(key, { lines: [], fills: {}, name: S.drawingN((await listDrawings('draw/')).length + 1) })
      location.hash = '#/' + key
    } })))
  root.append(el)
  return { destroy: () => el.remove() }
}

const iconBtn = (label: string, paths: string, onclick: () => void) => {
  const b = h('button', { class: 'icon-btn', 'aria-label': label, title: label, onclick })
  b.innerHTML = icon(paths)
  return b
}

/** #/draw/<id>: free drawing on the isometric grid, no puzzle and no lock. */
export async function mountDrawing(root: HTMLElement, id: string) {
  const key = 'draw/' + id
  const saved = await loadDrawing(key)
  let name = saved?.name ?? id
  const editor = new DrawingEditor(saved ?? { lines: [], fills: {} }, bounds, d => {
    saveDrawing(key, { ...d, name })
    bar.setHistory(editor.canUndo, editor.canRedo)
  })
  const gridEl = h('div', { class: 'vp-grid' })
  const zoom = h('div', { class: 'vp-zoom' },
    iconBtn(S.zoomIn, '<path d="M12 5v14M5 12h14"/>', () => grid.zoomBy(1.25)),
    iconBtn(S.zoomOut, '<path d="M5 12h14"/>', () => grid.zoomBy(0.8)),
    h('button', { class: 'icon-btn fit', text: S.fit, 'aria-label': S.fitHint, title: S.fitHint, onclick: () => grid.fit() }))
  const swatches = Array.from({ length: 15 }, (_, i) => i + 1).map(n => h('button', {
    class: 'swatch', 'aria-label': n <= 3 ? S.tone(n) : S.palette(n), style: `--swatch: var(--${n <= 3 ? 'tone-' + n : 'palette-' + n})`,
    onclick: () => { colour = n; tool = 'fill'; bar.setTool(tool); sync(); grid.render() },
  }))
  const sync = () => swatches.forEach((b, i) => b.setAttribute('aria-pressed', String(i + 1 === colour)))
  const bar = createToolBar({ tool, tools: FREE_TOOLS, onTool: t => { tool = t; grid.render() }, onUndo: () => { editor.undo(); grid.render() }, onRedo: () => { editor.redo(); grid.render() } })
  const svg = () => exportSvg(editor.drawing, grid.getView())
  const el = h('div', { class: 'screen vp' },
    createTopBar({ title: name, back: '/draw', menu: [
      { label: S.clear, onClick: () => { editor.clear(); grid.render() } },
      { label: S.penOnly, pressed: () => penOnly, onClick: () => { penOnly = !penOnly } },
    ] }),
    h('div', { class: 'vp-body' }, h('div', { class: 'vp-gridwrap' }, gridEl, zoom)),
    h('div', { class: 'vp-counts' }, h('span', { class: 'swatches draw-palette' }, ...swatches)),
    bar.el,
    h('div', { class: 'draw-export' },
      h('button', { class: 'btn btn-outline', text: S.exportSvg, onclick: () => download(svg(), exportName(name, 'svg')) }),
      h('button', { class: 'btn btn-outline', text: S.exportPng, onclick: async () => download(await exportPng(svg(), 2), exportName(name, 'png')) })))
  root.append(el)
  sync(); bar.setHistory(editor.canUndo, editor.canRedo)
  const grid = createIsoGrid(gridEl, {
    bounds, arrows: false, free: { half: false, mids: true, radii: [3, 2.5, 2, 1.5, 1, 0.5], cut: true }, editor, tool: () => tool, colour: () => colour, penOnly: () => penOnly,
  })
  grid.zoomBy(DRAW_SCALE / grid.getView().scale)
  return { grid, destroy() { grid.destroy(); el.remove() } }
}
