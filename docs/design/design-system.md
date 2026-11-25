# Isometric Puzzles — Design System (v2)

Approved direction 2026-11-23: mockups F (light) and H (dark) on the canvas
https://claude.ai/artifact/NwzCoG2h7VD6DQJT1F5STv. The owner may still change the style; every value
below lives in ONE theme file (`app/…/ui/theme/Tokens.kt`), so a restyle is a change to that file only.

Round 2 (2026-11-25): three styles, each with a light and a dark mode, a new glyph and app icon, and new
Home, Levels, Puzzle and Nets layouts. The web app keeps all values as CSS variables in `src/ui/styles/tokens.css`.

Feel (Paper): warm drawing paper, black ink, calm and precise; rounded shapes; one bright accent.
Do not copy Nothing's brand: no dot-matrix font, no Nothing red as the default accent.

## Styles and modes

- Three styles: **Paper** (warm paper, black ink, the default), **Blueprint** (blue ink on pale blue paper), **Concrete** (grey, square-ish corners, a light noise behind the content).
- Each style has a light and a dark mode. Settings has two independent choices: style and mode (System, Light, Dark), plus the accent.
- Every colour comes from a token (`--bg`, `--surface`, `--ink`, `--muted`, `--line`, `--grid-line`, `--guide`, `--tone-1..3`, `--view-cell`, `--mark-missing`, `--mark-mistake`) set per style and mode on `<html>` (`data-style`, `data-theme`). The table below gives the Paper values.
- Radius tokens per style: `--radius-button` (24, Concrete 6), `--radius-row` (20, Concrete 6), `--radius-tile` (16, Concrete 6). Panels use the row radius, cards the tile radius, buttons, pills and the tool bar the button radius.
- The accent is a separate setting and is the same in every style and mode.

## Glyph and app icon

- Glyph: a small isometric cube in `ink` (`src/ui/components/glyph.ts`), used on Home next to "Isocube".
- App icon: the same cube on the accent-yellow field (`public/icons/`: SVG, 192, 512 and a maskable 512).

## Colours (Paper)

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
- Corner radius: the radius tokens above (Paper: 24 buttons and pills, 20 list rows and panels, 16 tiles and cards).
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

- Four separate cards in one row: Key, Top, Side, Front. Each is a `surface` card with a `line` border and the tile radius (round 2; was one strip divided by ink rules). On a wide screen the cards go 2×2.
- Each view: light dashed cell grid; filled cells in `viewCell`; thick `ink` lines (2 dp) where neighbouring cells differ in depth (plane lines), exactly the web page rule. Labels in Archivo 12 px `muted`, sentence case.
- The panel folds away with a "Hide views" toggle; the KEY stays as a small badge when folded.

## Components

| Component | Spec |
|---|---|
| Top bar | Back (round, bordered, `aria-label`), title (wide cut) and subtitle centred, More (round) right. Shared by Levels, Puzzle, Reverse and Nets |
| Tool bar | One pill with the `ink` fill, above the action row: Line, Freehand, Fill, Erase · divider · Undo, Redo. The selected tool is an accent circle |
| Action row | Answer (outlined, 1/3 width) + Check (accent fill, 2/3 width), 52 tall, button radius |
| Tone swatches | 16 dp circles/squares with 1.5 dp `ink` border, right of the counts line |
| Level card | `surface`, tile radius; name, base size, solved count, a 10×5 dot grid (filled = solved), "Endless". Complete = `ink` fill, last opened = accent fill |
| List row | 64 dp, radius 20, used for accents and draw-mode drawings |
| Lock | Outline padlock icon in `muted`; tapping a locked item opens the purchase screen |

Icons: simple 1.8 dp stroke icons with labels (`contentDescription`) on every icon-only button.

## Screen layouts (round 2)

- **Home**: glyph + "Isocube" and a round Settings button; the solved total in large wide numbers; a full-width accent "Continue" pill with the last puzzle (hidden if none); a 2-column tile grid: Views (tall), Reverse, Nets, Draw (full width), each with name, one line and a count.
- **Levels** (Views, Reverse): top bar, one hint line, a 2-column grid of level cards with Classic full width at the end. Tapping a card opens its numbered puzzles.
- **Puzzle** (Views, Reverse): top bar; four view cards; the grid panel (`surface`, large radius); the counts line left and tone swatches right; the tool bar pill; the Answer / Check row. Reverse shows the shape and three drawing grids as four cards, then Fit / Check.
- **Nets**: top bar (level name and description); the level choice; the score as a large number ("6 right first time") with "New shape"; the shape card; the question; four nets in a 2×2 grid. After an answer a wrong pick gets a `markMistake` border and a "Your pick" label; the correct net gets a 2 dp `ink` border and a round check badge; a result bar (`ink` fill) under the grid shows the result text and a "Fold" button, with the fold picture below it.
- **Draw, Settings, Accent colour**: unchanged layouts; they only take the tokens and the glyph.
