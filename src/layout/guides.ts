import type { AABB } from '../geometry/obb';
import type { Vec2 } from '../geometry/vec';

export interface DimensionGuide {
  id: 'left' | 'right' | 'front' | 'back' | 'centre';
  a: Vec2;
  b: Vec2;
  /** Signed distance in mm (negative = the object pokes past that edge). */
  value: number;
}

/**
 * Live dimension guides for a dragged footprint: distance to the nearer side edge, the nearer
 * front/back edge, and from the object's centre to the desk centreline.
 */
export function dimensionGuides(box: AABB, deskWidth: number, deskDepth: number): DimensionGuide[] {
  const cx = (box.minX + box.maxX) / 2;
  const cz = (box.minZ + box.maxZ) / 2;
  const half = deskWidth / 2;
  const left = box.minX - -half;
  const right = half - box.maxX;
  const front = 0 - box.maxZ;
  const back = box.minZ - -deskDepth;
  const guides: DimensionGuide[] = [];

  if (Math.abs(left) <= Math.abs(right)) {
    guides.push({ id: 'left', a: { x: -half, z: cz }, b: { x: box.minX, z: cz }, value: left });
  } else {
    guides.push({ id: 'right', a: { x: box.maxX, z: cz }, b: { x: half, z: cz }, value: right });
  }
  if (Math.abs(front) <= Math.abs(back)) {
    guides.push({ id: 'front', a: { x: cx, z: box.maxZ }, b: { x: cx, z: 0 }, value: front });
  } else {
    guides.push({ id: 'back', a: { x: cx, z: -deskDepth }, b: { x: cx, z: box.minZ }, value: back });
  }
  if (Math.abs(cx) > 0.5) {
    // Measured along the front edge of the object so it doesn't sit on top of the side guide.
    const z = Math.min(box.maxZ + 30, 0);
    guides.push({ id: 'centre', a: { x: 0, z }, b: { x: cx, z }, value: cx });
  }
  return guides;
}
