import { yawFromDir } from '../geometry/transform';
import type { Vec2, Vec3 } from '../geometry/vec';
import { setListener, updateInstance } from '../model/ops';
import type { Layout, ObjectDefinition, ObjectInstance } from '../model/types';
import { listenerHead } from './scene';
import { acousticOffset, aimPoint, analyzeTriangle, findSpeakerPair } from './triangle';
import type { TriangleReading } from './triangle';

/**
 * One-click fixes for the speaker triangle. Each is a pure Layout → Layout op (one undo step when
 * applied). They place both speakers explicitly, so they bypass pair mirroring, and they never move
 * a locked speaker. When nothing can be done they return the layout unchanged.
 */

const SQRT3_2 = Math.sqrt(3) / 2;
const EPS = 1e-6;
/** Changes smaller than these are treated as "already there", so a fix applied twice changes nothing. */
const MM_EPS = 0.01;
const DEG_EPS = 0.001;

const near = (a: number, b: number, eps: number) => Math.abs(a - b) <= eps;

/** Set an instance's plan position and/or yaw / pitch, skipping changes too small to matter. */
function setPose(layout: Layout, inst: ObjectInstance, pose: { x?: number; z?: number; yaw?: number; pitch?: number }): Layout {
  const { position: p, rotation: r } = inst;
  const moved = (pose.x !== undefined && !near(pose.x, p.x, MM_EPS)) || (pose.z !== undefined && !near(pose.z, p.z, MM_EPS));
  const turned = pose.yaw !== undefined && Math.abs(signedDegDiff(pose.yaw, r.yaw)) > DEG_EPS;
  const tilted = pose.pitch !== undefined && !near(pose.pitch, r.pitch, DEG_EPS);
  if (!moved && !turned && !tilted) return layout;
  return updateInstance(layout, inst.id, {
    ...(moved ? { position: { x: pose.x ?? p.x, z: pose.z ?? p.z } } : {}),
    ...(turned || tilted ? { rotation: { yaw: turned && pose.yaw !== undefined ? pose.yaw : r.yaw, pitch: tilted && pose.pitch !== undefined ? pose.pitch : r.pitch } } : {}),
  });
}

function signedDegDiff(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

function instance(layout: Layout, id: string): ObjectInstance | undefined {
  return layout.instances.find((i) => i.id === id);
}

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
  const x = mid.x + n.x * h;
  const z = mid.z + n.z * h;
  if (near(x, layout.listener.x, MM_EPS) && near(z, layout.listener.distanceFromFrontEdge, MM_EPS)) return layout;
  return setListener(layout, { x, distanceFromFrontEdge: z });
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
  return setPose(layout, inst, { x: target.x - o.x, z: target.z - o.z, yaw });
}

/**
 * Keep the listener; move both speakers into an equilateral triangle with it, aimed at the aim
 * point. `spacing` keeps the current L–R distance; `distance` keeps the mean listener distance.
 */
export function moveSpeakersToIdeal(layout: Layout, mode: SpeakerFitMode): Layout {
  const t = analyzeTriangle(layout);
  if (!t) return layout;
  const s = mode === 'spacing' ? t.sides.lr : (t.sides.leftListener + t.sides.rightListener) / 2;
  return placeSpeakerPair(layout, s);
}

/** Place the speaker pair in an equilateral triangle of side `s` with the listener, aimed at the aim point. */
export function placeSpeakerPair(layout: Layout, s: number): Layout {
  const pair = findSpeakerPair(layout);
  if (!pair || s < EPS) return layout;
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
    const inst = instance(out, s.id);
    if (inst && !s.locked && s.requiredYaw !== null) out = setPose(out, inst, { yaw: s.requiredYaw });
  }
  return out;
}

/**
 * Tilt both speakers so their acoustic axis points at ear height. Tilting moves the tweeter a little,
 * so this refines the angle until it settles (well within a thousandth of a degree).
 */
export function tiltSpeakersToEars(layout: Layout): Layout {
  let out = layout;
  for (let i = 0; i < 20; i++) {
    const t = analyzeTriangle(out);
    if (!t) return layout;
    let biggest = 0;
    for (const s of [t.left, t.right]) {
      const pitch = s.vertical.suggestedPitch;
      const inst = instance(out, s.id);
      if (!inst || s.locked || pitch === null) continue;
      biggest = Math.max(biggest, Math.abs(pitch - inst.rotation.pitch));
      out = updateInstance(out, s.id, { rotation: { pitch } });
    }
    if (biggest < DEG_EPS / 100) break;
  }
  // Report "no change" when the speakers were already (near enough) pointing at the ears.
  const before = analyzeTriangle(layout);
  const unchanged = before && [before.left, before.right].every((s) => s.locked || s.vertical.tiltError === null || Math.abs(s.vertical.tiltError) <= DEG_EPS);
  return unchanged ? layout : out;
}

export type TriangleFix = 'listener' | 'speakers' | 'aim' | 'tilt';

/** Apply one of the fixes by name (`mode` only matters for 'speakers'). */
export function applyTriangleFix(layout: Layout, fix: TriangleFix, mode: SpeakerFitMode): Layout {
  switch (fix) {
    case 'listener':
      return moveListenerToIdeal(layout);
    case 'speakers':
      return moveSpeakersToIdeal(layout, mode);
    case 'aim':
      return aimSpeakersAtListener(layout);
    case 'tilt':
      return tiltSpeakersToEars(layout);
  }
}

export interface FixGhosts {
  /** Speakers the fix would move or turn, at their new pose. */
  speakers: { inst: ObjectInstance; def: ObjectDefinition }[];
  /** The listener's new head position, if the fix moves the listener. */
  listener: Vec3 | null;
  /** The triangle as it would be after the fix. */
  reading: TriangleReading | null;
}

/** What a fix would change, for drawing hover previews. Null when it would change nothing. */
export function fixGhosts(layout: Layout, fix: TriangleFix, mode: SpeakerFitMode): FixGhosts | null {
  const next = applyTriangleFix(layout, fix, mode);
  if (next === layout) return null;
  const speakers: FixGhosts['speakers'] = [];
  for (const inst of next.instances) {
    const before = layout.instances.find((i) => i.id === inst.id);
    const def = next.definitions[inst.definitionId];
    if (def && before && (before.position !== inst.position || before.rotation !== inst.rotation)) speakers.push({ inst, def });
  }
  const listener = next.listener === layout.listener ? null : listenerHead(next);
  return { speakers, listener, reading: analyzeTriangle(next) };
}
