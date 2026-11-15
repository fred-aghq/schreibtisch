/** Minimal immutable 2D/3D vector helpers. Plan coordinates use (x, z). */

export interface Vec2 {
  x: number;
  z: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const v2 = (x: number, z: number): Vec2 => ({ x, z });
export const add2 = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, z: a.z + b.z });
export const sub2 = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, z: a.z - b.z });
export const scale2 = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, z: a.z * s });
export const dot2 = (a: Vec2, b: Vec2): number => a.x * b.x + a.z * b.z;
export const len2 = (a: Vec2): number => Math.hypot(a.x, a.z);
export const dist2 = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z);
/** z-component-free 2D cross product (x*z' - z*x'). */
export const cross2 = (a: Vec2, b: Vec2): number => a.x * b.z - a.z * b.x;

export function normalize2(a: Vec2): Vec2 {
  const l = len2(a);
  return l === 0 ? { x: 0, z: 0 } : { x: a.x / l, z: a.z / l };
}

export const toPlan = (p: Vec3): Vec2 => ({ x: p.x, z: p.z });
