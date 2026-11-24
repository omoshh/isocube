# Isometric Puzzles — Android v1 Design

Approved 2026-11-23 by the owner (Sasha). Live copy: https://claude.ai/artifact/UcS8dz4upqxat886ujD4G2

## Intent and why

Version 1 is a native Android app of Isometric Puzzles, published on Google Play as a paid app with a free sampler. It comes in phase 2: first a free web version tests if people want the app (see Release path). Claude Code builds it; the owner (Sasha) decides and tests, and does not write the code.

**Name:** not chosen yet; decide before the closed test. Package ID: `com.sanyart.isopuzzles` (neutral, users do not see it, cannot change after publishing). Use a placeholder app name in the build that is easy to change in one place.

The app trains 3D spatial reasoning with puzzles that you solve by drawing by hand. Paper workbooks run out and give no feedback. This app gives many puzzles, each with exactly one answer, and checks your drawing.

The current single web page (`reference/index.html`, from the artifact "Isometric Drawing Puzzles") is the behaviour reference. The Android app must match its behaviour and conventions unless this document says otherwise.

Users: architecture and engineering students, people who prepare for spatial tests, and hobbyists who like grid drawing and models.

## Release path (decided 2026-11-24)

The owner tests demand with a free web version and short videos before he pays for Google Play.

1. **Phase 1 — web version.** The current web page, made phone-friendly and restyled to the design system (mockups F and H), hosted on GitHub Pages. Everything free during the test phase. Can be added to the home screen as a PWA. A simple, privacy-friendly visit counter is allowed.
2. **Phase 1 — promotion.** A separate account for the app, no face or voice: 7–15 s screen recordings with a text hook ("Can you draw this from 3 views?", the fold animation, a drawing coming together). TikTok or Instagram Reels first, plus Reddit communities (puzzles, architecture students, isometric art) within their rules. Record 6 videos in one evening, post 3 a week for 4 weeks, judge only after the 4 weeks.
3. **Decision point after 4 weeks.** Signals: "where can I get it?" comments, saves and shares, visits and returning visitors. Example bar: 20+ such comments or a few hundred visits → build the Android app. The people who respond become the closed-test testers.
4. **Phase 2 — Android app on Google Play**, as specified in this document.

**Links:** the github.io address only in places the owner can edit (profile bio), not in video captions. When the name is chosen, buy a domain (~€10/year) pointed at GitHub Pages so links never break; later it becomes the app's home page with a Google Play button.

**Web version after the app ships:** a free sampler with the same free puzzles as the app. Do not promise "free forever" in videos.

**F-Droid:** considered, not chosen (needs open source, no Play Billing, small technical audience). Possible later as a free open-source build next to the paid Google Play version.

**Money:** at €3.99 (EU price incl. 21% VAT, minus Google's 15%) ≈ €2.80 per sale → ~9 sales pay back the $25 account. The account is one-time and can publish later apps. Before the purchase goes live, check with VMI or an accountant how to register and declare the income.

## Goals, non-goals, anti-goals

**Goals**

- Publish on Google Play and pass the closed test (12 testers, 14 days).
- A free sampler that shows every level, so a free user sees what the purchase unlocks.
- Drawing with a finger on a phone feels precise, because lines snap to the grid.
- The app checks the drawing and shows missing and extra lines.
- Works fully offline. No account, no server.

**Non-goals for version 1**

- Endless views puzzles made on the phone (comes in an update).
- Daily puzzle.
- Reverse puzzles, slopes and cut corners, adaptive difficulty, export of nets and molds.
- Polished landscape and tablet layouts (the layout must allow them).
- iOS.
- Checking the shading tones.

**Anti-goals** (failure even if it technically works)

- A beginner gets "wrong" for a drawing that shows the correct shape.
- The user loses a half-done drawing on rotation, on a phone call, or when the app goes to the background.
- The paywall surprises the user. The store listing and the app say clearly what is free.
- Ads, subscriptions, or data collection.

## Constraints

- **Google Play account:** new personal developer account ($25, one time). Before production access, a closed test with at least 12 testers opted in for 14 continuous days. Testers must actually use the app.
- **Target API:** Google Play requires API 36 from August 2026 and plans API 37 from August 2027. With API 36 on screens of 600 dp or more, Android ignores the orientation lock unless the app opts out; with API 37 no opt-out. Games set by `android:appCategory` are an exception.
- **Purchases:** Google Play Billing. A payments merchant account must be linked before the purchase can go live.
- **Phone screen:** about 360 dp of width for the drawing in portrait. A grid step of about 40 dp or more is comfortable for a finger with snap; below 30 dp the user misses points.
- **Builder:** Claude Code writes all code. The owner reviews behaviour on his own Android phone, not the code.
- **Language:** English only in version 1 (app and store listing).
- **Puzzle generator:** the old Python generator is not available. Write a new generator from the rules in Content, in Kotlin as a build-time tool, so endless mode can reuse it later.

## Approaches

Chosen: **native Android app in Kotlin with Jetpack Compose** (owner's pick: best touch and stylus feel, first-class Play Billing). Considered and rejected: wrapping the web page with Capacitor (keeps code, but web-view drawing and plugin billing); Godot (full rewrite, menus and store screens harder); Trusted Web Activity (needs the site online, complex purchases).

Port the web page logic (net generator, fold checker, fold animation, drawing rules, views, answer overlay) and keep its tested results.

## Content

**Views puzzles.** You get the top, front and side views and draw the shape on the isometric grid. Keep the book conventions of the web page: seen from the front-left, front = lower-right face, side view from the left, views in a 2×2 layout, key picture with FRONT and SIDE arrows.

A level fixes the base size and the maximum height. For a rectangular base, the orientation (for example 5×4 or 4×5) is picked when the puzzle data is made.

| Level | Base | Max height | Puzzles |
| --- | --- | --- | --- |
| 1 | 3×3 | 2 | ~50 |
| 2 | 3×4 | 3 | ~50 |
| 3 | 4×4 | 3 | ~50 |
| 4 | 4×5 | 4 | ~50 |
| 5 | 5×5 | 4 | ~50 |
| 6 (only if it passes the phone test) | 5×6 | 5 | ~50 |

Screen rule: A + B ≤ 10 is comfortable on a phone; 11–12 is the limit.

**Puzzle data.** The generator keeps only puzzles with exactly one solution and writes them as a JSON file (one height map per puzzle, level, id, orientation). The file ships inside the app. Inside a level, order puzzles from easy to hard (for example by number of cubes and hidden cubes).

**Nets puzzles.** Port from the web page: a shape and 4 nets, choose the net that folds into the shape, 3 levels, new puzzles without limit. Each wrong net is the correct net with one square moved. After the answer, the correct net folds into the shape in 3D; play or scrub with a slider.

## Drawing and draw mode

- **Grid:** isometric (triangular) point grid. Every line runs in one of the 3 isometric directions.
- **Snapped segment:** drag from a point; the line snaps to the nearest grid point in one of the 3 directions (as in the web page).
- **Freehand stroke with snap:** on finger-up, the app turns a free stroke into one or more straight snapped segments along the grid directions. If the app cannot read a stroke, it draws nothing.
- **Fill:** a paint bucket fills a closed face. In puzzles: 3 shading tones. In draw mode: the 3 tones free, a full colour palette paid.
- **Erase, undo, redo, clear.** "Pen only" mode: only a stylus draws; a finger pans or zooms.
- **Zoom and pan:** two fingers. Must work for level 6, tablets and draw mode.
- **Draw mode:** a free grid with no puzzle. The user can keep several drawings, open, rename and delete them.

## Checker

1. Cut every user line into unit segments. Normalize: A→B equals B→A; overlaps count once.
2. Compute the visible shape edges of the answer as unit segments: the outline and the lines where visible faces meet at an angle. Lines between two flat neighbouring visible faces are not shape edges.
3. Missing = in the answer, not in the drawing. Extra = in the drawing, not in the answer.
4. **Tolerant rule:** an extra segment between two flat neighbouring visible faces is not a mistake. All other extra segments are mistakes.
5. Shading tones are not checked.

Correct when no missing and no mistake segments. Otherwise mark missing and mistake segments in two clear styles (colour and line style), with counts. The answer overlay stays a separate action and uses the same edge computation.

## Free part and purchase

One one-time in-app purchase ("Full version") unlocks everything. No subscription, no ads.

| Part | Free | Paid |
| --- | --- | --- |
| Views level 1 | First 15 puzzles | The rest |
| Views levels 2–6 | First 3 puzzles of each level | The rest |
| Nets | Level 1, without limit | Levels 2–3 |
| Draw mode | All tools, 3 shading tones | Full colour palette |
| Accent colours | Yellow, plus accents earned by solved puzzles | All accents at once |

- Locked puzzles are visible with a lock mark; tapping one opens the purchase screen.
- The purchase screen says in one line what the purchase unlocks and shows the price from Google Play. Never hard-code a price.
- "Restore purchase" in settings. Check the purchase at start; offline, use the last known state.
- Acknowledge every purchase.

## Screens and layout

Screens: Home (Views, Nets, Draw, Settings); Level list (progress, lock marks); Views puzzle (views + key picture, grid, tools, Check, Answer, Next); Nets puzzle (shape, 4 nets, result, fold animation with play and slider); Draw mode (list + drawing screen); Purchase; Settings (theme, restore purchase, about).

Layout rule: taller than wide → views panel above the grid, hideable; wider than tall → panel beside the grid; the grid always scales to its space. Do not lock orientation.

**Look:** defined in `docs/design/design-system.md` (mockups F and H: warm paper, black ink, rounded shapes, IBM Plex Mono + Space Grotesk, yellow accent). Light and dark themes (System / Light / Dark). The grid and the views follow the web page: dashed iso line grid, guide hexagon, FRONT/SIDE arrows on the grid; views with plane lines.

**Accent colours:** yellow by default; 6 more accents unlock at 10, 25, 50, 100, 150 and 200 solved puzzles, or all at once with the full version. The check marks never use the accent.

## Saving and state

Nothing is lost on rotation, theme change, a phone call, or process death. Saved on the phone only: drawing of each puzzle, solved state, progress per level, score counter, draw-mode drawings, theme, selected accent, last known purchase state. Save on every change. A solved puzzle stays solved. No account, no cloud sync.

## Launch and testing

Automated tests: fold checker finds exactly the 11 cube nets among the 35 hexominoes; in 450+ runs every generated net folds back, no wrong net folds, every square lands on the correct face; every puzzle in the JSON has exactly one solution; checker cases (own edges → correct; removed edge → one missing; line in empty space → one mistake; flat seams → no mistake); freehand conversion on recorded strokes; free/paid rules.

Manual test on the owner's phone: drawing on levels 1–6 (decides level 6), rotation and background with a half-done drawing, dark theme.

Release: developer account + merchant account; internal testing; closed test (≥12 testers, also license testers); apply for production.

Closed-test engagement: Google counts testers opted in 14 continuous days (leaving and rejoining restarts the count) and is reported to check real usage and reject tests with no activity or fake testers; its own device tests can block access on crashes. So: recruit ~20 testers, give them reasons to open the app every few days, collect feedback and fix 2–3 things during the test (answers for the ~10 production-access questions), fix every crash before applying.

## Later (not in version 1)

Endless views mode on the phone; daily puzzle; reverse puzzles; slopes and cut corners; adaptive difficulty; export of nets and molds; polished landscape/tablet layouts; cube placing as a tutorial and a 3D "show me the shape" hint (never the main mode); hard-mode views without plane lines (own uniqueness check); iOS/iPad.

## Left to the builder

Code structure, libraries, minimum Android version, storage method; exact mark colours; freehand method; store category Game > Puzzle; privacy policy, Data safety form, content rating.
