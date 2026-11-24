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

/** solved: puzzle ids incl. "E{level}-{seed}" and "R-{id}" */
export type Progress = { solved: string[]; netsRight: number; endlessSeeds: Record<number, number[]> }
export type Settings = { theme: 'system' | 'light' | 'dark'; accent: Accent; unlockAll: boolean }

export const solvedCount = (p: Progress) => p.solved.length + p.netsRight

export function accentUnlocked(a: Accent, solved: number, unlockAll: boolean): boolean {
  return unlockAll || solved >= ACCENTS.find(x => x.id === a)!.threshold
}

export function nextAccent(solved: number): { id: Accent; left: number } | null {
  const n = ACCENTS.find(x => x.threshold > solved)
  return n ? { id: n.id, left: n.threshold - solved } : null
}
