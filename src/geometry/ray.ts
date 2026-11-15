import type { Vec3 } from './vec';
import { add3, dot3, normalize3, scale3, sub3 } from './vec3';

export interface Ray {
  origin: Vec3;
  direction: Vec3;
}

export interface Plane {
  point: Vec3;
  normal: Vec3;
}

/** Intersection of a ray with a plane, or null if parallel or behind the ray origin. */
export function intersectRayPlane(ray: Ray, plane: Plane, eps = 1e-9): Vec3 | null {
  const denom = dot3(plane.normal, ray.direction);
  if (Math.abs(denom) < eps) return null;
  const t = dot3(plane.normal, sub3(plane.point, ray.origin)) / denom;
  if (t < 0) return null;
  return add3(ray.origin, scale3(ray.direction, t));
}

/** Horizontal plane through `point` (used for normal 3D drags). */
export function horizontalPlane(point: Vec3): Plane {
  return { point, normal: { x: 0, y: 1, z: 0 } };
}

/**
 * Vertical plane through `point` that faces the camera as much as possible (used for
 * modifier-drags that change elevation). Returns null when looking straight down,
 * where vertical motion can't be read from the mouse.
 */
export function verticalPlaneFacing(point: Vec3, viewDir: Vec3, minHorizontal = 0.05): Plane | null {
  const horizontal = { x: viewDir.x, y: 0, z: viewDir.z };
  if (Math.hypot(horizontal.x, horizontal.z) < minHorizontal) return null;
  return { point, normal: normalize3(horizontal) };
}
