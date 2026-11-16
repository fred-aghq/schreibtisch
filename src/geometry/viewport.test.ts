import { describe, expect, it } from 'vitest';
import { fitBounds, MAX_SCALE, pan, screenToWorld, worldToScreen, zoomAt, zoomTo } from './viewport';

describe('viewport', () => {
  const vp = { scale: 1, offsetX: 400, offsetY: 300 };

  it('at 100 % one mm is one CSS pixel', () => {
    const a = worldToScreen(vp, { x: 0, z: 0 });
    const b = worldToScreen(vp, { x: 1600, z: 0 });
    expect(b.x - a.x).toBe(1600);
  });

  it('world ↔ screen round trips', () => {
    const v = { scale: 0.37, offsetX: 12, offsetY: -40 };
    const w = screenToWorld(v, worldToScreen(v, { x: 123.4, z: -567.8 }));
    expect(w.x).toBeCloseTo(123.4);
    expect(w.z).toBeCloseTo(-567.8);
  });

  it('zooms toward the cursor (the point under it stays put)', () => {
    const anchor = { x: 250, y: 100 };
    const before = screenToWorld(vp, anchor);
    const z = zoomAt(vp, anchor, 2.5);
    expect(z.scale).toBe(2.5);
    const after = screenToWorld(z, anchor);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.z).toBeCloseTo(before.z);
  });

  it('clamps zoom', () => {
    expect(zoomAt(vp, { x: 0, y: 0 }, 1e6).scale).toBe(MAX_SCALE);
    expect(zoomTo({ ...vp, scale: 0.4 }, { x: 0, y: 0 }, 1).scale).toBe(1);
  });

  it('pans in screen pixels', () => {
    expect(pan(vp, 10, -5)).toEqual({ scale: 1, offsetX: 410, offsetY: 295 });
  });

  it('fits a 1600×800 desk into a laptop-sized canvas', () => {
    const fit = fitBounds({ minX: -800, maxX: 800, minZ: -800, maxZ: 0 }, 1000, 600, 50);
    expect(fit.scale).toBeCloseTo(900 / 1600);
    // Centre of the bounds lands at the centre of the canvas.
    const c = worldToScreen(fit, { x: 0, z: -400 });
    expect(c.x).toBeCloseTo(500);
    expect(c.y).toBeCloseTo(300);
  });
});
