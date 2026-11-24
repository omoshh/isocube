import { h, icon } from '../dom'
import { S } from '../strings'

export type MenuItem = { label: string; onClick(): void; pressed?: () => boolean }

const BACK = icon('<path d="M15 5l-7 7 7 7"/>')
const MORE = icon('<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>')

/** 60px bar: back link (to `back`, a route like '/levels/views'), title + subtitle, optional more menu. */
export function createTopBar(o: { title: string; subtitle?: string; back: string; menu?: MenuItem[] }): HTMLElement {
  const back = h('a', { class: 'icon-btn', href: '#' + o.back, 'aria-label': S.back })
  back.innerHTML = BACK
  const bar = h('header', { class: 'top-bar' }, back,
    h('div', { class: 'top-titles' }, h('h1', { text: o.title }), ...(o.subtitle ? [h('p', { text: o.subtitle })] : [])))
  if (o.menu) {
    const summary = h('summary', { class: 'icon-btn', 'aria-label': S.more })
    summary.innerHTML = MORE
    const menu = h('details', { class: 'more' }, summary)
    const list = h('div', { class: 'more-list', role: 'menu' })
    for (const m of o.menu) {
      const b = h('button', { role: m.pressed ? 'menuitemcheckbox' : 'menuitem', text: m.label })
      const sync = () => m.pressed && b.setAttribute('aria-checked', String(m.pressed()))
      sync()
      b.addEventListener('click', () => { m.onClick(); sync(); menu.open = false })
      list.append(b)
    }
    menu.append(list)
    bar.append(menu)
  }
  return bar
}
