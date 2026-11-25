import { ACCENTS, accentUnlocked, hiddenAccents, nextAccent, solvedCount } from '../../core/unlocks'
import { createTopBar } from '../components/topBar'
import { h, icon } from '../dom'
import { loadProgress, loadSettings, saveSettings } from '../storage'
import { S } from '../strings'
import { applyTheme } from '../theme'

const LOCK = icon('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>')

/** #/settings/accent: one row per accent; locked rows are disabled. */
export async function mountAccents(root: HTMLElement) {
  const [progress, settings] = await Promise.all([loadProgress(), loadSettings()])
  const solved = solvedCount(progress)
  const list = h('div', { class: 'accent-list' })
  const hidden = hiddenAccents(settings.style, document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  for (const a of ACCENTS.filter(x => !hidden.includes(x.id))) {
    const open = accentUnlocked(a.id, solved, settings.unlockAll)
    const status = h('span', { class: 'accent-status' })
    if (settings.accent === a.id) status.textContent = S.selected
    else if (open) status.textContent = S.unlocked
    else { status.innerHTML = LOCK; status.append(S.needSolved(a.threshold)) }
    const rowEl = h('button', { class: 'accent-row', 'data-accent': a.id, 'aria-disabled': open ? undefined : 'true', 'aria-pressed': String(settings.accent === a.id),
      onclick: async () => {
        if (!open) return
        const s = { ...(await loadSettings()), accent: a.id }
        await saveSettings(s); applyTheme(s)
        for (const r of list.children) r.setAttribute('aria-pressed', String(r === rowEl))
      } },
      h('span', { class: 'accent-dot', style: `background:var(--accent-${a.id})` }), h('span', { class: 'accent-name', text: a.name }), status)
    list.append(rowEl)
  }
  const next = settings.unlockAll ? null : nextAccent(solved)
  const el = h('div', { class: 'screen' }, createTopBar({ title: S.accents, back: '/settings' }),
    h('main', { class: 'settings-body' }, list,
      ...(next ? [h('p', { class: 'hint', text: S.moreToUnlock(next.left, ACCENTS.find(x => x.id === next.id)!.name) })] : [])))
  root.append(el)
  return { destroy: () => el.remove() }
}
