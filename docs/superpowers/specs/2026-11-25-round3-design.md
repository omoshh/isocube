# Round 3 — design (owner feedback 2026-11-25)

Source: owner feedback file, round 3 (items 1–12). Decisions below were made with the owner on 2026-11-25.

## Intent

Puzzles must be fair: the user must never need a cube that the picture cannot show.
Fix the bugs the owner found on the Pixel 7, and remove Sections until it has a clear design.

## Decisions by item

| # | Decision |
|---|----------|
| 1 | Losing all lives clears "revealed". After the restart, a correct answer marks the puzzle solved. Cause of the bug: `loseLife` kept `revealed` (round 2 rule). |
| 2 | Eraser: one stroke erases only the line nearest to the finger at each point; a line already erased in this stroke blocks a second pick at the same point. Cause: `eraseAt` skipped pending lines, so a tap (start + end) took a second, neighbouring line. Applies to the iso grid (Views, Draw, Shadows). |
| 3, 4 | Hidden-cube rule and a turn button (below). Regenerate Views and Reverse level puzzles. |
| 5 | Sections is removed from `main` for now. The current code stays on branch `sections`. |
| 6 | Check the selected-accent outline in all 3 styles × light/dark; fix; send screenshots. |
| 7 | Draw mode opens zoomed in closer (finger-sized cells on Pixel 7). |
| 8 | "New drawing" button: centred, full width, like the other full-width buttons. |
| 9 | Shadows: figure and drawing field in two separate areas. |
| 10 | Level text shows W×D×H, e.g. "3×3×2". |
| 11 | Draw mode: diagonal across one grid cell (the long diagonal of one rhombus). Longer diagonals are chains of these. Eraser works on them. |
| 13 | Level lists (Views, Reverse, Shadows) go back to one full-width row per level, as before commit `7c90edf`. Each row: name, size (item 10), "n of 50", and the thin accent progress bar (not dots). Keep the hint line, the "last played" / "complete" colours, the Endless link and the tap-to-open numbers. No dimension arrows for now. |
| 12 | Explain "Fit" to the owner (it resets zoom/pan so the whole grid fits). Builder's call: a clearer label or hint. |

## Hidden cubes (items 3, 4)

**Rule.** A cube that any view shows in front must be visible in the front picture **or** in the back picture.
A view "shows" a cube when it is the top cube of its column (top view), the nearest cube in its column from the
front (front view), or the nearest cube in its row from the left (side view). The back picture is the same
isometric view from the opposite corner (the figure turned 180° about the vertical axis).

**Turn button.**
- Reverse: the picture has a ⟲ button (and tap on the picture) that switches front / back. A small label says which side shows. Plain switch, no animation.
- Views: the drawing does not change (the user draws the front picture). When Answer is on, the same ⟲ switches the answer picture to the back.

**Generator.** `makePuzzle` and the reverse set reject figures that break the rule. A test runs over every
Views and Reverse level puzzle in `puzzles.json` and finds none that breaks it.

**Classic set is removed** (owner's decision): the Classic tile goes from the Views and Reverse level lists, and
its 49 puzzles (copied from `reference/index.html`) go from `puzzles.json`.

**Old saved data.** On the first start with the new puzzles, delete all saved data of the old Views, Reverse and
Classic puzzles: solved ids, drawings, lives. Other data (Nets, Endless, Draw drawings, settings) stays.
The solved count falls, so some accents may lock again (owner accepted).

## Approaches considered (items 3, 4)

- Stricter rule, one picture: almost no figures pass at levels 3–6 (0–3 % of random figures). Rejected.
- Two pictures side by side: does not fit the phone screen. Rejected by the owner.
- **One picture with a turn button (picked):** no extra space; with two viewpoints 0.6–82 % of random figures pass the rule, so every level can be generated.

## Non-goals

- No new Sections design in this round.
- No turn animation.
