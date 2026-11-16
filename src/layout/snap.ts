import type { Layout } from '../model/types';
import { instanceObb, listenerPlan, visibleItems } from './scene';
import { obbAabb } from '../geometry/obb';
import { degToRad, snapTo } from '../geometry/math';
import type { Vec2 } from '../geometry/vec';

export type SnapKind = 'desk-edge' | 'centreline' | 'listener' | 'object-edge' | 'object-centre';

/** A world line x = value (for xs) or z = value (for zs), with the span along the other axis it covers. */
export interface SnapLine {
  value: number;
  kind: SnapKind;
  span: [number, number];
}

export interface SnapTargets {
  xs: SnapLine[];
  zs: SnapLine[];
}

export interface SnapResult {
  pos: Vec2;
  /** The line snapped to on each axis (for drawing guides), or null if grid / free. */
  lineX: SnapLine | null;
  lineZ: SnapLine | null;
}

/** Half-extents of the axis-aligned box around a rotated footprint. */
export function aabbHalfExtents(w: number, d: number, yawDeg: number): { hx: number; hz: number } {
  const c = Math.abs(Math.cos(degToRad(yawDeg)));
  const s = Math.abs(Math.sin(degToRad(yawDeg)));
  return { hx: (c * w + s * d) / 2, hz: (s * w + c * d) / 2 };
}

/** Desk edges, desk centreline, listener centreline, and the edges / centres of other visible objects. */
export function buildSnapTargets(layout: Layout, exclude: ReadonlySet<string>): SnapTargets {
  const { width: W, depth: D } = layout.desk;
  const lp = listenerPlan(layout);
  const xs: SnapLine[] = [
    { value: -W / 2, kind: 'desk-edge', span: [-D, 0] },
    { value: W / 2, kind: 'desk-edge', span: [-D, 0] },
    { value: 0, kind: 'centreline', span: [-D, Math.max(0, lp.z)] },
  ];
  if (Math.abs(lp.x) > 1e-6) xs.push({ value: lp.x, kind: 'listener', span: [-D, lp.z] });
  const zs: SnapLine[] = [
    { value: 0, kind: 'desk-edge', span: [-W / 2, W / 2] },
    { value: -D, kind: 'desk-edge', span: [-W / 2, W / 2] },
  ];
  for (const { inst, def } of visibleItems(layout)) {
    if (exclude.has(inst.id)) continue;
    const b = obbAabb(instanceObb(inst, def));
    const zSpan: [number, number] = [b.minZ, b.maxZ];
    const xSpan: [number, number] = [b.minX, b.maxX];
    xs.push({ value: b.minX, kind: 'object-edge', span: zSpan }, { value: b.maxX, kind: 'object-edge', span: zSpan }, { value: (b.minX + b.maxX) / 2, kind: 'object-centre', span: zSpan });
    zs.push({ value: b.minZ, kind: 'object-edge', span: xSpan }, { value: b.maxZ, kind: 'object-edge', span: xSpan }, { value: (b.minZ + b.maxZ) / 2, kind: 'object-centre', span: xSpan });
  }
  return { xs, zs };
}

function snapAxis(centre: number, half: number, lines: readonly SnapLine[], threshold: number): { offset: number; line: SnapLine } | null {
  let best: { offset: number; line: SnapLine } | null = null;
  for (const line of lines) {
    for (const edge of [centre - half, centre, centre + half]) {
      const offset = line.value - edge;
      if (Math.abs(offset) <= threshold && (!best || Math.abs(offset) < Math.abs(best.offset))) best = { offset, line };
    }
  }
  return best;
}

/**
 * Snap a box (centre `pos`, AABB half-extents) to the nearest target line within `threshold` mm
 * on each axis independently. Axes with no nearby line fall back to the grid (`gridStep` 0 = off).
 */
export function snapBox(pos: Vec2, half: { hx: number; hz: number }, targets: SnapTargets, threshold: number, gridStep: number): SnapResult {
  const sx = snapAxis(pos.x, half.hx, targets.xs, threshold);
  const sz = snapAxis(pos.z, half.hz, targets.zs, threshold);
  return {
    pos: {
      x: sx ? pos.x + sx.offset : snapTo(pos.x, gridStep),
      z: sz ? pos.z + sz.offset : snapTo(pos.z, gridStep),
    },
    lineX: sx?.line ?? null,
    lineZ: sz?.line ?? null,
  };
}

/**
 * Snap a dragged instance at raw plan position `raw`. It ignores itself and its L/R partner
 * (the partner mirrors it, so snapping to it would fight). `threshold` is in mm.
 */
export function snapInstance(layout: Layout, instanceId: string, raw: Vec2, threshold: number, bypass: boolean): SnapResult {
  const inst = layout.instances.find((i) => i.id === instanceId);
  const def = inst ? layout.definitions[inst.definitionId] : undefined;
  const { snapEnabled, snapStep } = layout.settings;
  if (!inst || !def || !snapEnabled || bypass) return { pos: raw, lineX: null, lineZ: null };
  const exclude = new Set([inst.id]);
  if (inst.pairId) for (const i of layout.instances) if (i.pairId === inst.pairId) exclude.add(i.id);
  const half = aabbHalfExtents(def.size.w, def.size.d, inst.rotation.yaw);
  return snapBox(raw, half, buildSnapTargets(layout, exclude), threshold, snapStep);
}

/** Snap the listener's head: to the desk centreline in x, else the grid. */
export function snapListener(layout: Layout, raw: Vec2, threshold: number, bypass: boolean): SnapResult {
  const { snapEnabled, snapStep } = layout.settings;
  if (!snapEnabled || bypass) return { pos: raw, lineX: null, lineZ: null };
  const D = layout.desk.depth;
  const targets: SnapTargets = { xs: [{ value: 0, kind: 'centreline', span: [-D, raw.z] }], zs: [] };
  return snapBox(raw, { hx: 0, hz: 0 }, targets, threshold, snapStep);
}
