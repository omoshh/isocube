# Isocube Task D Plan — styles, glyph, app icon, row D layouts

> Executed with superpowers:subagent-driven-development. Split of `docs/isocube-task-d-themes.md` into tasks.

**Spec:** `docs/isocube-task-d-themes.md` (the binding text; each task names its sections — read them verbatim). Base look: `docs/design/design-system.md`.

**Design reference:** local copies of the canvas artboards in `docs/design/canvas/` (`D-Home`, `D-Levels`, `D-Puzzle`, `D-Nets` = layouts in Paper light; `F-Home` = Blueprint dark; `G-Home` = Concrete; `Glyphs` = row H, use option 2 for the glyph and option 5 for the app icon). They are static HTML mockups with hard-coded colours; in the app, every colour comes from tokens.

## Global Constraints

- Keep all current features and behaviour. Change only the layout and the styling.
- Tokens only: no hex colour in the UI outside `src/ui/styles/tokens.css` (and the mirror `ACCENT_HEX` in `src/ui/theme.ts`).
- Paper light and Paper dark keep the current token values.
- Check marks never take the accent colour.
- Archivo only, titles in the wide cut, sentence case, tabular figures, touch targets ≥ 48px, icon-only buttons with `aria-label`.
- `src/core/` has no DOM. Tests first (Vitest). One commit per task.
- `npm test` passes after each task; `npm run e2e` passes at the end (Task D4).

---

### Task D1: Style setting, style tokens, accents per style

Spec sections 1, 2 and 3 of `docs/isocube-task-d-themes.md`.

**Files:** `src/core/unlocks.ts` (`Settings.style`, hidden-accent list next to `ACCENTS`), `src/core/backup.ts` (old backups without `style` → `paper`), settings load in `src/ui/storage.ts`, `src/ui/theme.ts` (`applyTheme` sets `data-style` and `data-theme`; shown accent = `yellow` when the saved accent is hidden in the style), `src/ui/styles/tokens.css` (style × mode blocks, shape tokens, Concrete noise layer), `src/ui/screens/settings.ts` (Style row above Theme), `src/ui/screens/accents.ts` (hide hidden accents), CSS that uses radii (use the new `--radius-*` tokens). Tests in `tests/core/unlocks.test.ts`, `tests/core/backup.test.ts`, `tests/ui/theme.test.ts`, `tests/ui/settings.test.ts`.

- [ ] Failing tests: old settings without `style` load as `paper`; old backup without `style` imports as `paper`; `applyTheme` sets `data-style`; Blueprint dark hides `red` (list test); saved `red` in Blueprint dark shows `yellow` but the saved setting stays `red`; accent picker hides `red` in Blueprint dark; every token block sets the same colour variables as the Paper light block; noise layer has `pointer-events: none` and is not in exported images.
- [ ] Implement → pass. Commit `feat: style setting with Blueprint and Concrete`.

---

### Task D2: Glyph and app icon

Spec sections 4 and 5. Reference: `docs/design/canvas/Glyphs.dc.html` options 2 and 5.

**Files:** new glyph component in `src/ui/components/` (inline SVG using `var(--accent)`, `var(--tone-2)`, `var(--tone-3)`, `var(--ink)`), Home title (glyph before "Isocube", 32px, 10px gap, `aria-hidden="true"`), new icon script in `scripts/` that writes one SVG source and the PNGs `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (stack `[[2,1],[1,0]]`, Paper light colours, yellow tops, maskable shape in the centre 80%), favicon (`index.html` / `public/`). Use a PNG renderer that is already installed (for example Playwright's Chromium) — do not add a dependency for it. Add an `npm` script for the icon generator.

- [ ] Failing tests: glyph SVG uses the four CSS variables and no hex; stroke ≈ size/40, ≥ 1.2px; `aria-hidden`. Generated PNG sizes are 192/512/512.
- [ ] Implement → pass. Commit `feat: isocube glyph and app icon`.

---

### Task D3: Home and Levels layouts

Spec section 6, "Common rules", "Home" and "Levels". References: `docs/design/canvas/D-Home.dc.html`, `D-Levels.dc.html` (Paper), `F-Home.dc.html`, `G-Home.dc.html` (other styles).

**Files:** `src/ui/screens/home.ts`, `src/ui/screens/levels.ts`, `src/ui/styles/screens.css`, storage for the last opened puzzle (`src/ui/storage.ts`), the puzzle screens write it on open (views, reverse; Nets and endless too where they have a puzzle identity). Tests in `tests/ui/`.

- [ ] Failing tests: Continue pill hidden with no last puzzle; shown with the label ("Views, level 3, puzzle 8") after a puzzle screen opens, and it links to that puzzle; home tile counts; level card states (complete = ink, last-opened level = accent, other = surface); 10×5 dot grid with filled = solved; card opens the numbered puzzle grid.
- [ ] Implement → pass. Commit `feat: new home and levels layouts`.

---

### Task D4: Puzzle and Nets layouts, docs, e2e

Spec section 6, "Puzzle" and "Nets", plus the closing lines ("Other screens …", run `npm test` and `npm run e2e`, update `docs/design/design-system.md`). References: `docs/design/canvas/D-Puzzle.dc.html`, `D-Nets.dc.html`.

**Files:** `src/ui/components/topBar.ts`, `viewsPanel.ts`, `toolBar.ts`, `src/ui/screens/viewsPuzzle.ts`, `reversePuzzle.ts`, `nets.ts`, `src/ui/styles/*.css`, `docs/design/design-system.md`, e2e specs in `e2e/` if selectors change. Tests in `tests/ui/`.

- [ ] Failing tests: views as 4 cards Key/Top/Side/Front and "Hide views" still works; tool bar order Line, Freehand, Fill, Erase, divider, Undo, Redo, selected tool marked; action row Answer + Check; Nets score line and "New shape"; after a wrong pick the pick has the mistake border and "Your pick", the correct net has the check badge, a result bar with "Fold".
- [ ] Implement → pass; `npm run e2e` passes. Update `docs/design/design-system.md`. Commit `feat: new puzzle and nets layouts`.

---

### Task D5: Adjustable line width

Added by the owner 2026-11-25. Not in `docs/isocube-task-d-themes.md`; this task text is the spec.

**Behaviour:**
- `Settings.lineWidth: 'thin' | 'normal' | 'thick'`, default `'normal'`. Settings saved before this change and backups without the field load as `'normal'`; a backup with any other value is rejected like other invalid settings.
- The width applies to the lines the user draws (all puzzle kinds and Draw mode): thin = 1.5px, normal = 2px (the current `--stroke-line`), thick = 3px.
- Check marks stay wider than the drawn lines: `--stroke-missing` = line + 1.5px, `--stroke-mistake` = line + 2px (normal keeps today's 3.5px and 4px).
- The grid, answer lines, shape outlines and icons do not change.
- Exported PNG and SVG images use the chosen width.
- Settings screen: a "Line width" row with Thin / Normal / Thick buttons, same button pattern as Style and Theme, below Theme. It applies at once, without reload.

**Files:** `src/core/unlocks.ts` (`Settings`), `src/core/backup.ts`, `src/ui/storage.ts` (default), `src/ui/theme.ts` (set the stroke variables), `src/ui/screens/settings.ts`, `src/ui/strings.ts`, `src/ui/exportImage.ts`, tests in `tests/core/backup.test.ts`, `tests/ui/settings.test.ts`, `tests/ui/theme.test.ts`.

- [ ] Failing tests: old settings without `lineWidth` load as `normal`; old backup imports as `normal`; invalid value rejected; choosing Thick sets the drawn-line stroke to 3px and mistake to 5px; export output uses the chosen width; the switch persists.
- [ ] Implement → pass. Commit `feat: adjustable line width`.

