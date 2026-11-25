# Isocube — Round 2 Design: lives, cross-sections, shadows

Approved by the owner 2026-11-25. Builds on the live web version (`2026-11-24-isopuzzles-web-design.md`, `docs/design/design-system.md`). Same stack, same style, same rules (core logic in `src/core/` with tests first, UI in `src/ui/`).

## Why

The owner enjoys draw, reverse and nets puzzles and wants more kinds of spatial training, plus a little tension from limited mistakes.

## 1. Lives

- Every puzzle starts with **3 lives**, shown as 3 marks in the top bar (filled = left, outlined = lost).
- A life is lost on: a failed **Check** (views, reverse, shadow puzzles), or a **wrong pick** (nets, cross-sections). Wrong single lines do not cost a life; only Check does.
- **0 lives → the same puzzle starts again:** the drawing is cleared, lives return to 3. A short message says so.
- **Answer button** with lives on: shows the solution; the puzzle is then marked "revealed" and does not count as solved (no accent progress).
- Lives state (lives left, revealed) is saved per puzzle, so a reload does not refill lives.
- **Settings → "Lives"** switch, on by default. Off = the app behaves as before (no marks, unlimited Checks, Answer as before).
- Draw mode has no lives.

## 2. Cross-section puzzles

**The puzzle:** an iso drawing of one solid, with 3 marked points on its corners or edges. A plane goes through the 3 points. Choose the shape of the cut from 4 options.

- Solids are drawn with the same parallel projection as the grid (front-left view), hidden edges dashed, points as dots in `--ink` with a light ring. The plane itself is not drawn before the answer.
- **The 4 options show true shapes** (the cut seen straight on), each centred, scaled so its longest side has the same length, and turned by a random angle. Exactly one is similar to the correct cut (similarity includes mirror images).
- Wrong options come from other planes through marked points of the same solid. From level 2, at least one wrong option has the same number of corners as the correct one when possible.

| Level | Solids | Marked points |
| --- | --- | --- |
| 1 | Cube | Corners and edge midpoints |
| 2 | Cube; triangular prism; hexagonal prism | Corners, midpoints, edge thirds |
| 3 | Square pyramid; regular tetrahedron; cuboid 2×1×1 | Corners, midpoints, edge thirds |

- A plane is valid only if the 3 points are not on one line, not all on one face of the solid, and the cut has an area of at least 5% of the solid's largest face (no slivers, no single edges).
- **After the answer:** an animation with play and a slider, like the net fold: the plane slides into the solid, the cut fills with the accent colour, then the cut turns to face the viewer and shows its true shape.
- Puzzles are generated without limit per level (seeded, like nets). The current seed survives a reload. A right first pick counts as solved.

## 3. Shadows

**The puzzle:** a shaded iso drawing of a shape (from the views level sets, levels 1–4) and a light direction shown by an arrow and a small sun icon. Draw the outline of the shadow.

| Level | Light | Shadow falls on |
| --- | --- | --- |
| 1 | Straight down | Floor |
| 2 | From the front, horizontal | Back wall |
| 3 | From the side, horizontal | Side wall |
| 4 | Slanted: for each step down, the light moves +1 in x and +1 in y, direction (1, 1, −1) | Floor |

For level 4, a point (x, y, z) casts its shadow on the floor at (x + z, y + z, 0), so every corner lands on a grid point and the shadow lines stay on the grid.

- The shape is drawn semi-transparent (60% opacity), so the floor or wall grid under it stays visible. The user draws the **whole** shadow outline, including the parts under or behind the shape.
- The checker compares exactly: the outline = the boundary segments between shadow and no-shadow cells of the floor or wall. No tolerance.
- A failed Check marks missing and mistake segments as in the main checker.
- Solved ids `S<level>-<puzzle id>`.

## Screens

- Home: add **Sections** and **Shadows** next to Views, Reverse, Nets, Draw.
- The Shadows level list reuses the views level list, with the light direction per level. Sections has levels 1–3, like Nets.
- Settings: add the **Lives** switch.

## Saving and backup

- New saved data: lives per puzzle, revealed flags, section seeds, shadow drawings.
- Backup schema becomes version 2 with these fields. Import accepts version 1 files (new fields start empty) and version 2 files.

## Testing

Unit tests, test first, as before. Key ones: section of a cube through 3 corners of one face's diagonal = equilateral triangle; through 6 edge midpoints = regular hexagon; invalid planes never offered (500 seeds per level); options never similar to each other, mirror images included; animation at t=1 puts the cut in the viewing plane; shadow of one cube straight down = 4 segments, on the floor under the cube; level 4 shadow corners on the grid; lives: failed checks, restart at 0, reload keeps lives, Answer sets revealed; backup v1 import.

Manual test on the Pixel 7: one puzzle of each new kind, lives on and off.

## Not in this round

"Seen from below" (removed by the owner 2026-11-25), the other point-of-view ideas (the viewer's eye, draw from the other corner), cross-sections through cube shapes, and real perspective with vanishing points.
