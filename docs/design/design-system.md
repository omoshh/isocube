# Isometric Puzzles — Design System (v1)

Approved direction 2026-11-23: mockups F (light) and H (dark) on the canvas
https://claude.ai/artifact/NwzCoG2h7VD6DQJT1F5STv. The owner may still change the style; every value
below lives in ONE theme file (`app/…/ui/theme/Tokens.kt`), so a restyle is a change to that file only.

Feel: warm drawing paper, black ink, calm and precise; rounded shapes; one bright accent.
Do not copy Nothing's brand: no dot-matrix font, no Nothing red as the default accent.

## Colours

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F5F2EA` | `#121214` | Screen background (paper) |
| `surface` | `#FFFFFF` | `#1C1C20` | Cards, level tiles, list rows |
| `ink` | `#16161A` | `#ECEAE4` | Text, user lines, icons |
| `muted` | `#5D5A55` | `#A3A19B` | Secondary text, labels |
| `line` | `#D9D4C8` | `#2E2E33` | Borders, dividers |
| `gridLine` | `#BDB6A6` | `#3E3E45` | Iso grid (dashed) |
| `guide` | `#8A8371` | `#8E8C86` | Guide hexagon, FRONT/SIDE arrows on the grid |
| `toneTop` | `#FFFFFF` | `#2A2A2F` | Shading tone 1 (top faces) |
| `toneSide` | `#C9C4B8` | `#55555C` | Shading tone 2 |
| `toneFront` | `#16161A` | `#ECEAE4` | Shading tone 3 |
| `viewCell` | `#E6E2D8` | `#2A2A2F` | Filled cells in the views |
| `markMissing` | `#2B44E0` | `#8C9BFF` | Missing segments (dashed) |
| `markMistake` | `#E4572E` | `#FF7A45` | Mistake segments (solid, thick) |
| `accent` | from the selected accent | same | Main button (Check, Buy), selected states |
| `onAccent` | `#16161A` or `#FFFFFF` | same | Text on accent: pick the one with contrast ≥ 4.5:1 |

Check marks never take the accent colour. They mean the same in every theme.

## Accents

| Id | Name | Colour | Unlock |
|---|---|---|---|
| `yellow` | Yellow | `#FFD23F` | Default |
| `mint` | Mint | `#3DDC97` | 10 solved puzzles |
| `lilac` | Lilac | `#B9A6FF` | 25 solved puzzles |
| `pink` | Pink | `#FF8FC7` | 50 solved puzzles |
| `lime` | Lime | `#C6F432` | 100 solved puzzles |
| `red` | Red | `#E5383B` | 150 solved puzzles |
| `sand` | Sand | `#E8C9A0` | 200 solved puzzles |

The full version unlocks every accent at once. "Solved" = views puzzles solved + nets puzzles answered
right at the first choice. No accent is orange or blue (those are the check marks).

## Type

- One family: **Archivo** (variable, weight and width axes). Changed 2026-11-24 by the owner: replaces IBM Plex Mono + Space Grotesk.
- Screen titles and section headings: Archivo 650 in the wide cut (`font-stretch` 118%), like drafting lettering.
- Body, buttons and labels: Archivo 400–600, normal width. Sentence case everywhere; no extra letter spacing; no uppercase labels.
- Numbers: tabular figures (`font-variant-numeric: tabular-nums`), so counts and puzzle numbers line up.
- Sizes (sp): screen title 20, body 16, secondary 14, label 11–12, button 15.
- Bundle the fonts in the app (OFL licences in `app/src/main/assets/licences/`). No network fonts.

## Shape and spacing

- Spacing steps (dp): 4, 8, 12, 16, 24, 32. Screen side padding 16.
- Corner radius: 24 for buttons and pills, 20 for list rows, 16 for tiles and the view panel cells.
- Touch targets ≥ 48 dp. Tool bar buttons 48×48.
- Borders 1 dp `line`; selected state 1.5–2 dp `ink`.

## Iso grid (as in the web page)

- Three families of thin dashed lines (1 dp, dash 2/3) in `gridLine`: vertical and ±30°.
- Guide hexagon in `guide`: the outline of the puzzle's bounding box (width × depth × max height).
- FRONT and SIDE arrows with labels in `guide` on the grid, pointing at the front and side faces of the box.
- User lines: 2 dp `ink`, round caps. Fills: the 3 tones (draw mode: tones + paid palette).
- Initial grid step = the largest that fits the guide hexagon plus 1 step of margin; zoom 0.5×–4×.
- Answer overlay: shape edges in `ink` at 55% opacity, 1.5 dp.
- Check overlay: missing = 3.5 dp dashed `markMissing`; mistakes = 4 dp solid `markMistake`; a counts line under the grid ("1 missing · 1 mistake").

## Views panel

- One title-block strip across the full width: Key, Top, Side, Front, divided by thin ink rules (web, 2026-11-24; was a 2×2 of cards).
- Each view: light dashed cell grid; filled cells in `viewCell`; thick `ink` lines (2 dp) where neighbouring cells differ in depth (plane lines), exactly the web page rule. Labels in Archivo 12 px `muted`, sentence case.
- The panel folds away with a "HIDE VIEWS" toggle; the KEY stays as a small badge when folded.

## Components

| Component | Spec |
|---|---|
| Top bar | 60 dp; back button left, title (Plex Mono 20) + subtitle (e.g. "PUZZLE 07 / 50 · 4×4", 11 sp `muted`), more button right |
| Tool bar | Bottom, above the action row: Line, Freehand, Fill, Erase · divider · Undo, Redo. Selected tool = `ink` fill, inverted icon |
| Action row | ANSWER (outlined, 1/3 width) + CHECK (accent fill, 2/3 width), 48 dp tall, radius 24 |
| Tone swatches | 16 dp circles/squares with 1.5 dp `ink` border, right of the counts line |
| Level tile | `surface`, radius 16, level name, base size, "solved / total" bar, lock icon on locked puzzles |
| List row | 64 dp, radius 20, used for accents and draw-mode drawings |
| Lock | Outline padlock icon in `muted`; tapping a locked item opens the purchase screen |

Icons: simple 1.8 dp stroke icons with labels (`contentDescription`) on every icon-only button.

## Screens covered by mockups

- Views puzzle (F light, H dark).
- Accent colours (I).
- Still to mock up before polishing: home, level list, nets puzzle, draw mode, purchase, settings. They use only the components above.
