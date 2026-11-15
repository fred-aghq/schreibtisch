import { degToRad, normalizeDeg, radToDeg } from './units';
import type { Vec2 } from './vec';

/**
 * Yaw convention (matches three.js `rotation.y`):
 *  - rotation about +Y (up), positive = counter-clockwise when viewed from above;
 *  - at yaw 0 an object's front faces +Z (toward the user);
 *  - at yaw +90 its front faces +X (the user's right).
 *
 * In the 2D plan view (+X right, +Z down the screen) positive yaw is therefore
 * counter-clockwise on screen.
 */

/** Rotate a local plan offset (lx, lz) by `yawDeg` into world orientation. */
export function rotatePlan(local: Vec2, yawDeg: number): Vec2 {
  const t = degToRad(yawDeg);
  const c = Math.cos(t);
  const s = Math.sin(t);
  return { x: local.x * c + local.z * s, z: -local.x * s + local.z * c };
}

/** Inverse of rotatePlan: world orientation back to local. */
export function unrotatePlan(world: Vec2, yawDeg: number): Vec2 {
  return rotatePlan(world, -yawDeg);
}

/** Unit vector of an object's forward (front-facing) direction in plan. */
export function forwardDir(yawDeg: number): Vec2 {
  const t = degToRad(yawDeg);
  return { x: Math.sin(t), z: Math.cos(t) };
}

/** The yaw (degrees, normalised) whose forward direction points along `dir`. */
export function yawFromDir(dir: Vec2): number {
  if (dir.x === 0 && dir.z === 0) return 0;
  return normalizeDeg(radToDeg(Math.atan2(dir.x, dir.z)));
}

/** Local → world for a plan point on an object at `pos` with `yawDeg`. */
export function localToWorldPlan(local: Vec2, pos: Vec2, yawDeg: number): Vec2 {
  const r = rotatePlan(local, yawDeg);
  return { x: pos.x + r.x, z: pos.z + r.z };
}

/** Mirror a plan position across the vertical plane x = centreX. */
export function mirrorX(x: number, centreX: number): number {
  return 2 * centreX - x;
}

/** Mirror a yaw across a plane parallel to Z (x → mirrored ⇒ yaw → −yaw). */
export function mirrorYaw(yawDeg: number): number {
  return normalizeDeg(-yawDeg);
}

/**
 * Three.js Euler angles (order "YXZ": yaw first, then pitch about the object's own X axis)
 * for an object rotation. Positive pitch tips the front (+Z) upward, which is a negative
 * rotation about +X.
 */
export function objectEuler(yawDeg: number, pitchDeg: number): { x: number; y: number; z: number; order: 'YXZ' } {
  return { x: -degToRad(pitchDeg), y: degToRad(yawDeg), z: 0, order: 'YXZ' };
}

/** World-space forward (front-facing) unit vector including pitch. */
export function forward3(yawDeg: number, pitchDeg: number): { x: number; y: number; z: number } {
  const t = degToRad(yawDeg);
  const p = degToRad(pitchDeg);
  return { x: Math.sin(t) * Math.cos(p), y: Math.sin(p), z: Math.cos(t) * Math.cos(p) };
}
