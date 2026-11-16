import type { Layout, ObjectDefinition, ObjectInstance } from '../model/types';
import type { AABB, OBB } from '../geometry/obb';
import { obbAabb, unionAabb } from '../geometry/obb';
import type { Vec2, Vec3 } from '../geometry/vec';
import { LISTENER_BODY } from './listenerBody';

/** A placed object together with its definition. */
export interface SceneItem {
  inst: ObjectInstance;
  def: ObjectDefinition;
}

/** Visible instances (in layout order) with their definitions; dangling references are skipped. */
export function visibleItems(layout: Layout): SceneItem[] {
  const out: SceneItem[] = [];
  for (const inst of layout.instances) {
    const def = layout.definitions[inst.definitionId];
    if (def && inst.visible) out.push({ inst, def });
  }
  return out;
}

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

/** Plan bounds of the listener marker: the head plus the chair behind it. */
export function listenerAabb(layout: Layout): AABB {
  const p = listenerPlan(layout);
  const { chairWidth, chairPlanDepth, headRadius } = LISTENER_BODY;
  return {
    minX: p.x - chairWidth / 2,
    maxX: p.x + chairWidth / 2,
    minZ: p.z - headRadius,
    maxZ: p.z + chairPlanDepth * 0.75,
  };
}

/** Bounding box of everything worth showing in the plan view (desk, listener, visible objects). */
export function layoutAabb(layout: Layout): AABB {
  const boxes: AABB[] = [deskAabb(layout), listenerAabb(layout)];
  for (const { inst, def } of visibleItems(layout)) boxes.push(obbAabb(instanceObb(inst, def)));
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
