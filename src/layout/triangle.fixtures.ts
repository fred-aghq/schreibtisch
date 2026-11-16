import { forwardDir } from '../geometry/transform';
import type { Vec2 } from '../geometry/vec';
import { createDefaultLayout, makeDefinition, makeInstance } from '../model/defaults';
import type { Layout } from '../model/types';

/** Test speakers: 200 W × 300 D × 350 H, tweeter 280 mm up. */
export const SPK = { w: 200, d: 300, h: 350, ac: 280 } as const;
export const DESK_H = 740;

/** Footprint position that puts a yaw-rotated (pitch 0) speaker's acoustic point at `acoustic`. */
export function footprintFor(acoustic: Vec2, yaw: number): Vec2 {
  const f = forwardDir(yaw);
  return { x: acoustic.x - (SPK.d / 2) * f.x, z: acoustic.z - (SPK.d / 2) * f.z };
}

/**
 * A layout with only a speaker pair: acoustic points at `left` / `right` (plan), turned to the given
 * yaws, and the listener's head at `listener` with ears level with the tweeters.
 */
export function speakerLayout(opts: { left: Vec2; right: Vec2; leftYaw: number; rightYaw: number; listener: Vec2 }): Layout {
  const base = createDefaultLayout();
  const def = makeDefinition('speaker', 'Speaker', { w: SPK.w, d: SPK.d, h: SPK.h }, { speaker: { acousticCentreHeight: SPK.ac, rearPorted: true } });
  const lp = footprintFor(opts.left, opts.leftYaw);
  const rp = footprintFor(opts.right, opts.rightYaw);
  return {
    ...base,
    desk: { ...base.desk, heightFromFloor: DESK_H },
    listener: { x: opts.listener.x, distanceFromFrontEdge: opts.listener.z, earHeightFromFloor: DESK_H + SPK.ac },
    definitions: { [def.id]: def },
    instances: [
      makeInstance(def, { label: 'L', role: 'speakerL', pairId: 'p', position: { x: lp.x, y: 0, z: lp.z }, rotation: { yaw: opts.leftYaw, pitch: 0 } }),
      makeInstance(def, { label: 'R', role: 'speakerR', pairId: 'p', position: { x: rp.x, y: 0, z: rp.z }, rotation: { yaw: opts.rightYaw, pitch: 0 } }),
    ],
  };
}

export const H = Math.sqrt(3) / 2;

/** A perfect 1 m equilateral triangle, listener on the centreline 600 mm from the desk edge. */
export function perfectLayout(): Layout {
  return speakerLayout({ left: { x: -500, z: 600 - 1000 * H }, right: { x: 500, z: 600 - 1000 * H }, leftYaw: 30, rightYaw: -30, listener: { x: 0, z: 600 } });
}

/** Fails if any number anywhere in `v` is NaN or infinite. */
export function expectFinite(v: unknown, path = 'value'): void {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`${path} is ${v}`);
  } else if (Array.isArray(v)) {
    v.forEach((x, i) => expectFinite(x, `${path}[${i}]`));
  } else if (typeof v === 'object' && v !== null) {
    for (const [k, x] of Object.entries(v)) expectFinite(x, `${path}.${k}`);
  }
}
