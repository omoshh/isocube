/** Tiny element builder: attrs set as attributes, except `on<event>` (listener) and `text` (textContent). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, string | number | boolean | EventListener | undefined> = {}, ...kids: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue
    if (typeof v === 'function') e.addEventListener(k.slice(2), v)
    else if (k === 'text') e.textContent = String(v)
    else e.setAttribute(k, v === true ? '' : String(v))
  }
  e.append(...kids)
  return e
}

/** Icon markup: 24×24 viewBox, stroke icons drawn in currentColor. */
export const icon = (paths: string) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`
