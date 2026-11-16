import { interiorAngleDeg, signedAngleDeg } from '../geometry/angles';
import { radToDeg } from '../geometry/math';
import { obbCorners } from '../geometry/obb';
import { forwardDir, rotateLocal, yawFromDir } from '../geometry/transform';
import type { Vec2, Vec3 } from '../geometry/vec';
import { dist2, sub2 } from '../geometry/vec';
import type { Layout, ObjectDefinition, ObjectInstance, Tolerances } from '../model/types';
import { instanceObb, listenerHead } from './scene';

/**
 * The speaker-triangle maths. Everything is measured in plan (the XZ plane) except the vertical
 * readings. The triangle's corners are the two speakers' acoustic points and the listener's head.
 */

export type ToleranceClass = 'green' | 'amber' | 'red';

/** Good within ±good, acceptable within ±warn, otherwise red. Uses the absolute value. */
export function classify(value: number, good: number, warn: number): ToleranceClass {
  const v = Math.abs(value);
  if (v <= good) return 'green';
  if (v <= warn) return 'amber';
  return 'red';
}

export const classifyAngle = (deg: number, t: Tolerances): ToleranceClass => classify(deg, t.angleGood, t.angleWarn);
export const classifyDistance = (mm: number, t: Tolerances): ToleranceClass => classify(mm, t.distGood, t.distWarn);

export interface SpeakerPair {
  left: ObjectInstance;
  right: ObjectInstance;
  leftDef: ObjectDefinition;
  rightDef: ObjectDefinition;
}

/** The first instance with role speakerL and the first with speakerR, or null if either is missing. */
export function findSpeakerPair(layout: Layout): SpeakerPair | null {
  const left = layout.instances.find((i) => i.role === 'speakerL');
  const right = layout.instances.find((i) => i.role === 'speakerR');
  const leftDef = left ? layout.definitions[left.definitionId] : undefined;
  const rightDef = right ? layout.definitions[right.definitionId] : undefined;
  if (!left || !right || !leftDef || !rightDef) return null;
  return { left, right, leftDef, rightDef };
}

/** Height of the acoustic axis above the object's base: the tweeter for speakers, mid-height otherwise. */
export function acousticHeight(def: ObjectDefinition): number {
  return def.speaker?.acousticCentreHeight ?? def.size.h / 2;
}

/** The acoustic point's offset from the footprint position: the centre of the front face at tweeter height. */
export function acousticOffset(def: ObjectDefinition, yaw: number, pitch: number): Vec3 {
  return rotateLocal({ x: 0, y: acousticHeight(def), z: def.size.d / 2 }, yaw, pitch);
}

/** World position of an object's acoustic point, taking position and rotation into account. */
export function acousticPoint(inst: ObjectInstance, def: ObjectDefinition): Vec3 {
  const o = acousticOffset(def, inst.rotation.yaw, inst.rotation.pitch);
  return { x: inst.position.x + o.x, y: inst.position.y + o.y, z: inst.position.z + o.z };
}

/** Where speakers should point: the head centre, moved `aimOffset` mm further from the desk. */
export function aimPoint(layout: Layout): Vec3 {
  const head = listenerHead(layout);
  return { ...head, z: head.z + layout.settings.aimOffset };
}

export interface SpeakerReading {
  id: string;
  label: string;
  locked: boolean;
  rearPorted: boolean;
  acoustic: Vec3;
  /** Plan direction the speaker faces. */
  forward: Vec2;
  /** Plan distance from the acoustic point to the listener's head, mm. */
  distanceToListener: number;
  /**
   * Signed angle (°) from where the speaker points to where it should point (the aim point);
   * the yaw to add to fix it. Null when the speaker sits on the aim point.
   */
  toeInError: number | null;
  /** The yaw that aims the speaker at the aim point. Null when it sits on the aim point. */
  requiredYaw: number | null;
  vertical: {
    /** Ear height minus acoustic-centre height, mm (+ = ears are higher). */
    dy: number;
    /** Elevation angle from the acoustic point up to the ears, °. Null with no horizontal distance. */
    angle: number | null;
    /** Pitch that points the tweeter at ear height (equal to `angle`). */
    suggestedPitch: number | null;
  };
  /** Gap from the cabinet's rear to the back wall, mm (negative = it pokes through). Null with no wall. */
  wallDistance: number | null;
}

export interface TriangleReading {
  left: SpeakerReading;
  right: SpeakerReading;
  /** Plan positions of the three corners. */
  corners: { left: Vec2; right: Vec2; listener: Vec2 };
  aim: Vec3;
  earY: number;
  sides: { lr: number; leftListener: number; rightListener: number };
  /** Interior angles (ideal 60°). Null when the triangle is degenerate (coincident or collinear corners). */
  angles: { left: number; right: number; listener: number } | null;
  symmetry: {
    /** |L–listener| − |R–listener|, mm (+ = the left speaker is further away). */
    distanceDiff: number;
    /** Listener offset along L→R from the L–R midpoint, mm (+ = toward the right speaker). Null if the speakers coincide. */
    offsetAlong: number | null;
    /** Listener distance from the L–R line, mm (ideal: lr·√3/2). Null if the speakers coincide. */
    offsetAcross: number | null;
  };
}

const EPS = 1e-6;

const plan = (v: Vec3): Vec2 => ({ x: v.x, z: v.z });

function readSpeaker(layout: Layout, inst: ObjectInstance, def: ObjectDefinition, listener: Vec3, aim: Vec3): SpeakerReading {
  const acoustic = acousticPoint(inst, def);
  const forward = forwardDir(inst.rotation.yaw);
  const toAim = sub2(plan(aim), plan(acoustic));
  const atAim = Math.hypot(toAim.x, toAim.z) < EPS;
  const centre = { x: inst.position.x, z: inst.position.z };
  const fromCentre = sub2(plan(aim), centre);
  const horizontal = dist2(plan(acoustic), plan(listener));
  const dy = listener.y - acoustic.y;
  const angle = horizontal < EPS ? null : radToDeg(Math.atan2(dy, horizontal));
  let wallDistance: number | null = null;
  if (layout.backWall) {
    const wallZ = -layout.desk.depth - layout.backWall.distanceBehindDesk;
    const rear = Math.min(...obbCorners(instanceObb(inst, def)).map((c) => c.z));
    wallDistance = rear - wallZ;
  }
  return {
    id: inst.id,
    label: inst.label,
    locked: inst.locked,
    rearPorted: def.speaker?.rearPorted ?? false,
    acoustic,
    forward,
    distanceToListener: horizontal,
    toeInError: atAim ? null : signedAngleDeg(forward, toAim),
    // Exact: the acoustic point lies on the forward axis through the footprint centre.
    requiredYaw: atAim || Math.hypot(fromCentre.x, fromCentre.z) < EPS ? null : yawFromDir(fromCentre),
    vertical: { dy, angle, suggestedPitch: angle },
    wallDistance,
  };
}

/** All triangle readings for the layout's speaker pair, or null when there is no pair. */
export function analyzeTriangle(layout: Layout): TriangleReading | null {
  const pair = findSpeakerPair(layout);
  if (!pair) return null;
  const head = listenerHead(layout);
  const aim = aimPoint(layout);
  const left = readSpeaker(layout, pair.left, pair.leftDef, head, aim);
  const right = readSpeaker(layout, pair.right, pair.rightDef, head, aim);
  const L = plan(left.acoustic);
  const R = plan(right.acoustic);
  const P = plan(head);

  const lr = dist2(L, R);
  const sides = { lr, leftListener: dist2(L, P), rightListener: dist2(R, P) };

  // Twice the triangle's area, relative to its size, tells collinear corners apart from real triangles.
  const area2 = Math.abs((R.x - L.x) * (P.z - L.z) - (R.z - L.z) * (P.x - L.x));
  const scale = Math.max(sides.lr, sides.leftListener, sides.rightListener);
  const degenerate = scale < EPS || area2 < 1e-9 * scale * scale;
  const aL = interiorAngleDeg(R, L, P);
  const aR = interiorAngleDeg(L, R, P);
  const aP = interiorAngleDeg(L, P, R);
  const angles = degenerate || aL === null || aR === null || aP === null ? null : { left: aL, right: aR, listener: aP };

  let offsetAlong: number | null = null;
  let offsetAcross: number | null = null;
  if (lr > EPS) {
    const u = { x: (R.x - L.x) / lr, z: (R.z - L.z) / lr };
    const mid = { x: (L.x + R.x) / 2, z: (L.z + R.z) / 2 };
    const d = sub2(P, mid);
    offsetAlong = d.x * u.x + d.z * u.z;
    offsetAcross = Math.abs(d.x * u.z - d.z * u.x);
  }

  return {
    left,
    right,
    corners: { left: L, right: R, listener: P },
    aim,
    earY: head.y,
    sides,
    angles,
    symmetry: { distanceDiff: sides.leftListener - sides.rightListener, offsetAlong, offsetAcross },
  };
}
