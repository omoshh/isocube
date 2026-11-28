# Draw: erase a line part between crossings (short design, 2026-11-28)

**Intent (owner):** in Draw mode, erase any part of a line, without regard to the grid: where one line crosses
another at any angle, the eraser removes only the part between the nearest crossings (or the line's end).

**Goals:** a tap (or rub) with the eraser on a line removes only the part between the 2 crossings nearest to the finger;
the rest of that line stays. Crossings are with other drawn lines (also where another line only ends on it) and with
drawn arcs. One tap is one undo step.

**Non-goals:** Views and Shadows (Views compares exact keys; their eraser stays as now). Erasing part of an arc: arcs
stay erasable per eighth (owner: "lines first"). A free rubber that removes any rubbed length.

**Anti-goals:** old Draw drawings change or fail to load; a cut leaves a tiny invisible stub; undo needs more than one step.

**Approaches:**
1. **Split on erase (picked, builder's call).** Only the erased line is cut, at that moment, at its crossings; the
   pieces that remain are stored as ordinary line keys. Nothing else changes.
2. Split every line at every crossing when it is drawn. Rejected: changes all stored keys, many tiny pieces, harder undo.
3. Store erased intervals as a mask on each line. Rejected: every reader of the drawing (render, fill, export) must learn the mask.

**How (decided):**
- Draw only, by a grid option (for example `free.cut: true`); Views passes nothing.
- Crossings are computed in floats on screen. A cut point is stored as a plain point rounded to 6 decimals
  (Draw has no checker, so exactness is not needed); keys keep the current format (`t:m|t:m`).
- Crossings closer than 1e-6 to a line end or to each other count as one; a remaining piece shorter than
  0.01 cell is dropped.
- Fill (`fillArea`), export, backup and the hit test already read lines from their end points, so they need no change.

**Left to the builder:** where the crossing maths lives (core, with a test), and how the eraser's stroke picks the part.
