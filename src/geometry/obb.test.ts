import { describe, expect, it } from 'vitest';
import type { OBB } from './obb';
import { obbAabb, obbCorners, obbsOverlap, pointInObb, unionAabb } from './obb';

const box = (x: number, z: number, w: number, d: number, yaw = 0): OBB => ({ center: { x, z }, halfW: w / 2, halfD: d / 2, yaw });

describe('OBB', () => {
  it('computes axis-aligned corners', () => {
    const [bl, br, fr, fl] = obbCorners(box(0, 0, 200, 100));
    expect(bl).toEqual({ x: -100, z: -50 });
    expect(br).toEqual({ x: 100, z: -50 });
    expect(fr).toEqual({ x: 100, z: 50 });
    expect(fl).toEqual({ x: -100, z: 50 });
  });

  it('rotated 90° swaps the AABB extents', () => {
    const a = obbAabb(box(0, 0, 200, 100, 90));
    expect(a.minX).toBeCloseTo(-50);
    expect(a.maxX).toBeCloseTo(50);
    expect(a.minZ).toBeCloseTo(-100);
    expect(a.maxZ).toBeCloseTo(100);
  });

  it('45° square AABB grows by √2', () => {
    const a = obbAabb(box(10, 0, 100, 100, 45));
    expect(a.maxX - a.minX).toBeCloseTo(100 * Math.SQRT2);
    expect((a.maxX + a.minX) / 2).toBeCloseTo(10);
  });

  it('point containment respects rotation', () => {
    const b = box(0, 0, 200, 20, 90); // long along Z after rotation
    expect(pointInObb({ x: 0, z: 90 }, b)).toBe(true);
    expect(pointInObb({ x: 90, z: 0 }, b)).toBe(false);
  });

  it('detects overlap of axis-aligned boxes', () => {
    expect(obbsOverlap(box(0, 0, 100, 100), box(50, 50, 100, 100))).toBe(true);
    expect(obbsOverlap(box(0, 0, 100, 100), box(200, 0, 100, 100))).toBe(false);
  });

  it('touching edges are not an overlap', () => {
    expect(obbsOverlap(box(0, 0, 100, 100), box(100, 0, 100, 100))).toBe(false);
  });

  it('uses rotated axes (AABBs overlap but OBBs do not)', () => {
    // Two thin diagonal bars side by side: AABBs overlap, shapes don't.
    const a = box(0, 0, 300, 20, 45);
    const b = box(60, 60, 300, 20, 45);
    const aa = obbAabb(a);
    const bb = obbAabb(b);
    expect(aa.maxX > bb.minX && aa.maxZ > bb.minZ).toBe(true);
    expect(obbsOverlap(a, b)).toBe(false);
  });

  it('detects rotated overlap', () => {
    expect(obbsOverlap(box(0, 0, 300, 20, 45), box(0, 0, 300, 20, -45))).toBe(true);
  });

  it('unions AABBs', () => {
    expect(unionAabb([])).toBeNull();
    expect(unionAabb([obbAabb(box(0, 0, 10, 10)), obbAabb(box(100, -100, 10, 10))])).toEqual({ minX: -5, maxX: 105, minZ: -105, maxZ: 5 });
  });
});
