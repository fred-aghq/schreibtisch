import type { Vec3 } from '../geometry/vec';

/**
 * Approximate listener and chair dimensions (mm), shared by the 2D marker, the 3D figure and the
 * plan bounds. They are only for drawing: the triangle maths uses the head centre alone.
 */
export const LISTENER_BODY = {
  headRadius: 85,
  chairWidth: 520,
  /** The plan outline's depth, from just in front of the ears to behind the backrest. */
  chairPlanDepth: 500,
  /** Floor to the middle of the seat cushion. */
  seatHeight: 470,
  seatDepth: 460,
  seatThickness: 60,
  /** How far the seat centre sits behind the head centre. */
  seatBehindHead: 130,
  backrestHeight: 560,
  backrestThickness: 50,
  torsoWidth: 360,
  torsoDepth: 200,
  torsoBehindHead: 40,
  pedestalRadius: 25,
} as const;

export interface BodyBox {
  center: Vec3;
  size: { w: number; h: number; d: number };
}

export interface ListenerFigure {
  head: Vec3;
  torso: BodyBox;
  seat: BodyBox;
  backrest: BodyBox;
  /** The chair's gas-lift column, from the floor to the seat. */
  pedestal: { center: Vec3; height: number };
}

/**
 * World-space boxes for the simple 3D listener figure and chair, from the head centre and the
 * floor height (see `listenerHead` and `floorY` in layout/scene.ts).
 */
export function listenerFigure(head: Vec3, floor: number): ListenerFigure {
  const b = LISTENER_BODY;
  const seatY = floor + b.seatHeight;
  const seatZ = head.z + b.seatBehindHead;
  const torsoBottom = seatY + 40;
  const torsoTop = head.y - b.headRadius - 40;
  const torsoH = Math.max(torsoTop - torsoBottom, 50);
  return {
    head,
    torso: {
      center: { x: head.x, y: torsoBottom + torsoH / 2, z: head.z + b.torsoBehindHead },
      size: { w: b.torsoWidth, h: torsoH, d: b.torsoDepth },
    },
    seat: {
      center: { x: head.x, y: seatY, z: seatZ },
      size: { w: b.chairWidth - 40, h: b.seatThickness, d: b.seatDepth },
    },
    backrest: {
      center: { x: head.x, y: seatY + b.seatThickness / 2 + 20 + b.backrestHeight / 2, z: seatZ + b.seatDepth / 2 - 20 },
      size: { w: b.chairWidth - 80, h: b.backrestHeight, d: b.backrestThickness },
    },
    pedestal: { center: { x: head.x, y: (floor + seatY) / 2, z: seatZ }, height: seatY - floor },
  };
}
