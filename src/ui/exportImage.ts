import { segEnds, toUV, triEdges, type SegKey } from '../core/geometry'
import { arcPolyline } from '../core/arcs'
import type { Drawing } from '../core/drawing'
import type { View } from './grid/transform'
import { fillColour } from './grid/IsoGrid'

const uv = toUV

/** Standalone SVG of the drawing at `view.scale` px per grid unit. Colours are resolved now from the root's computed CSS (R5). */
export function exportSvg(d: Drawing, view: View): string {
  const cs = getComputedStyle(document.documentElement)
  const css = (name: string) => cs.getPropertyValue(name).trim()
  const resolve = (v: string) => css(v.slice(4, -1)) // 'var(--x)' → value
  const tris = Object.entries(d.fills).map(([k, c]) => ({
    pts: [...new Map(triEdges(k).flatMap(segEnds).map(p => [p.t + ':' + p.m, uv(p)])).values()], col: resolve(fillColour(c)),
  }))
  for (const a of d.areas ?? []) tris.push({ pts: a.pts, col: resolve(fillColour(a.c)) }) // drawn after the triangles, as on screen
  const segs = d.lines.map((k: SegKey) => segEnds(k).map(uv))
  const arcs = (d.arcs ?? []).map(k => arcPolyline(k))
  const all = [...tris.flatMap(t => t.pts), ...segs.flat(), ...arcs.flat()]
  const us = all.map(p => p[0]), vs = all.map(p => p[1])
  const u0 = Math.min(0, ...us) - 1, v1 = Math.max(0, ...vs) + 1
  const u1 = us.length ? Math.max(...us) + 1 : 1, v0 = vs.length ? Math.min(...vs) - 1 : -1
  const s = view.scale, W = (u1 - u0) * s, H = (v1 - v0) * s
  const f = (p: number[]) => `${((p[0] - u0) * s).toFixed(2)},${((v1 - p[1]) * s).toFixed(2)}`
  const ink = css('--ink'), sw = parseFloat(css('--stroke-line')) || 2
  const body = [
    `<rect width="${W}" height="${H}" fill="${css('--bg')}"/>`,
    ...tris.map(t => `<polygon points="${t.pts.map(f).join(' ')}" fill="${t.col}" stroke="${t.col}"/>`),
    ...segs.map(([a, b]) => {
      const [x1, y1] = f(a).split(','), [x2, y2] = f(b).split(',')
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round"/>`
    }),
    ...arcs.map(ps => `<polyline points="${ps.map(f).join(' ')}" fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`),
  ]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body.join('')}</svg>`
}

/** Rasterise an exportSvg string at `scale`×. Needs a real canvas, so it is not unit-tested in jsdom. */
export async function exportPng(svg: string, scale: 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth * scale; c.height = img.naturalHeight * scale
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return await new Promise<Blob>((ok, no) => c.toBlob(b => b ? ok(b) : no(new Error('PNG export failed')), 'image/png'))
  } finally { URL.revokeObjectURL(url) }
}

export function download(data: Blob | string, filename: string): void {
  const url = URL.createObjectURL(typeof data === 'string' ? new Blob([data], { type: 'image/svg+xml' }) : data)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.append(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const exportName = (name: string, ext: 'svg' | 'png') =>
  `isocube-drawing-${name.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled'}.${ext}`
