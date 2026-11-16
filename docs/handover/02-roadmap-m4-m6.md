# Handover 2: roadmap for Milestones 4–6

**How to use this doc:** give it to a new Claude Code session on `fred-aghq/schreibtisch` after (or along with) `01-cleanup-refactor.md`. Attach the original project brief if you have it. This doc records what has been built and every decision made since.

File paths assume the cleanup refactor (doc 1) has been merged. If it hasn't, the layout-aware code is still in `src/geometry/` and the ops are in `src/store/ops.ts`.

> **Purpose:** continue the Desk Layout Planner (Schreibtisch) after the cleanup PR. Ask the user to attach the original brief (`desk-planner-brief.md`) as well; this doc records what has been built and every decision made since.

## Working agreement with the user
- **One PR per milestone or big change.** Restart your branch from `main` after each merge. Don't push to `main`.
- **Check in with questions before each milestone.** Recommend a default, so the user can just say "go". Push back where the brief is wrong.
- **At each milestone:** run typecheck, lint and tests, build, run a Playwright browser pass, commit, open the PR, and give a short **"What to try"** list.
- **Dependencies:** must be well maintained and pinned `~major.minor.patch`. Never `latest` or a tag. Ask before adding large ones.
- **No personal seed data.** The user dropped their own setup (T7V, 27"/28"/21" monitors) from the app. Fresh layouts use generic, approximate objects.
- **Configurable values:** desk height, listener distance and ear height must stay configurable. They are.
- The user is actively using the live site, so don't break saved layouts. Bump `schemaVersion` and add a migration for any model change.
- **Deployment:** GitHub Pages (`gh-pages` branch) via `.github/workflows/pages.yml` on push to `main`, with PR previews under `pr-preview/pr-<n>/` via `preview.yml`, at `https://fred-aghq.github.io/schreibtisch/` (`BASE_PATH=/schreibtisch/`). CI is in `ci.yml`.

## What exists (Milestones 1–3 plus the cleanup)
- **Stack:** Vite 8, React 19, TypeScript 6 (strict, `noUncheckedIndexedAccess`), zustand 5, three 0.187, @react-three/fiber 9 / drei 10, Vitest 5, ESLint 10 with typescript-eslint and react-hooks 7 (React Compiler rules), CSS modules with CSS variables (dark default, light mode), zod 4.
- **Conventions:**
  - 1 world unit = 1 mm. Origin is the centre of the desk's front edge, on the top surface. +X right, +Y up, +Z toward the user.
  - The desk spans x ∈ [−W/2, W/2], z ∈ [−D, 0]. The floor is at y = −`heightFromFloor`. The listener's head is at (`listener.x`, `earHeightFromFloor − heightFromFloor`, `distanceFromFrontEdge`).
  - An object's position is the bottom-centre of its footprint.
  - **Yaw** matches three.js `rotation.y`: 0 faces +Z, +90 faces +X, positive is counter-clockwise from above. **Pitch** is positive when the front tips up. `objectEuler` uses order `YXZ` with x = −pitch. See `geometry/transform.ts`: `forwardDir`, `forward3`, `yawFromDir`, `rotatePlan`.
  - The UI never shows bare X/Y/Z. It uses Width / Depth / Height and Left–right / Front–back / Elevation, with the axis letter as a hint.
- **Model:** definitions vs instances; L/R pairs (`pairId`, roles `speakerL`/`speakerR`); `Layout.settings` already has `showTriangle`, `aimOffset`, `tolerances {angleGood 2, angleWarn 5, distGood 20, distWarn 50}`, `mirrorPairs`, `showGuides` and `showFloor`; `schemaVersion` 1 with a migration chain.
- **Store:**
  - Snapshot history with transactions: one drag or one fix is one undo step.
  - Debounced autosave that flushes on `pagehide`.
  - Commands: `addPreset`, `duplicateSelected`, `deleteSelected`, and so on.
  - One `viewCommand` channel with a `seq` number.
- **Views:**
  - **2D:** SVG with zoom to fit and 1:1.
  - **3D:** lazy-loaded, presets 1–5, Shift+drag to move vertically.
  - **Shared:** snapping (edges, centrelines, objects, grid; Alt bypasses), dimension guides, overlap warnings, the monitor generator, presets, Make unique, Save as preset, and the `?` cheat sheet.
- **Gotchas learned:**
  - React Compiler lint forbids setState directly in effects and mutating hook-returned values. Subscribe to the store or use r3f `get()`.
  - drei `<Html>` threw `removeChild` under React 19 StrictMode, so labels use the custom `LabelLayer` / `LabelProjector`.
  - CSS-module class lookups are `string | undefined` under `noUncheckedIndexedAccess`.
  - Headless WebGL needs swiftshader flags.

## Milestone 4: Speaker triangle (the key feature; get the maths right)
**Agreed UI default:** a compact floating readout card over the top-right of the canvas, shown when the triangle is on, in both views. Tolerances and the aim offset sit in a small settings fold inside it. Confirm with the user before building.

**Maths:** a pure module in `layout/triangle.ts`, with general helpers in `geometry/`. Full tests.
- **Speaker selection:** the first instance with role `speakerL` and the first with `speakerR`. Add an Inspector "Speaker role: none / L / R" control so any two objects can be chosen. Assigning a role removes it from any other instance.
- **Acoustic point:** the local point `(0, acousticCentreHeight, d/2)`, which is the centre of the front face at tweeter height. Rotate it by `objectEuler(yaw, pitch)` and add the position. For non-speakers, fall back to h/2.
- **Aim point:** the listener's head centre plus `aimOffset` along +Z (positive means behind the head, further from the desk).
- **Results (in plan / XZ):**
  - side lengths L–R, L–listener, R–listener;
  - interior angles at L, R and the listener (ideal 60°);
  - per speaker:
    - **toe-in error:** the signed angle between `forwardDir(yaw)` and the direction from the acoustic point to the aim point (ideal 0°);
    - **required yaw:** `yawFromDir(aim − footprintCentre)`. This is exact, because the front-centre offset lies on the forward axis.
  - **Symmetry:** |L–listener| − |R–listener| in mm, and the listener's offset from the L–R midpoint, both along and across.
  - **Vertical:** `dy = earY − acousticY`, the vertical angle `atan2(dy, horizontal distance)`, and a suggested pitch equal to that angle.
  - **Back wall** (if set): the distance from each speaker's rear face (the minimum z of its footprint corners) to `wallZ = −D − gap`. Highlight it when the speaker is rear-ported.
- **Tolerance classes:** `classify(abs value, good, warn)` → `green | amber | red`, with angles and distances classified separately.
- **Degenerate cases:** return `null` or "n/a" without NaN when the speakers are at the same point, the listener is collinear with them, a speaker sits exactly at the aim point, or there's no pair.
- **Tests:**
  - a perfect equilateral triangle (all 60°, zero errors);
  - asymmetric placements;
  - rotated speakers;
  - mirrored pairs (L error = −R error);
  - a listener off the centreline;
  - pitch moving the acoustic point;
  - each degenerate case;
  - tolerance boundaries.

**Fixes** (pure ops; each is one `apply`, so one undo step):
- **"Move listener to ideal":** the apex of the equilateral triangle on segment L–R, on the listener's current side, usually +z. Set `listener.x` and `distanceFromFrontEdge` from the apex. Keep the ear height.
- **"Move speakers to ideal":** keep the listener. The user chooses one of:
  - keep the current L–R spacing `s`; or
  - keep the listener distance (the mean of the two L/R–listener distances).

  Place the acoustic points at the listener ± (s/2 across, s·√3/2 toward the desk), mirrored about `listener.x`. Convert each back to a footprint position by subtracting the rotated front offset, and keep each speaker's y. Also aim both.
- **"Aim speakers at listener":** set both yaws to the required yaw.
- **Ghost previews:** while hovering a fix, show the target positions dashed in 2D and translucent in 3D.

**Rendering:**
- **2D SVG:** triangle edges, angle arcs with labels, side lengths, an actual ray and an ideal ray per speaker, coloured by tolerance.
- **3D:** the same lines on a horizontal plane at ear height, as `lineSegments`, with labels through `LabelLayer`.
- **T** toggles `settings.showTriangle`, also from a top-bar overlay toggle. Update the cheat sheet, which currently says "coming next".
- **Listener:** draggable and editable everywhere already. Add a measuring reminder in the card.

## Milestone 5: Onboarding wizard and auto-arrange
- **Wizard behaviour:** a modal wizard runs on first launch (a localStorage flag such as `schreibtisch:onboarded`) and can be re-run from a menu. Every step can be skipped, Back always works, and it never overwrites a layout without asking: offer New layout / Replace current / Cancel.
- **Steps:**
  1. Welcome: what the app does, and 1 mm = 1 CSS px at 100%.
  2. Desk: width, depth, thickness and height from floor. Presets 120×60, 140×70, 160×80 and 180×80 cm, or custom. Live mini preview using the plan SVG.
  3. You: distance from the desk front edge to your ears, and ear height from the floor (defaults 600 / 1200). Include a one-line measuring hint for each, and explain that they drive the triangle.
  4. Items: a checklist with quantity and dimensions.
     - Monitors: count, plus diagonal / aspect / stand-or-mount for each, via the monitor generator.
     - Speakers: added as a pair by default; preset or custom size plus acoustic-centre height.
     - Lights, keyboard, mouse, mat and so on, from `BUILT_IN_PRESETS`.
  5. Auto-arrange, then open the editor with the triangle on.
- **Auto-arrange** (pure and tested in `layout/arrange.ts`):
  - **Primary monitor:** centred on `listener.x`, near the back.
  - **Other monitors:** beside it edge to edge, each yawed toward the listener's head.
  - **Speakers:** an equilateral triangle with the listener. Choose a side length that clears the monitors with some margin, within a sensible range of about 0.9–1.4 m. If that puts them off the desk, place them anyway and report it in the wizard's final message.
  - **Keyboard and mouse:** at the front, the mouse to the right.
  - **Mat:** under the keyboard and mouse.
  - Run the overlap check afterwards.

## Milestone 6: Ship it
- **Layouts:** named layouts in localStorage (an index plus one key per layout), switch / rename / delete, and **Duplicate layout** for A/B comparisons. Migrate the existing single `schreibtisch:current-layout` key into the list.
- **JSON:** export the layout as a file; import with validation through the zod schema and `migrateLayout`, showing friendly errors.
- **PNG export of the current view:**
  - 2D: serialise the SVG, draw it to a canvas, and convert to PNG. Inline the computed CSS variables first.
  - 3D: `gl.domElement.toDataURL()`. `preserveDrawingBuffer` is already on.
- **"Load example":** a generic example layout, not the user's personal setup.
- **Nice-to-have:** a share link with the layout compressed into the URL hash (`lz-string ~1.5.0`), validated on load.
- **Polish pass:** empty states, laptop widths down to about 1280 px, focus states, and the cheat sheet.
- **Docker:**
  - A multi-stage `Dockerfile`: `node:22-alpine` build with `BASE_PATH=/`, then `nginx` (pinned minor) serving `dist`.
  - `nginx.conf`: SPA fallback, long cache for `/assets`, no-cache for `index.html`.
  - `docker-compose.yml` exposing port 8080.
  - README self-hosting section.
- **Final README pass.**

## Per-milestone checklist
1. Restart the branch from `main`.
2. Check in with questions and recommended defaults.
3. Build, adding tests for all maths.
4. Run `npm run check` and the build.
5. Do a Playwright pass with screenshots and look at them.
6. Commit, then push with retries.
7. Open the PR, with the 🤖 footer.
8. Give a "What to try" list.

## Testing tips (learned the hard way)
- **Preview the build:** `npm run build && npx vite preview --port 4173 --strictPort`, then drive it with a Playwright script that `require('playwright')`. Chromium is preinstalled; don't run `playwright install`.
- **3D needs software WebGL:** `chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })`. Give the first 3D render about 2.5 s.
- **Field labels include the axis hint,** so the accessible name is "Left–right X". Select fields with `getByLabel(/^Left–right/)`, scoped to the Inspector (`locator('aside').nth(1)`).
- **Finding objects in 3D:** there's no DOM for meshes. Switch to Top view (key `1`), then sweep clicks across the canvas until the Inspector's label input shows the object you want.
- **Autosave** is debounced at 400 ms and flushed on `pagehide`. Test persistence with an immediate `page.reload()`.
- **Always look at screenshots.** Several layout and readability issues were only caught visually.
