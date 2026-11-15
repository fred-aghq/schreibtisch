import type { Layout, ObjectDefinition, ObjectInstance } from '../model/types';
import type { AABB, OBB } from './obb';
import { obbAabb, unionAabb } from './obb';
import type { Vec2, Vec3 } from './vec';

/** Plan footprint of an instance as an oriented box. */
export function instanceObb(inst: ObjectInstance, def: ObjectDefinition): OBB {
  return {
    center: { x: inst.position.x, z: inst.position.z },
    halfW: def.size.w / 2,
    halfD: def.size.d / 2,
    yaw: inst.rotation.yaw,
  };
}

export function deskAabb(layout: Layout): AABB {
  return { minX: -layout.desk.width / 2, maxX: layout.desk.width / 2, minZ: -layout.desk.depth, maxZ: 0 };
}

/** World y of the floor (desk top is y = 0). */
export function floorY(layout: Layout): number {
  return -layout.desk.heightFromFloor;
}

/** Centre of the listener's head in world coordinates. */
export function listenerHead(layout: Layout): Vec3 {
  return {
    x: layout.listener.x,
    y: layout.listener.earHeightFromFloor - layout.desk.heightFromFloor,
    z: layout.listener.distanceFromFrontEdge,
  };
}

export function listenerPlan(layout: Layout): Vec2 {
  return { x: layout.listener.x, z: layout.listener.distanceFromFrontEdge };
}

/** Plan-view chair footprint behind the head (approximate, for drawing and bounds). */
export const CHAIR = { width: 520, depth: 500, headRadius: 85 } as const;

export function listenerAabb(layout: Layout): AABB {
  const p = listenerPlan(layout);
  return {
    minX: p.x - CHAIR.width / 2,
    maxX: p.x + CHAIR.width / 2,
    minZ: p.z - CHAIR.headRadius,
    maxZ: p.z + CHAIR.depth * 0.75,
  };
}

/** Bounding box of everything worth showing in the plan view (desk, listener, visible objects). */
export function layoutAabb(layout: Layout): AABB {
  const boxes: AABB[] = [deskAabb(layout), listenerAabb(layout)];
  for (const inst of layout.instances) {
    const def = layout.definitions[inst.definitionId];
    if (def && inst.visible) boxes.push(obbAabb(instanceObb(inst, def)));
  }
  if (layout.backWall) {
    const z = -layout.desk.depth - layout.backWall.distanceBehindDesk;
    boxes.push({ minX: -layout.desk.width / 2, maxX: layout.desk.width / 2, minZ: z - 20, maxZ: z });
  }
  return unionAabb(boxes) ?? deskAabb(layout);
}

/** True when the object is entirely below the desk top (e.g. a PC on the floor). */
export function isBelowDesk(inst: ObjectInstance, def: ObjectDefinition): boolean {
  return inst.position.y + def.size.h <= 0;
}
