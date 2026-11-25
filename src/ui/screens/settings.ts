import pkg from '../../../package.json'
import { ACCENTS, STYLES, LINE_WIDTHS, accentUnlocked, solvedCount, type Settings } from '../../core/unlocks'
import { createTopBar } from '../components/topBar'
import { h } from '../dom'
import { exportBackup, importBackup, loadProgress, loadSettings, saveSettings, storageAvailable } from '../storage'
import { APP_NAME, S } from '../strings'
import { applyTheme } from '../theme'

const THEMES = ['system', 'light', 'dark'] as const
const today = () => { const d = new Date(), p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }

/** #/settings: theme, accent, unlock-all, backup export/import, storage warning, about. */
export async function mountSettings(root: HTMLElement) {
  let settings = await loadSettings()
  const change = async (patch: Partial<Settings>) => {
    settings = { ...(await loadSettings()), ...patch }
    await saveSettings(settings); applyTheme(settings)
  }

  const styleBtns = STYLES.map((st, i) => h('button', { class: 'btn btn-outline', 'data-style-btn': st, 'aria-pressed': String(settings.style === st), text: S.styles[i],
    onclick: async () => { await change({ style: st }); styleBtns.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i))) } }))
  const themeBtns = THEMES.map((t, i) => h('button', { class: 'btn btn-outline', 'aria-pressed': String(settings.theme === t), text: S.themes[i],
    onclick: async () => { await change({ theme: t }); themeBtns.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i))) } }))

  const widthBtns = LINE_WIDTHS.map((w, i) => h('button', { class: 'btn btn-outline', 'data-width-btn': w, 'aria-pressed': String(settings.lineWidth === w), text: S.lineWidths[i],
    onclick: async () => { await change({ lineWidth: w }); widthBtns.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i))) } }))

  const sw = h('button', { class: 'switch', role: 'switch', 'aria-checked': String(settings.unlockAll),
    onclick: async () => {
      const unlockAll = !settings.unlockAll
      // A selected accent that becomes locked falls back to yellow.
      const keep = accentUnlocked(settings.accent, solvedCount(await loadProgress()), unlockAll)
      await change({ unlockAll, ...(keep ? {} : { accent: 'yellow' as const }) })
      sw.setAttribute('aria-checked', String(unlockAll))
      accentName.textContent = ACCENTS.find(a => a.id === settings.accent)!.name
    } })
  const accentName = h('span', { text: ACCENTS.find(a => a.id === settings.accent)!.name })

  const msg = h('p', { 'data-msg': '', role: 'status' })
  const say = (ok: boolean, text: string) => { msg.textContent = text; msg.setAttribute('data-ok', String(ok)) }
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true,
    onchange: async () => {
      const f = file.files?.[0]
      if (!f) return
      try {
        const r = await importBackup(await f.text())
        if (r.ok) { applyTheme(await loadSettings()); say(true, S.imported) } else say(false, r.error ?? '')
      } catch (err) { say(false, err instanceof Error ? err.message : S.importFailed) } finally { file.value = '' }
    } })
  const download = async () => {
    const a = h('a', { download: `isocube-backup-${today()}.json`, href: URL.createObjectURL(new Blob([await exportBackup()], { type: 'application/json' })) })
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const el = h('div', { class: 'screen' }, createTopBar({ title: S.settings, back: '/' }),
    h('main', { class: 'settings-body' },
      ...(await storageAvailable() ? [] : [h('p', { 'data-storage-warning': '', class: 'hint', text: S.storageWarning })]),
      h('h2', { text: S.style }), h('div', { class: 'seg' }, ...styleBtns),
      h('h2', { text: S.theme }), h('div', { class: 'seg' }, ...themeBtns),
      h('h2', { text: S.lineWidth }), h('div', { class: 'seg' }, ...widthBtns),
      h('a', { class: 'accent-row', href: '#/settings/accent' }, h('span', { class: 'accent-name', text: S.accent }), accentName),
      h('div', { class: 'accent-row' }, h('span', { class: 'accent-name', text: S.unlockAll }), sw),
      h('button', { class: 'btn btn-outline', text: S.exportProgress, onclick: () => void download() }),
      h('button', { class: 'btn btn-outline', text: S.importProgress, onclick: () => file.click() }), file, msg,
      h('h2', { text: S.about }), h('p', { text: `${APP_NAME}, ${S.version(pkg.version).toLowerCase()}` })))
  root.append(el)
  return { destroy: () => el.remove() }
}
