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

export const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
export const add3 = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub3 = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale3 = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const dot3 = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const len3 = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});

export function normalize3(a: Vec3): Vec3 {
  const l = len3(a);
  return l === 0 ? { x: 0, y: 0, z: 0 } : scale3(a, 1 / l);
}
