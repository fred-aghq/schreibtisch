# Schreibtisch

Plan where things go on your desk (monitors, speakers, lights, keyboard and so on) at real-world scale, in a 2D top-down view and a 3D view, with a speaker-triangle overlay for nearfield monitors.

Everything runs in the browser. There is no backend, and layouts are saved to `localStorage`.

## Conventions

- **1 world unit = 1 mm.** At 100 % zoom in the 2D view, 1 mm = 1 CSS pixel. A CSS pixel isn't a physical millimetre on most screens.
- **Origin:** the centre of the desk's front edge, on the top surface. +X = right, +Y = up, +Z = toward you.
  The desk spans x ∈ [−W/2, W/2], z ∈ [−D, 0].
- **Object position** is the bottom-centre of its footprint. Elevation 0 means it sits on the desk.
- **Yaw:** 0° means the object's front faces you. Positive values turn it toward your right (counter-clockwise seen from above).

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
  geometry/       pure TS: units, transforms, OBB/SAT, viewport, expression parser (+ tests)
  model/          types, defaults, schema migration, validation
  store/          zustand store, transactional undo history, layout ops, persistence
  views/plan2d/   SVG top-down view
  ui/             panels and inputs
  app/            shell, theme, keyboard shortcuts
```

## Deployment

### GitHub Pages

`.github/workflows/pages.yml` builds and deploys every push to `main`. One-time setup: **Settings → Pages → Source: GitHub Actions**. The repository must be public on a free plan.

The build reads `BASE_PATH` (for example `/schreibtisch/`) so assets resolve under the project-site path.

### Self-hosting (Docker)

Coming in milestone 6.
