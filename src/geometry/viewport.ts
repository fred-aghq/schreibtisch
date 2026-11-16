import { clamp } from './math';
import type { AABB } from './obb';
import type { Vec2 } from './vec';

/**
 * 2D plan viewport. `scale` is CSS px per mm (1 = 100 % zoom).
 * screen = world * scale + offset, with world (x, z) → screen (x, y).
 */
export interface Viewport {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export const MIN_SCALE = 0.02;
export const MAX_SCALE = 20;

export function worldToScreen(vp: Viewport, p: Vec2): ScreenPoint {
  return { x: p.x * vp.scale + vp.offsetX, y: p.z * vp.scale + vp.offsetY };
}

export function screenToWorld(vp: Viewport, s: ScreenPoint): Vec2 {
  return { x: (s.x - vp.offsetX) / vp.scale, z: (s.y - vp.offsetY) / vp.scale };
}

/** Zoom by `factor` keeping the world point under `anchor` (screen px) fixed. */
export function zoomAt(vp: Viewport, anchor: ScreenPoint, factor: number): Viewport {
  const scale = clamp(vp.scale * factor, MIN_SCALE, MAX_SCALE);
  const world = screenToWorld(vp, anchor);
  return { scale, offsetX: anchor.x - world.x * scale, offsetY: anchor.y - world.z * scale };
}

/** Set an absolute scale, keeping the world point under `anchor` fixed. */
export function zoomTo(vp: Viewport, anchor: ScreenPoint, scale: number): Viewport {
  return zoomAt(vp, anchor, scale / vp.scale);
}

export function pan(vp: Viewport, dx: number, dy: number): Viewport {
  return { ...vp, offsetX: vp.offsetX + dx, offsetY: vp.offsetY + dy };
}

/** Fit `bounds` into a `width`×`height` screen area with `padding` px on every side. */
export function fitBounds(bounds: AABB, width: number, height: number, padding = 40): Viewport {
  const bw = Math.max(bounds.maxX - bounds.minX, 1);
  const bh = Math.max(bounds.maxZ - bounds.minZ, 1);
  const availW = Math.max(width - 2 * padding, 1);
  const availH = Math.max(height - 2 * padding, 1);
  const scale = clamp(Math.min(availW / bw, availH / bh), MIN_SCALE, MAX_SCALE);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  return { scale, offsetX: width / 2 - cx * scale, offsetY: height / 2 - cz * scale };
}
