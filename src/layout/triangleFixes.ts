import { yawFromDir } from '../geometry/transform';
import type { Vec2 } from '../geometry/vec';
import { setListener, updateInstance } from '../model/ops';
import type { Layout, ObjectInstance } from '../model/types';
import { listenerHead } from './scene';
import { acousticOffset, aimPoint, analyzeTriangle, findSpeakerPair } from './triangle';

/**
 * One-click fixes for the speaker triangle. Each is a pure Layout → Layout op (one undo step when
 * applied). They place both speakers explicitly, so they bypass pair mirroring, and they never move
 * a locked speaker. When nothing can be done they return the layout unchanged.
 */

const SQRT3_2 = Math.sqrt(3) / 2;
const EPS = 1e-6;

export type SpeakerFitMode = 'distance' | 'spacing';

/** Move the listener to the apex of the equilateral triangle on the current speakers (ear height kept). */
export function moveListenerToIdeal(layout: Layout): Layout {
  const t = analyzeTriangle(layout);
  if (!t || t.sides.lr < EPS) return layout;
  const { left: L, right: R, listener: P } = t.corners;
  const mid = { x: (L.x + R.x) / 2, z: (L.z + R.z) / 2 };
  const u = { x: (R.x - L.x) / t.sides.lr, z: (R.z - L.z) / t.sides.lr };
  // The two perpendiculars; use the listener's side, or the side toward the user if on the line.
  let n = { x: -u.z, z: u.x };
  const side = (P.x - mid.x) * n.x + (P.z - mid.z) * n.z;
  if (side < -EPS || (Math.abs(side) <= EPS && n.z < 0)) n = { x: -n.x, z: -n.z };
  const h = t.sides.lr * SQRT3_2;
  return setListener(layout, { x: mid.x + n.x * h, distanceFromFrontEdge: mid.z + n.z * h });
}

/** Ideal acoustic points (plan) for side length `s`: mirrored about the listener, toward the desk. */
export function idealSpeakerPoints(listener: Vec2, s: number): { left: Vec2; right: Vec2 } {
  const z = listener.z - s * SQRT3_2;
  return { left: { x: listener.x - s / 2, z }, right: { x: listener.x + s / 2, z } };
}

/** Put a speaker's acoustic point at `target` (plan), aimed at the aim point; elevation and pitch kept. */
function placeSpeaker(layout: Layout, inst: ObjectInstance, target: Vec2): Layout {
  const def = layout.definitions[inst.definitionId];
  if (!def || inst.locked) return layout;
  const aim = aimPoint(layout);
  const dir = { x: aim.x - target.x, z: aim.z - target.z };
  const yaw = Math.hypot(dir.x, dir.z) < EPS ? inst.rotation.yaw : yawFromDir(dir);
  const o = acousticOffset(def, yaw, inst.rotation.pitch);
  return updateInstance(layout, inst.id, { position: { x: target.x - o.x, z: target.z - o.z }, rotation: { yaw } });
}

/**
 * Keep the listener; move both speakers into an equilateral triangle with it, aimed at the aim
 * point. `spacing` keeps the current L–R distance; `distance` keeps the mean listener distance.
 */
export function moveSpeakersToIdeal(layout: Layout, mode: SpeakerFitMode): Layout {
  const t = analyzeTriangle(layout);
  const pair = findSpeakerPair(layout);
  if (!t || !pair) return layout;
  const s = mode === 'spacing' ? t.sides.lr : (t.sides.leftListener + t.sides.rightListener) / 2;
  if (s < EPS) return layout;
  const head = listenerHead(layout);
  const ideal = idealSpeakerPoints({ x: head.x, z: head.z }, s);
  return placeSpeaker(placeSpeaker(layout, pair.left, ideal.left), pair.right, ideal.right);
}

/** Turn both speakers so they point at the aim point. */
export function aimSpeakersAtListener(layout: Layout): Layout {
  const t = analyzeTriangle(layout);
  if (!t) return layout;
  let out = layout;
  for (const s of [t.left, t.right]) {
    if (!s.locked && s.requiredYaw !== null) out = updateInstance(out, s.id, { rotation: { yaw: s.requiredYaw } });
  }
  return out;
}

/**
 * Tilt both speakers so their acoustic axis points at ear height. Tilting moves the tweeter a little,
 * so this refines the angle a few times (it converges within a hundredth of a degree).
 */
export function tiltSpeakersToEars(layout: Layout): Layout {
  let out = layout;
  for (let i = 0; i < 4; i++) {
    const t = analyzeTriangle(out);
    if (!t) return layout;
    for (const s of [t.left, t.right]) {
      const pitch = s.vertical.suggestedPitch;
      if (!s.locked && pitch !== null) out = updateInstance(out, s.id, { rotation: { pitch } });
    }
  }
  return out;
}
