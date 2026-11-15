import type { Layout } from '../model/types';
import { layoutAabb, listenerHead } from './scene';
import { degToRad } from '../geometry/math';
import type { Vec3 } from '../geometry/vec';
import { add3, len3, normalize3, scale3, sub3 } from '../geometry/vec';

export const CAMERA_PRESETS = ['top', 'front', 'side', 'iso', 'seated'] as const;
export type CameraPreset = (typeof CAMERA_PRESETS)[number];

export interface CameraPose {
  position: Vec3;
  target: Vec3;
}

export interface Sphere {
  center: Vec3;
  radius: number;
}

/** Bounding sphere of the desk, listener head and visible objects. */
export function sceneSphere(layout: Layout): Sphere {
  const plan = layoutAabb(layout);
  let minY = -layout.desk.thickness;
  let maxY = Math.max(0, listenerHead(layout).y);
  for (const inst of layout.instances) {
    const def = layout.definitions[inst.definitionId];
    if (!def || !inst.visible) continue;
    // Plan extents are already covered by layoutAabb; only y needs widening here.
    minY = Math.min(minY, inst.position.y);
    maxY = Math.max(maxY, inst.position.y + def.size.h);
  }
  const center = { x: (plan.minX + plan.maxX) / 2, y: (minY + maxY) / 2, z: (plan.minZ + plan.maxZ) / 2 };
  const radius = 0.5 * Math.hypot(plan.maxX - plan.minX, maxY - minY, plan.maxZ - plan.minZ);
  return { center, radius: Math.max(radius, 1) };
}

/** Camera distance at which a sphere fills the view (limited by the narrower FOV). */
export function fitDistance(radius: number, vFovDeg: number, aspect: number, margin = 1.05): number {
  const v = degToRad(vFovDeg);
  const h = 2 * Math.atan(Math.tan(v / 2) * Math.max(aspect, 1e-3));
  const fov = Math.min(v, h);
  return (radius * margin) / Math.sin(fov / 2);
}

/** Direction from the target toward the camera for each orbit preset. */
export function presetDirection(preset: Exclude<CameraPreset, 'seated'>): Vec3 {
  switch (preset) {
    case 'top':
      // A tiny +Z tilt keeps "up" on screen pointing to the back of the desk, like the 2D plan.
      return normalize3({ x: 0, y: 1, z: 1e-3 });
    case 'front':
      return normalize3({ x: 0, y: Math.sin(degToRad(12)), z: Math.cos(degToRad(12)) });
    case 'side':
      return normalize3({ x: Math.cos(degToRad(12)), y: Math.sin(degToRad(12)), z: 0 });
    case 'iso':
      return normalize3({ x: 1, y: 0.95, z: 1.25 });
  }
}

/** Pose for a preset, framing the whole scene (seated uses the listener's eyes). */
export function cameraPose(preset: CameraPreset, layout: Layout, vFovDeg: number, aspect: number): CameraPose {
  if (preset === 'seated') return seatedPose(layout);
  const sphere = sceneSphere(layout);
  const dist = fitDistance(sphere.radius, vFovDeg, aspect);
  return { position: add3(sphere.center, scale3(presetDirection(preset), dist)), target: sphere.center };
}

/** Eyes at the listener's head, looking straight ahead at the desk, slightly down. */
export function seatedPose(layout: Layout): CameraPose {
  const head = listenerHead(layout);
  return {
    position: head,
    target: { x: head.x, y: head.y - 0.18 * (head.z + layout.desk.depth * 0.6), z: -layout.desk.depth * 0.6 },
  };
}

/** Keep the current viewing direction but move so the whole scene fits. */
export function fitPose(current: CameraPose, layout: Layout, vFovDeg: number, aspect: number): CameraPose {
  const sphere = sceneSphere(layout);
  const offset = sub3(current.position, current.target);
  const dir = len3(offset) > 0 ? normalize3(offset) : presetDirection('iso');
  return { position: add3(sphere.center, scale3(dir, fitDistance(sphere.radius, vFovDeg, aspect))), target: sphere.center };
}

/** Smoothstep easing for camera transitions. */
export function easeInOut(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}
