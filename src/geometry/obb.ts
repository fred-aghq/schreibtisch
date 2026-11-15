import { localToWorldPlan, rotatePlan } from './transform';
import type { Vec2 } from './vec';

/** An oriented rectangle in plan: centre, half extents along local X / Z, yaw in degrees. */
export interface OBB {
  center: Vec2;
  halfW: number;
  halfD: number;
  yaw: number;
}

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Corners in order: back-left, back-right, front-right, front-left (local −Z is back). */
export function obbCorners(b: OBB): [Vec2, Vec2, Vec2, Vec2] {
  const { halfW: w, halfD: d } = b;
  return [
    localToWorldPlan({ x: -w, z: -d }, b.center, b.yaw),
    localToWorldPlan({ x: w, z: -d }, b.center, b.yaw),
    localToWorldPlan({ x: w, z: d }, b.center, b.yaw),
    localToWorldPlan({ x: -w, z: d }, b.center, b.yaw),
  ];
}

export function obbAabb(b: OBB): AABB {
  const cs = obbCorners(b);
  return pointsAabb(cs);
}

export function pointsAabb(points: readonly Vec2[]): AABB {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  return { minX, maxX, minZ, maxZ };
}

export function unionAabb(boxes: readonly AABB[]): AABB | null {
  if (boxes.length === 0) return null;
  return boxes.reduce((a, b) => ({
    minX: Math.min(a.minX, b.minX),
    maxX: Math.max(a.maxX, b.maxX),
    minZ: Math.min(a.minZ, b.minZ),
    maxZ: Math.max(a.maxZ, b.maxZ),
  }));
}

export function pointInObb(p: Vec2, b: OBB): boolean {
  const local = rotatePlan({ x: p.x - b.center.x, z: p.z - b.center.z }, -b.yaw);
  return Math.abs(local.x) <= b.halfW && Math.abs(local.z) <= b.halfD;
}

/**
 * Separating Axis Theorem test for two oriented rectangles.
 * Touching edges (zero-area contact, within `eps`) do not count as overlapping.
 */
export function obbsOverlap(a: OBB, b: OBB, eps = 1e-6): boolean {
  const ca = obbCorners(a);
  const cb = obbCorners(b);
  const axes: Vec2[] = [
    rotatePlan({ x: 1, z: 0 }, a.yaw),
    rotatePlan({ x: 0, z: 1 }, a.yaw),
    rotatePlan({ x: 1, z: 0 }, b.yaw),
    rotatePlan({ x: 0, z: 1 }, b.yaw),
  ];
  for (const axis of axes) {
    const [aMin, aMax] = project(ca, axis);
    const [bMin, bMax] = project(cb, axis);
    if (aMax <= bMin + eps || bMax <= aMin + eps) return false;
  }
  return true;
}

function project(points: readonly Vec2[], axis: Vec2): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    const v = p.x * axis.x + p.z * axis.z;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}
