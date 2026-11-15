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

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # typecheck + lint + tests
npm run build      # production build in dist/
```

Pure geometry and maths live in `src/geometry` and are unit-tested with Vitest. React components never do maths inline.

```
src/
  geometry/       pure TS: units, transforms, OBB/SAT, snapping, guides, overlaps, monitor generator,
                  viewport, rays, camera presets, expression parser (+ tests)
  model/          types, defaults, built-in presets, schema migration, validation
  store/          zustand store, transactional undo history, layout ops, persistence
  views/plan2d/   SVG top-down view
  views/scene3d/  react-three-fiber 3D view (lazy-loaded)
  ui/             panels and inputs
  app/            shell, theme, keyboard shortcuts
```

## Deployment

### GitHub Pages

`.github/workflows/pages.yml` builds and deploys every push to `main`. One-time setup: **Settings → Pages → Source: GitHub Actions**. The repository must be public on a free plan.

The build reads `BASE_PATH` (for example `/schreibtisch/`) so assets resolve under the project-site path.

### Self-hosting (Docker)

Coming in milestone 6.
