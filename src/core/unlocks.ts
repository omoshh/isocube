export type Accent = 'yellow' | 'mint' | 'lilac' | 'pink' | 'lime' | 'red' | 'sand'
export const ACCENTS: { id: Accent; name: string; threshold: number }[] = [
  { id: 'yellow', name: 'Yellow', threshold: 0 },
  { id: 'mint', name: 'Mint', threshold: 10 },
  { id: 'lilac', name: 'Lilac', threshold: 25 },
  { id: 'pink', name: 'Pink', threshold: 50 },
  { id: 'lime', name: 'Lime', threshold: 100 },
  { id: 'red', name: 'Red', threshold: 150 },
  { id: 'sand', name: 'Sand', threshold: 200 },
]

export type Style = 'paper' | 'blueprint' | 'concrete'
export const STYLES: Style[] = ['paper', 'blueprint', 'concrete']

/** Accents with too little contrast on a style's background, per mode. */
const HIDDEN_ACCENTS: Partial<Record<`${Style}-${'light' | 'dark'}`, Accent[]>> = { 'blueprint-dark': ['red'] }
export const hiddenAccents = (style: Style, mode: 'light' | 'dark'): Accent[] => HIDDEN_ACCENTS[`${style}-${mode}`] ?? []
/** The accent to show: yellow when the saved one is hidden (the saved setting is left alone). */
export const shownAccent = (a: Accent, style: Style, mode: 'light' | 'dark'): Accent => hiddenAccents(style, mode).includes(a) ? 'yellow' : a

/** solved: puzzle ids incl. "E{level}-{seed}" and "R-{id}" */
export type Progress = { solved: string[]; netsRight: number; endlessSeeds: Record<string, number[]> } // keys: level '1'–'6' or a size spec like '3x3x2s'
export type LineWidth = 'thin' | 'normal' | 'thick'
export const LINE_WIDTHS: LineWidth[] = ['thin', 'normal', 'thick']
export type Settings = { theme: 'system' | 'light' | 'dark'; accent: Accent; unlockAll: boolean; style: Style; lineWidth: LineWidth; lives: boolean }

export const solvedCount = (p: Progress) => p.solved.length + p.netsRight

export function accentUnlocked(a: Accent, solved: number, unlockAll: boolean): boolean {
  return unlockAll || solved >= ACCENTS.find(x => x.id === a)!.threshold
}

export function nextAccent(solved: number): { id: Accent; left: number } | null {
  const n = ACCENTS.find(x => x.threshold > solved)
  return n ? { id: n.id, left: n.threshold - solved } : null
}
