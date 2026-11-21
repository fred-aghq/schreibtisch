# Schreibtisch

Plan where things go on your desk (monitors, speakers, lights, keyboard and so on) at real-world scale, in a 2D top-down view and a 3D view, with a speaker-triangle overlay for nearfield monitors.

Everything runs in the browser. There is no backend, and layouts are saved to `localStorage`.

## Conventions

- **1 world unit = 1 mm.** At 100 % zoom in the 2D view, 1 mm = 1 CSS pixel. A CSS pixel isn't a physical millimetre on most screens.
- **Origin:** the centre of the desk's front edge, on the top surface. +X = right, +Y = up, +Z = toward you.
  The desk spans x ∈ [−W/2, W/2], z ∈ [−D, 0].
- **Object position** is the bottom-centre of its footprint. Elevation 0 means it sits on the desk.
- **Yaw:** 0° means the object's front faces you. Positive values turn it toward your right (counter-clockwise seen from above).

## Using it

| Action | 2D plan | 3D |
|---|---|---|
| Select | click | click |
| Move | drag (Alt = no snap) | drag on the horizontal plane; **Shift**+drag changes height |
| Pan | drag empty space, Space+drag, middle mouse, two-finger scroll | right-drag |
| Zoom | mouse wheel / pinch (toward cursor) | scroll |
| Orbit | | drag empty space |
| Fit | **F** | **F** |
| Camera presets | | **1** Top, **2** Front, **3** Side, **4** Isometric, **5** Seated |

Other shortcuts: arrows nudge 1 mm (Shift = 10 mm), Q/E rotate 1° (Shift = 15°), Ctrl+D duplicate, Del delete, Ctrl+Z / Ctrl+Shift+Z undo/redo, Esc deselect, **?** cheat sheet.

### Definitions, instances and pairs

- A **definition** is a reusable template (size, colour, speaker/monitor details). An **instance** is one placement of a definition. Editing a size changes every instance that shares the definition. Use **Make unique** to give one instance its own copy.
- **Pairs:** speakers are added as a linked left/right pair (any library item can be added with **Pair**). With **Mirror pairs** on, moving or rotating one mirrors the other across the listener's centreline (x mirrored, yaw negated). **Unlink** breaks the link.
- **Snapping:** objects snap to desk edges, the desk centreline, the listener's centreline, and other objects' edges and centres. When nothing is in range they snap to the grid (1/5/10/50 mm). Hold **Alt** to bypass.
- **Overlap warnings:** objects whose footprints intersect (as oriented boxes) get a red outline, but only if they also overlap in height. Desk mats are ignored.
- **Save as preset** keeps any object in Library → My presets (stored in your browser).

### Setup wizard and saved layouts

- **Setup…** (top bar) walks through your desk, where you sit, and your gear, then auto-arranges a starting layout: the main monitor centred on you, other monitors beside it turned toward you, the speakers in an equilateral triangle with you (smallest side from 0.9–1.4 m that clears the monitors), keyboard and mouse at the front. It tells you if a speaker needs a stand or anything overlaps. Every step can be skipped, and Back keeps your answers.
- In a brand-new browser (no Schreibtisch data at all) the wizard opens by itself once; **Skip setup** closes it for good.
- **Save** (Ctrl+S) keeps a copy of the current layout, under its name, in this browser. **Layouts** lists saved copies to open or delete. The current layout is also autosaved, so a reload never loses work; "unsaved" means it differs from its saved copy. The wizard and opening another layout warn before replacing unsaved changes.

### Speaker triangle

Press **T** (or **Triangle** in the top bar) to show the triangle between your two speakers and your head, in both views. In 3D it's drawn at ear height.

- The corners are each speaker's **acoustic point** (the centre of the front face at the tweeter height you enter, after yaw and tilt) and the centre of your head. The speakers are the objects whose **Speaker role** is Left / Right; a speaker pair gets these automatically, and you can give any object a role in the Inspector.
- The card shows side lengths, the three angles (60° is ideal), **toe-in** (how far each speaker should turn to point at you: ↺ counter-clockwise from above, like Q; ↻ clockwise, like E), how far your ears are above each tweeter, symmetry, and the gap to the back wall if you've set one.
- Colours follow the tolerances in the card: green within ±2° / ±20 mm, amber within ±5° / ±50 mm, red beyond.
- **Fixes**, each one undo step (hover to preview): move the listener to the ideal spot, move the speakers into an equilateral triangle (keeping their distance to you, or their spacing), aim them at you, and tilt them to ear height. Locked speakers are left alone.
- **Aim offset** aims the speakers that far behind the centre of your head (default 0).
- The biggest unknown is usually your listening distance: sit normally and measure from the desk's front edge to roughly between your ears.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # typecheck + lint + tests
npm run build      # production build in dist/
```

Non-trivial maths lives in `src/geometry` and `src/layout` and is unit-tested with Vitest. Components only do simple layout arithmetic (placing an SVG element, padding a label).

Dependencies point one way: `lib` / `geometry` → `model` → `layout` → `store` → `views`, `ui`.

```
src/
  lib/            small helpers: debounce, number/mm formatting, the field expression parser ("300+45"), DOM checks
  geometry/       domain-free maths: vectors, angles, transforms, oriented boxes (SAT), rays, the 2D viewport,
                  the monitor panel generator
  model/          types, zod schemas, migrations, defaults, presets, categories, and the pure layout
                  ops (move, mirror pairs, duplicate, delete, …)
  layout/         layout-aware computations: scene bounds and visible items, snapping, overlaps, dimension
                  guides, desk grid, listener body, camera poses, and the drag core shared by both views
  store/          zustand store (document + UI + view state), transactional undo history, commands,
                  persistence, and initStore() (loading and autosave)
  views/plan2d/   SVG top-down view
  views/scene3d/  react-three-fiber 3D view (lazy-loaded)
  ui/             panels and inputs
  app/            shell, theme, keyboard shortcuts
```

Saved and imported layouts go through `model/migrate.ts`: older schema versions are upgraded step by step, missing fields are filled with defaults, and the result is validated against `model/schema.ts`.

## Deployment

### GitHub Pages

`.github/workflows/pages.yml` builds every push to `main` and publishes it to the root of the `gh-pages` branch. One-time setup: **Settings → Pages → Source: Deploy from a branch → `gh-pages` / `(root)`**. The repository must be public on a free plan.

`.github/workflows/preview.yml` publishes each pull request to `pr-preview/pr-<number>/` on the same branch (for example `https://fred-aghq.github.io/schreibtisch/pr-preview/pr-12/`), comments the link on the PR, and removes it when the PR closes. Production deploys leave `pr-preview/` alone. PRs from forks aren't previewed. Preview builds set `VITE_STORAGE_NAMESPACE`, so their saved layouts, presets and theme are kept apart from production's.

The build reads `BASE_PATH` (for example `/schreibtisch/`) so assets resolve under the project-site path.

### Self-hosting (Docker)

Coming in milestone 6.
