import { normalizeDeg, radToDeg } from './math';
import type { Vec2 } from './vec';

/**
 * Plan angles in degrees, using the yaw convention (positive = counter-clockwise seen from above,
 * i.e. turning +Z toward +X). See geometry/transform.ts.
 */

/** Signed angle that turns direction `from` onto direction `to`, in (−180, 180]. Null for a zero vector. */
export function signedAngleDeg(from: Vec2, to: Vec2): number | null {
  if ((from.x === 0 && from.z === 0) || (to.x === 0 && to.z === 0)) return null;
  // Yaw of a direction is atan2(x, z); the difference of two yaws is the turn between them.
  const cross = from.z * to.x - from.x * to.z;
  const dot = from.x * to.x + from.z * to.z;
  return normalizeDeg(radToDeg(Math.atan2(cross, dot)));
}

/** Unsigned angle (0–180°) at vertex `at` between the rays to `a` and `b`. Null if either ray is zero-length. */
export function interiorAngleDeg(a: Vec2, at: Vec2, b: Vec2): number | null {
  const s = signedAngleDeg({ x: a.x - at.x, z: a.z - at.z }, { x: b.x - at.x, z: b.z - at.z });
  return s === null ? null : Math.abs(s);
}
