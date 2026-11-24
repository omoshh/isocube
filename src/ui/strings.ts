// The only place the app name appears (personal use; rename before any public release).
export const APP_NAME = 'Isocube'

export const S = {
  back: 'Back',
  more: 'More',
  views: 'Views',
  reverse: 'Reverse',
  levels: 'LEVELS',
  level: (n: number) => `LEVEL ${n}`,
  classic: 'CLASSIC',
  endless: 'ENDLESS',
  endlessSub: (cols: number, rows: number) => `ENDLESS · ${cols}×${rows}`,
  generating: 'Generating…', cancel: 'Cancel',
  puzzle: (n: number, total: number, cols: number, rows: number) =>
    `PUZZLE ${String(n).padStart(2, '0')} / ${total} · ${cols}×${rows}`,
  solvedOf: (n: number, total: number) => `${n} / ${total}`,
  notBuilt: 'This screen is not built yet.',
  notFound: 'Puzzle not found.',
  top: 'TOP', front: 'FRONT', side: 'SIDE', key: 'KEY',
  hideViews: 'HIDE VIEWS', showViews: 'SHOW VIEWS',
  line: 'Line', freehand: 'Freehand', fill: 'Fill', erase: 'Erase', undo: 'Undo', redo: 'Redo',
  clear: 'Clear', penOnly: 'Pen only',
  zoomIn: 'Zoom in', zoomOut: 'Zoom out', fit: 'FIT',
  tone: (n: number) => `Tone ${n}`,
  answer: 'ANSWER', check: 'CHECK', next: 'NEXT',
  solved: 'Solved',
  counts: (missing: number, mistakes: number) =>
    [missing && `${missing} missing`, mistakes && `${mistakes} mistake${mistakes > 1 ? 's' : ''}`].filter(Boolean).join(' · '),
}
