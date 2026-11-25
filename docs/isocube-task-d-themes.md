# Task: D layouts, theme styles, glyph and app icon

Design reference (canvas): https://claude.ai/artifact/BzZ9eJSxWJw74raoqGyUiP
- Row D: layouts to build (Home, Levels, Puzzle, Nets) in the Paper style.
- Row F: Blueprint style. Row G: Concrete style.
- Row H: glyph options. Use option 2 (glyph) and option 5 (app icon).

Rows A, B and C are rejected explorations. Do not use them.

Keep all current features and behaviour. Change only the layout and the styling. Run `npm test` and `npm run e2e` before you finish. Update `docs/design/design-system.md` to describe the new state.

## 1. Settings model

Three independent settings:

| Setting | Values | Default |
|---|---|---|
| `style` (new) | `paper`, `blueprint`, `concrete` | `paper` |
| `theme` (existing, the mode) | `system`, `light`, `dark` | `system` |
| `accent` (existing) | the 7 accents, unlocked as now | `yellow` |

- Add `style` to `Settings` in `src/core/unlocks.ts`. Old saved settings and old backups that have no `style` load as `paper`.
- `applyTheme()` sets `data-style` and `data-theme` on `<html>`.
- Settings screen: add a "Style" row with Paper / Blueprint / Concrete buttons, above the existing Theme row. It uses the same button pattern as Theme.

## 2. Tokens

Add one block per style and mode in `tokens.css`: `:root[data-style="…"][data-theme="…"]`. Each block sets every colour variable that the current light/dark blocks set, and nothing else in the UI may contain a hex colour.

Paper light and Paper dark are the current values. Do not change them.

| Token | Blueprint light | Blueprint dark | Concrete light | Concrete dark |
|---|---|---|---|---|
| `--bg` | `#F4F7FB` | `#1F4E8C` | `#D3D2CE` | `#2A2B2D` |
| `--surface` | `#FFFFFF` | `#24599B` | `#E6E5E1` | `#343538` |
| `--ink` | `#1F4E8C` | `#F2F6FB` | `#1E1F21` | `#E4E3DF` |
| `--muted` | `#4A6587` | `#C9D8EA` | `#505155` | `#A6A6A2` |
| `--line` | `#C9D8EA` | `#4F7DB8` | `#B3B2AD` | `#45464A` |
| `--grid-line` | `#A9C1DE` | `#4A78B5` | `#A9A8A3` | `#55565A` |
| `--guide` | `#6F8DB3` | `#9DB9DC` | `#6F7073` | `#8D8E90` |
| `--tone-1` | `#FFFFFF` | `#9DBCE0` | `#F1F0EC` | `#6E6F72` |
| `--tone-2` | `#9DBCE0` | `#5F8CC4` | `#A9A8A3` | `#4A4B4E` |
| `--tone-3` | `#1F4E8C` | `#2F5F9E` | `#5E5F62` | `#343538` |
| `--view-cell` | `#E3ECF6` | `#3D6CA8` | `#C9C8C3` | `#3E3F42` |
| `--mark-missing` | `#7B3FE4` | `#8CE8FF` | `#2B44E0` | `#8C9BFF` |
| `--mark-mistake` | `#E4572E` | `#FF8A4C` | `#E4572E` | `#FF7A45` |

Shape tokens per style (put them in a `:root[data-style="…"]` block, used by both modes):

| Token | Paper | Blueprint | Concrete |
|---|---|---|---|
| `--radius-button` | 24px | 24px | 6px |
| `--radius-row` | 20px | 20px | 6px |
| `--radius-tile` | 16px | 16px | 6px |

Concrete only: add a light noise texture to the screen background. Use an inline SVG `feTurbulence` filter (fractalNoise, baseFrequency 0.9, alpha about 0.09) as a fixed layer behind the content (`position: fixed; inset: 0; z-index: -1; pointer-events: none`). It must not block taps and must not show in exported images.

Check marks: the rule "check marks never take the accent colour" stays. The mark colours now come from the style and mode, as in the table.

## 3. Accents per style

- Each style can hide accents that do not have enough contrast on its background. Blueprint dark hides `red` (2.0:1 on `#1F4E8C`). No other accent is hidden.
- Keep the list of hidden accents in one place, next to `ACCENTS`, with a test.
- A hidden accent is not shown in the accent picker for that style.
- If the saved accent is hidden in the current style, show `yellow`, but do not change the saved accent. When the user changes the style back, the saved accent shows again.
- Accent buttons always keep their border and `--on-accent` text, so they stay visible in light styles where the accent has low contrast with the background.

## 4. Glyph

- An SVG component: one isometric cube. Top face `var(--accent)`, left face `var(--tone-2)`, right face `var(--tone-3)`, edges `var(--ink)`, round joins. The stroke is about 1/40 of the size, at least 1.2px.
- Show it before "Isocube" on Home at 32px, with an 10px gap. It is decorative: `aria-hidden="true"`.
- It must follow the style, mode and accent without a reload.

## 5. App icon

- The stack from canvas row H, option 5: heights `[[2,1],[1,0]]`, top faces in the accent colour.
- The icon is static, so use the Paper light colours and the yellow accent.
- Generate `public/icons/icon-192.png`, `icon-512.png` and `icon-maskable-512.png` from one SVG source with a script. Keep the shape inside the maskable safe zone (the centre 80%).
- Update the favicon too.

## 6. Layouts (row D)

Common rules: Archivo only, titles in the wide cut, sentence case, tabular figures for numbers, touch targets of 48px or more, icon-only buttons with `aria-label`.

### Home
1. A header row: glyph + "Isocube" on the left, a round Settings button on the right.
2. The total solved count in large numbers (Archivo 700, wide, about 104px), with "puzzles solved" under it.
3. "Continue": a full-width pill with the accent fill. It shows the last opened puzzle ("Views, level 3, puzzle 8") and a round play button. Store the last opened puzzle when a puzzle screen opens. If there is none, do not show the pill.
4. A 2-column tile grid: Views (tall, 2 rows, with a small iso picture), Reverse, Nets, then Draw as a full-width row. Each tile shows the name, one line of description and its count.

### Levels (Views and Reverse)
1. A top bar with Back and the title.
2. One line: "Each dot is one puzzle. Filled dots are solved."
3. A 2-column grid of level cards, with Classic as a full-width card at the end. A card shows the level name, the base size, the solved count, a 10×5 dot grid (one dot per puzzle; filled = solved) and an "Endless" button.
4. States: a complete level uses the `--ink` fill with inverted text. The level of the last opened puzzle uses the accent fill. All other cards use `--surface`.
5. Tapping a card opens its numbered puzzle grid, as the current `<details>` does. This keeps direct access to each puzzle.

### Puzzle (Views and Reverse)
1. A top bar: Back, the title and subtitle in the centre, More.
2. The views as 4 separate cards in one row: Key, Top, Side, Front. "Hide views" stays.
3. The grid panel: `--surface`, large radius, the iso grid as now.
4. The counts line ("1 missing, 1 mistake") on the left, tone swatches on the right.
5. The tool bar: one pill with the `--ink` fill. Line, Freehand, Fill, Erase, a divider, Undo, Redo. The selected tool has an accent circle.
6. The action row: Answer (outlined, 1/3) and Check (accent, 2/3).

### Nets
1. A top bar with the level name and description.
2. The score as a large number ("6 right first time") and a "New shape" button.
3. The shape card.
4. The question, then the 4 nets in a 2×2 grid.
5. After an answer: the wrong pick has a `--mark-mistake` border and a "Your pick" label. The correct net has a 2px `--ink` border and a round check badge. Under the grid, a bar with the result text and a "Fold" button.

Other screens (Draw, Settings, Accent colour) keep their layouts and only take the new tokens and the glyph.
