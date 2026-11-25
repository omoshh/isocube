import { START, loseLife, reveal, type LivesState } from '../../core/lives'
import { h } from '../dom'
import { loadLives, loadSettings, saveLives } from '../storage'
import { S } from '../strings'

export type LivesCtl = {
  on: boolean
  state: LivesState
  /** Top-bar marks; undefined when lives are off. */
  el?: HTMLElement
  /** A status line for the restart message. */
  notice: HTMLElement
  /** Loses a life; true when that was the last one (state is back to 3 lives). No-op when off. */
  fail(): boolean
  /** Answer shown: the puzzle no longer counts as solved. */
  reveal(): void
  say(text: string): void
}

/** Lives for one puzzle: `key` is its drawing key (nets: `nets/<level>/<seed>`), stored as `lives/<key>`. */
export async function createLives(key: string): Promise<LivesCtl> {
  const on = (await loadSettings()).lives
  const notice = h('p', { class: 'lives-note', role: 'status' })
  let timer: ReturnType<typeof setTimeout> | undefined
  const marks = [0, 1, 2].map(() => h('span', { class: 'life' }))
  const ctl: LivesCtl = {
    on, state: on ? await loadLives(key) : START, notice,
    el: on ? h('span', { class: 'lives' }, ...marks) : undefined,
    fail() {
      if (!ctl.on) return false
      const r = loseLife(ctl.state)
      set(r.state)
      return r.restart
    },
    reveal() { if (ctl.on && !ctl.state.revealed) set(reveal(ctl.state)) },
    say(text) {
      notice.textContent = text
      clearTimeout(timer)
      timer = setTimeout(() => { notice.textContent = '' }, 3000)
    },
  }
  function set(s: LivesState) {
    ctl.state = s
    void saveLives(key, s)
    paint()
  }
  function paint() {
    ctl.el?.setAttribute('aria-label', S.livesLabel(ctl.state.left))
    marks.forEach((m, i) => m.toggleAttribute('data-lost', i >= ctl.state.left))
  }
  if (ctl.el) { ctl.el.setAttribute('role', 'img'); paint() }
  return ctl
}
