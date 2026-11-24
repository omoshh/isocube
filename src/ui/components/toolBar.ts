import type { Tool } from '../grid/IsoGrid'
import { h, icon } from '../dom'
import { S } from '../strings'

const ICONS: Record<Tool | 'undo' | 'redo', string> = {
  line: icon('<path d="M5 19L19 5"/><circle cx="5" cy="19" r="1.5"/><circle cx="19" cy="5" r="1.5"/>'),
  freehand: icon('<path d="M4 17c3-6 5 2 8-4s5 2 8-4"/>'),
  fill: icon('<path d="M5 11l7-7 7 7-7 7z"/><path d="M19 15c1 2 1.5 3 0 4s-2-1 0-4"/>'),
  erase: icon('<path d="M9 19h11"/><path d="M4 15l9-9 5 5-8 8H8z"/>'),
  undo: icon('<path d="M9 7L4 12l5 5"/><path d="M4 12h11a5 5 0 0 1 0 10h-2"/>'),
  redo: icon('<path d="M15 7l5 5-5 5"/><path d="M20 12H9a5 5 0 0 0 0 10h2"/>'),
}
const TOOLS: Tool[] = ['line', 'freehand', 'fill', 'erase']

function iconBtn(name: keyof typeof ICONS, label: string, onclick: () => void) {
  const b = h('button', { class: 'icon-btn', 'aria-label': label, title: label, onclick })
  b.innerHTML = ICONS[name]
  return b
}

/** Line, Freehand, Fill, Erase · Undo, Redo. The selected tool has aria-pressed="true". */
export function createToolBar(o: { tool: Tool; onTool(t: Tool): void; onUndo(): void; onRedo(): void }) {
  const tools = TOOLS.map(t => iconBtn(t, S[t], () => { setTool(t); o.onTool(t) }))
  const undo = iconBtn('undo', S.undo, o.onUndo), redo = iconBtn('redo', S.redo, o.onRedo)
  const el = h('nav', { class: 'tool-bar' }, ...tools, h('span', { class: 'divider' }), undo, redo)
  function setTool(t: Tool) { tools.forEach((b, i) => b.setAttribute('aria-pressed', String(TOOLS[i] === t))) }
  setTool(o.tool)
  return {
    el, setTool,
    setHistory(canUndo: boolean, canRedo: boolean) { undo.disabled = !canUndo; redo.disabled = !canRedo },
  }
}
