# Handover 1: cleanup refactor (PR #4)

**How to use this doc:** give it to a new Claude Code session on `fred-aghq/schreibtisch` together with `02-roadmap-m4-m6.md`. Do this cleanup first.

**State when written:** `main` at `b81aab4` (Milestones 1–3 merged, 121 tests). The plan comes from a code review (Fable) that was checked against that commit. Some review points were already fixed by Milestone 3 (`QUICK_ADD`, the stale "Coming in milestone 2" tooltip, and the mirror/yaw/OBB helpers that were unused at the time).

The paths below describe the code **before** the refactor. The target structure says where everything ends up.

> **Purpose:** a behaviour-preserving refactor before Milestone 4. Ship it as one PR (#4). The app must look and behave exactly the same afterwards.

## Ground rules
- Repo `fred-aghq/schreibtisch`. Develop on the branch the session gives you, open a PR to `main`, and don't push to `main`.
- Keep `npm run check` green (typecheck, lint, Vitest, currently 121 tests) after each step. Commit in logical steps.
- Move tests along with the code they test. Add tests for anything that becomes testable, especially the store.
- Pin new dependencies as `~major.minor.patch`. The only new one is **zod `~4.6.7`**; ask before adding anything else.
- The user wants check-ins. Report at the end with a short "what changed / what to try" list. Since behaviour doesn't change, "try" means re-checking the main flows.

## Target structure (one-way dependencies: `lib` / `geometry` → `model` → `layout` → `store` → `views`, `ui`)
```
src/
  lib/        debounce.ts, dom.ts (isTypingTarget), format.ts (formatMm), expr.ts (+ tests)
  geometry/   domain-free maths only: vec.ts (merge vec.ts + vec3.ts), math.ts (clamp, snapTo,
              niceLength, normalizeDeg, deg/rad), transform.ts, obb.ts, ray.ts, viewport.ts,
              monitor.ts (panelArea from numeric aspect only)  — no imports from model/
  model/      types.ts, schema.ts (zod, typed as z.ZodType<Layout>), migrate.ts, defaults.ts,
              presets.ts, categories.ts, ids.ts, ops.ts (moved from store/ops.ts)
  layout/     Layout-aware computations: scene.ts (bounds, listenerHead, floorY, visibleItems),
              listenerBody.ts (one set of chair/torso dimensions for 2D and 3D), grid.ts (grid
              line segments for both views), snap.ts, overlap.ts, guides.ts, mirror.ts,
              cameraPoses.ts (was geometry/camera.ts minus labels), drag.ts (shared drag core)
  store/      store.ts (document + ui + view slices), commands.ts, history.ts, persistence.ts,
              init.ts (initStore: load, autosave subscription, pagehide/visibility flush)
  views/plan2d/  PlanView.tsx (composition only), usePlanViewport.ts, usePlanDrag.ts, wheel.ts
                 (classifyWheel), PlanObject.tsx, ScreenLabels.tsx, SnapGuides.tsx,
                 DimensionGuides.tsx, ScaleBar.tsx, ZoomControls.tsx, shapes.tsx
  views/scene3d/ unchanged split; dragController uses layout/drag.ts; colours.ts exports a Colours type
  ui/            Inspector split by section where it helps (InstanceInspector, MonitorSection,
                 LayoutInspector); TextField.tsx; ColourField.tsx
```

## Steps (in order)

### 1. Move pure layout ops into the model (`store/ops.ts` → `model/ops.ts`)
- Move the file and its tests (`ops.test.ts`, `pairs.test.ts`). Update imports.
- Add ops for edits that currently bypass it:
  - `setBackWall(layout, BackWall | null)`, replacing the inline spreads in `Inspector.tsx`.
  - `renameLayout(layout, name)`, replacing the inline spread in `TopBar.tsx`.
- **Enforce the locked rule inside the ops.** `moveInstance` and `deleteInstance` return the layout unchanged for a locked instance. Remove the scattered `inst.locked` checks from callers. Keep the UI disabled states, which are presentation. Add tests.

### 2. Store commands (`store/commands.ts`)
- Add `addPreset(preset, { pair })`, `duplicateSelected()`, `deleteSelected()`, `nudgeSelected(dx, dz)` and `rotateSelected(deg)`.
- Each applies the op and updates the selection.
- This replaces the `let id; apply(l => {…}); select(id)` pattern in `useShortcuts.ts`, `Inspector.tsx`, `Sidebar.tsx` and `Library.tsx` (`useAdd`).

### 3. One view-command channel, and view state in the store
- Replace `fitRequest` (counter), `zoomRequest` (nullable, cleared by the consumer) and `cameraRequest` (`{preset, seq}`) with:
  ```ts
  viewCommand: { seq: number; cmd: { kind: 'fit' } | { kind: 'zoom'; scale: number } | { kind: 'camera'; preset: CameraPreset | 'fit' } } | null
  ```
- Views handle a command when its `seq` is newer than the last one they handled. That last-handled `seq` is stored in the view slice, not a module variable.
- Add a non-persisted view slice: `planViewport: Viewport | null` and `cameraPose: CameraPose | null`.
  - These replace the module-level `memory` in `views/plan2d/PlanView.tsx` and `views/scene3d/CameraRig.tsx`.
  - Write the camera pose only on OrbitControls `end` and when a transition finishes, not every frame.
- `zoom` and `cursor` stay in the store for the status bar.

### 4. No side effects at import (`store/init.ts`)
- `store.ts` creates the store from `createDefaultLayout()` and nothing else.
- `initStore()` is called from `main.tsx`. It loads the saved layout, theme and presets, subscribes debounced autosave, and attaches the `pagehide` and `visibilitychange` flush listeners.
- Add `store.test.ts` covering: apply/undo, transactions through drags, commands, the view-command `seq`, and `initStore` with a stubbed `localStorage`.

### 5. Split `PlanView.tsx` and share the drag core with 3D
- **`layout/drag.ts`** (pure and tested):
  - Target type: `{ kind: 'object', id } | { kind: 'listener' }`.
  - `targetPosition(layout, target)`.
  - `moveTarget(layout, target, pos)`: uses `moveInstance` (mirroring) for objects and `setListener` for the listener, converting y to ear height.
  - `snapTarget(layout, target, raw, thresholdMm, bypass)`: wraps `snapInstance` / `snapListener`.
  - A small `DragSession` helper for the 3 px threshold and `beginTx` / `endTx` / `cancelTx`, with the store calls injected so it stays testable.
- **2D:** `usePlanDrag` maps a pointer to the world via `screenToWorld`. Shift does nothing in 2D.
- **3D:** `dragController.ts` maps a pointer to a ray, then to a plane (`geometry/ray.ts`).
- Both handle Esc-cancel in one place.
- Move the sub-components (`PlanObject`, `ScreenLabels`, `SnapGuides`, `DimensionGuides`, `ScaleBar`, `ZoomControls`) to their own files.
- `usePlanViewport` owns resize, fit/zoom commands, the wheel, and space-to-pan.

### 6. Geometry boundaries and small misplacements
- `geometry/scene.ts`, `snap.ts`, `overlap.ts`, `guides.ts`, `mirror.ts` and `camera.ts` → `layout/`.
- `PRESET_LABELS` → `views/scene3d`.
- `expr.ts` → `lib/`. `formatMm` → `lib/format.ts`. `classifyWheel` → `views/plan2d/wheel.ts`.
- `debounce` → `lib/`. The `Theme` type → `store/`.
- Merge `vec.ts` and `vec3.ts`. Move `clamp`, `snapTo` and `niceLength` from `units.ts` into `geometry/math.ts`.
- `geometry/monitor.ts` takes `[a, b]`. The `AspectRatio` → `[a, b]` map lives in `model/presets.ts`.
- Add `layout/scene.ts#visibleItems(layout)`, returning `{inst, def}[]` for visible instances. Use it in PlanView, SceneView, `layoutAabb`, `sceneSphere`, `findOverlaps` and `buildSnapTargets`.
- `layout/grid.ts#deskGridLines(desk, spacing, minSpacing?)` is used by `plan2d/shapes.tsx` (`GridLines`) and `scene3d/meshes.tsx` (`DeskGrid`).
- `layout/listenerBody.ts` replaces `CHAIR` in `geometry/scene.ts` and the hardcoded numbers in `Listener3D`. That includes the seat height of 470 from the floor, the seat depth of 460 and the torso size.
- `views/scene3d/colours.ts` exports `type SceneColours`, and `meshes.tsx` imports it.
- Delete dead code: `pointInObb` and `isLayout`. Keep the 2D vector helpers and `forward3`, because Milestone 4 needs them.
- `isTypingTarget` → `lib/dom.ts`, used by `useShortcuts.ts` and the 2D space-to-pan handler.

### 7. Undo granularity
- **`ui/TextField.tsx`:** keeps a local draft and commits on blur or Enter; Esc reverts. Use it for the layout name (`TopBar`), the instance label (`Inspector`) and the scene-list rename.
- **`ui/ColourField.tsx`:** calls `beginTx` on focus or pointerdown, applies `onInput` live, and calls `endTx` on blur or change, so one picker session is one undo step. Use it for the object and desk colours.

### 8. Validation with zod
- Add `zod ~4.6.7`. Write `model/schema.ts` with `LayoutSchema: z.ZodType<Layout>` (plus sub-schemas), so any drift between the schema and the types is a compile error.
- `migrate.ts` keeps its migration chain and default-filling, then calls `LayoutSchema.safeParse`.
- Map zod issues to the same friendly `path: message` strings, plus the referential check that every `instance.definitionId` exists.
- Delete `validate.ts`. Existing `migrate.test.ts` cases must still pass; add cases for settings and monitor extras.
- Also use the schema in `persistence.ts#loadUserPresets` via a `PresetSchema`.

### 9. Docs
- README: replace "React components never do maths inline" with an accurate statement. Non-trivial maths lives in `geometry/` and `layout/` and is tested; components only do simple layout arithmetic.
- Update the folder tree.

## Verification
- `npm run check` and `npm run build` pass. Also run `BASE_PATH=/schreibtisch/ npx vite build` and confirm the asset paths are prefixed.
- Rerun the Playwright checks against `npx vite preview --port 4173`. Launch Chromium with `args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader']` for WebGL.
  - **2D:** drag, undo, `300+45` in a field, 1:1 zoom, theme toggle, and autosave across an immediate reload.
  - **3D:** presets 1–5; select and drag the keyboard in Top view, then undo; Shift+drag the monitor so only elevation changes; switch 2D ↔ 3D and confirm the camera and viewport are kept.
  - **Milestone 3 features:** dragging the left speaker mirrors the right one; overlaps are flagged; generate a 34" 21:9 monitor on a stand (810 × 356 mm, lifted to 100); Make unique; Save as preset → My presets; rename; `?` dialog.
  - **New:** typing a label then pressing Ctrl+Z undoes it in one step; a colour-picker session is one undo step; a locked object can't be moved by keys, drag or Inspector.
  - No console errors.
