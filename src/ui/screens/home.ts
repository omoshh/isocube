import { solvedCount } from '../../core/unlocks'
import { h } from '../dom'
import { loadProgress } from '../storage'
import { APP_NAME, S } from '../strings'

/** #/: app name, solved count and one button per mode. */
export async function mountHome(root: HTMLElement) {
  const n = solvedCount(await loadProgress())
  const link = (href: string, text: string) => h('a', { class: 'btn btn-outline', href, text })
  const el = h('main', { class: 'screen home' },
    h('h1', { text: APP_NAME }), h('p', { class: 'home-solved', text: S.solvedTotal(n) }),
    h('nav', {}, link('#/levels/views', S.views), link('#/levels/reverse', S.reverse), link('#/nets/1', S.nets),
      link('#/draw', S.draw), link('#/settings', S.settings)))
  root.append(el)
  return { destroy: () => el.remove() }
}
