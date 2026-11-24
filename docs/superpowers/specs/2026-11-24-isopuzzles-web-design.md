# Isocube (Isometric Puzzles) — Web v1 Design

Name: **Isocube**, for personal use only. Another app uses this name on Google Play, so choose a new name before any public release.

Status: draft for the owner's approval, 2026-11-24. Replaces the Android plan as the thing to build. The Android spec and plan stay in the repo for later; nobody builds them now.

## Intent and why

A website on GitHub Pages with the full feature set, **for the owner's personal use only**. No store, no payment, no promotion. Claude Code builds it; the owner (Sasha) decides and tests on his phone (Pixel 7, Firefox for Android) and on desktop.

The current single page (`reference/index.html`, the artifact "Isometric Drawing Puzzles") is the behaviour reference. Keep its conventions unless this document says otherwise: seen from the front-left, front = lower-right face, side view from the left, views in a 2×2 layout, key picture with FRONT and SIDE arrows, dashed 3-direction grid, guide hexagon, views with plane lines.

## Goals, non-goals, anti-goals

**Goals**
- Everything from the Android v1 spec that makes sense on the web, plus **endless views puzzles** and **reverse puzzles**.
- Drawing with a finger on a phone feels precise (snap to the grid, ≥ 40 px grid step at the start).
- Works offline after the first visit (installable PWA, added to the home screen).

**Non-goals**
- Payments, paywall, accounts, cloud sync, analytics, store listings, promotion.
- The "Later" list: daily puzzle, slopes and cut corners, cube-placing hints, hard-mode views, net/mold export, adaptive difficulty, iOS app.

**Anti-goals**
- A half-done drawing is lost (reload, closing the tab, phone sleeps).
- The checker marks a drawing of the correct shape as wrong.
- The page freezes while a puzzle is generated.

## Constraints

- Static site only (HTML, CSS, JS, JSON). Hosted on GitHub Pages under the owner's account (`sanya-rt.github.io/isocube/`, repo `isocube`), from a public repository (owner approved 2026-11-24).
- GitHub Pages on a free account serves only public repositories, so the code is public.
- Main target: Firefox for Android on a Pixel 7 (about 412×915 CSS px). Also current Chrome and Firefox on desktop.
- English only. Fonts are self-hosted (no CDN), so the site works offline.

## Approach

Chosen: **TypeScript + Vite, no UI framework.** Rendering with SVG, as in the reference page. Tests with Vitest. A GitHub Actions workflow runs the tests, builds the site and deploys it to Pages on every push to `main`.

| Approach | For | Against |
| --- | --- | --- |
| TypeScript + Vite, no framework (chosen) | Types protect the shared geometry rules between modules; tests; automatic deploy | A build step |
| Plain JS modules, no build | Simplest, opens directly | No types; mistakes show only in tests or the page |
| Grow the single `index.html` | No setup | Several thousand lines in one file; hard to test and change |

Module split follows the Android plan's `:core` (geometry, shape edges, views, checker, generator, nets, drawing editor, stroke snapper, unlock rules), now as TypeScript modules with the same interfaces, plus a UI layer.

## Content

### Views puzzles

You get the top, front and side views and draw the shape on the isometric grid.

| Level | Base | Max height |
| --- | --- | --- |
| 1 | 3×3 | 2 |
| 2 | 3×4 | 3 |
| 3 | 4×4 | 3 |
| 4 | 4×5 | 4 |
| 5 | 5×5 | 4 |
| 6 | 5×6 | 5 |

- **Level sets:** 50 puzzles per level, made by the generator at build time and stored as JSON in the site, ordered easy to hard (hidden cubes, then cube count).
- **Classic set:** the 49 puzzles from the reference page (including "Book puzzle 15") stay as their own set (claude's call).
- **Endless mode:** per level, the browser makes new puzzles with the same generator and uniqueness check, in a Web Worker so the page never freezes. It keeps 2 puzzles ready ahead. While it works, the screen shows "Generating…" with a cancel button. Seeds are stored, so a puzzle can be opened again.
- Generator rules: footprint 4-connected; every row and column of the base has a cube; the max height is reached once; exactly one solution for the three views (plane lines included).

### Reverse puzzles (new)

You get the isometric drawing of a shape (shaded, with the key picture) and draw its three views.

- Three small square grids (TOP, FRONT, SIDE), each sized to the shape's base and height.
- Draw lines between grid points (snap to grid lines; horizontal and vertical only). Fill is not needed.
- Check compares the drawn lines with the exact view lines (outline + plane lines) of each view: missing and mistake segments marked as in the main checker, per view.
- Same 6 levels, shapes from the level sets and from endless mode.

### Nets puzzles

Port from the reference page: a shape and 4 nets, choose the net that folds into it, 3 levels, new puzzles without limit, each wrong net = the correct net with one square moved. After the answer, the correct net folds in 3D; play or scrub with a slider.

### Draw mode

A free grid with no puzzle: all tools, the 3 shading tones and a full colour palette. Keep several drawings; open, rename, delete. Export a drawing as SVG and PNG.

## Drawing tools

Same as the Android spec: snapped segment (drag), freehand stroke with snap (unreadable stroke draws nothing), fill a closed face (open region fills nothing), erase, undo, redo, clear, "pen only" (only a stylus draws; uses `pointerType`). A second finger during a stroke cancels the stroke.

**Zoom and pan (all grids, including the reverse-puzzle view grids):**
- Phone: two-finger pinch zoom (0.5×–4×) and two-finger pan.
- Desktop: mouse wheel or trackpad pinch zooms around the pointer; drag with the middle or right button, or Space + drag, pans.
- Buttons for one hand: zoom in, zoom out, and **Fit** (back to the start view).
- Start view: the largest grid step that fits the puzzle's guide hexagon plus one step of margin, never below 40 px if the space allows.
- The grid is drawn in SVG, so lines stay sharp at every zoom. The grid lines extend past the screen edges, so panning never shows an empty border.
- Zoom and pan of each puzzle are kept for the session; Fit resets them.

## Checker

As in the Android spec: unit segments, missing = answer − drawing, mistakes = (drawing − answer) − flat seams (tolerant rule), shading not checked. Answer overlay and checker share one edge computation.

## Accent colours

Yellow by default. Mint, Lilac, Pink, Lime, Red and Sand unlock at 10, 25, 50, 100, 150 and 200 solved puzzles, as a game reward (claude's call; a setting "Unlock all accents" turns this off). Check marks never use the accent.

## Screens and layout

1. Home: Views, Reverse, Nets, Draw, Settings.
2. Level list (views and reverse): level sets with progress (solved / total), Classic set, and an "Endless" entry per level.
3. Views puzzle, 4. Reverse puzzle, 5. Nets puzzle, 6. Draw mode (list + drawing), 7. Settings (theme System / Light / Dark, accent, unlock-all switch, backup).

Layout rule: taller than wide → views panel above the grid (hideable); wider than tall → beside it. The grid always scales to its space. Look: `docs/design/design-system.md` (mockups F, H, I).

## Saving and state

- Everything saved in the browser (IndexedDB, or localStorage for small values): drawings per puzzle, solved state, progress, endless seeds, draw-mode drawings, theme, accent.
- Save on every change. A reload or a closed tab loses nothing.
- **Backup:** Settings → "Export progress" downloads a JSON file; "Import progress" restores it. Browser data can be cleared, and this is the only copy.

## Testing and deploy

- Unit tests (Vitest): fold checker finds exactly 11 cube nets among 35 hexominoes; 450+ net runs fold back and land on the correct faces; every puzzle in the JSON and from endless mode has exactly one solution; checker cases (own edges → correct; one removed edge → one missing; line in empty space → one mistake; flat seams → no mistake); reverse checker cases; freehand strokes; fill on open and closed regions; undo/redo; accent unlock rules; backup export → import round trip.
- A small browser smoke test (Playwright, phone viewport) in CI: open a puzzle, draw a line, reload, the line is still there.
- GitHub Actions: test → build → deploy to Pages on push to `main`. A failing test blocks the deploy.
- Manual test on the owner's Pixel 7 (Firefox): drawing on levels 1–6, endless on level 6, reverse puzzles, nets, offline after first visit, dark mode.

## Left to the builder

Code structure inside the modules, small libraries, the storage wrapper, Web Worker details, the PWA setup, exact mark colours within the design system.

## Later

Daily puzzle; slopes and cut corners; cube placing as a tutorial and a 3D "show me the shape" hint; hard-mode views without plane lines; export of nets and molds with real sizes; adaptive difficulty; the Android app (spec and plan in this repo); iOS.
