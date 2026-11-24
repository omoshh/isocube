import type { Bounds } from '../../core/drawing'

/** scale = px per grid unit; (panU, panV) = the grid point (u right, v up) at the element's top-left corner. */
export type View = { scale: number; panU: number; panV: number }

const S = Math.sqrt(3) / 2
const MIN_STEP = 40

/** Bounds of the guide hexagon: the box cols × rows × maxH seen from the front-left. */
export const guideBounds = (cols: number, rows: number, maxH: number): Bounds =>
  ({ t0: -rows, t1: cols, v0: 0, v1: (cols + rows) / 2 + maxH })

/** Fit a u/v rectangle plus one step of margin; drop the margin if that is what it takes to reach 40 px. */
export function fitRect(u0: number, u1: number, v0: number, v1: number, w: number, h: number): View {
  const cw = u1 - u0, ch = v1 - v0
  let scale = Math.min(w / (cw + 2), h / (ch + 2))
  if (scale < MIN_STEP) scale = Math.max(scale, Math.min(MIN_STEP, w / cw, h / ch))
  return { scale, panU: (u0 + u1) / 2 - w / 2 / scale, panV: (v0 + v1) / 2 + h / 2 / scale }
}

export const fitView = (b: Bounds, w: number, h: number): View => fitRect(b.t0 * S, b.t1 * S, b.v0, b.v1, w, h)

/** Zoom by `factor` keeping the grid point under (px, py) fixed; `lim` clamps the resulting scale. */
export function zoomAt(v: View, factor: number, px: number, py: number, lim?: [number, number]): View {
  let scale = v.scale * factor
  if (lim) scale = Math.min(lim[1], Math.max(lim[0], scale))
  const u = v.panU + px / v.scale, g = v.panV - py / v.scale
  return { scale, panU: u - px / scale, panV: g + py / scale }
}

export const panBy = (v: View, dx: number, dy: number): View =>
  ({ scale: v.scale, panU: v.panU - dx / v.scale, panV: v.panV + dy / v.scale })
