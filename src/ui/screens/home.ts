import { solvedCount } from '../../core/unlocks'
import { glyph } from '../components/glyph'
import { h, icon } from '../dom'
import { listDrawings, loadLast, loadProgress } from '../storage'
import { APP_NAME, S } from '../strings'

const SETTINGS = icon('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>')
const PLAY = icon('<path d="M8 5l11 7-11 7z"/>')

/** #/: header, solved total, Continue pill (only with a last puzzle) and one tile per mode with its count. */
export async function mountHome(root: HTMLElement) {
  const [p, last, drawings] = await Promise.all([loadProgress(), loadLast(), listDrawings('draw/')])
  const reverse = p.solved.filter(s => s.startsWith('R-')).length
  const tile = (key: string, href: string, name: string, desc: string, count: number, ...extra: Node[]) =>
    h('a', { class: 'home-tile', 'data-tile': key, href },
      h('div', {}, h('div', { class: 'tile-title', text: name }), h('div', { class: 'tile-desc', text: desc })),
      ...extra, h('div', { class: 'tile-big', text: count }))
  const settings = h('a', { class: 'home-round', href: '#/settings', 'aria-label': S.settings })
  settings.innerHTML = SETTINGS
  const play = h('span', { class: 'home-play' })
  play.innerHTML = PLAY
  const label = last && S.lastLabel(S[last.kind], last.level, last.n ? S.puzzleN(last.n) : last.kind === 'nets' || last.kind === 'sections' ? '' : S.endlessLower)
  const el = h('main', { class: 'screen home' },
    h('header', { class: 'home-head' }, h('h1', {}, glyph(), APP_NAME), settings),
    h('div', { class: 'home-count' }, h('div', { class: 'home-total', text: solvedCount(p) }), h('div', { class: 'home-solved', text: S.solvedLabel })),
    ...(last ? [h('a', { class: 'home-continue', href: last.route }, h('div', { style: 'flex:1' }, h('div', { class: 'tile-desc', text: S.continue }), h('div', { class: 'home-last', text: label })), play)] : []),
    h('nav', { class: 'home-tiles' },
      tile('views', '#/levels/views', S.views, S.viewsDesc, p.solved.length - reverse, glyph(72)),
      tile('reverse', '#/levels/reverse', S.reverse, S.reverseDesc, reverse),
      tile('nets', '#/nets/1', S.nets, S.netsDesc, p.netsRight),
      tile('draw', '#/draw', S.draw, S.drawDesc, drawings.length)))
  root.append(el)
  return { destroy: () => el.remove() }
}
