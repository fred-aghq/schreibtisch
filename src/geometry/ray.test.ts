import { describe, expect, it } from 'vitest';
import { horizontalPlane, intersectRayPlane, verticalPlaneFacing } from './ray';

describe('ray / plane', () => {
  it('hits a horizontal plane from above', () => {
    const p = intersectRayPlane({ origin: { x: 0, y: 1000, z: 1000 }, direction: { x: 0, y: -1, z: -1 } }, horizontalPlane({ x: 0, y: 0, z: 0 }));
    expect(p).not.toBeNull();
    expect(p!.x).toBeCloseTo(0);
    expect(p!.y).toBeCloseTo(0);
    expect(p!.z).toBeCloseTo(0);
  });

  it('respects the plane height', () => {
    const p = intersectRayPlane({ origin: { x: 0, y: 500, z: 0 }, direction: { x: 1, y: -1, z: 0 } }, horizontalPlane({ x: 0, y: 200, z: 0 }));
    expect(p!.x).toBeCloseTo(300);
    expect(p!.y).toBeCloseTo(200);
  });

  it('returns null when parallel or behind', () => {
    expect(intersectRayPlane({ origin: { x: 0, y: 10, z: 0 }, direction: { x: 1, y: 0, z: 0 } }, horizontalPlane({ x: 0, y: 0, z: 0 }))).toBeNull();
    expect(intersectRayPlane({ origin: { x: 0, y: 10, z: 0 }, direction: { x: 0, y: 1, z: 0 } }, horizontalPlane({ x: 0, y: 0, z: 0 }))).toBeNull();
  });

  it('builds a camera-facing vertical plane, or none when looking straight down', () => {
    const plane = verticalPlaneFacing({ x: 0, y: 0, z: 0 }, { x: 0, y: -0.5, z: -1 });
    expect(plane).not.toBeNull();
    expect(plane!.normal.y).toBe(0);
    expect(plane!.normal.z).toBeCloseTo(-1);
    expect(verticalPlaneFacing({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 })).toBeNull();
  });

  it('a vertical plane converts screen-vertical motion into height', () => {
    const plane = verticalPlaneFacing({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 })!;
    const hit = intersectRayPlane({ origin: { x: 0, y: 250, z: 2000 }, direction: { x: 0, y: 0, z: -1 } }, plane);
    expect(hit!.y).toBeCloseTo(250);
    expect(hit!.z).toBeCloseTo(0);
  });
});
