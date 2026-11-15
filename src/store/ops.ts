import { makeDefinition, makeInstance } from '../model/defaults';
import { newId } from '../model/ids';
import type { Desk, Layout, Listener, ObjectDefinition, ObjectInstance, Settings, Size } from '../model/types';
import type { Category } from '../model/types';
import { normalizeDeg } from '../geometry/units';

/** Pure layout operations. Each returns a new Layout (or the same one if nothing changed). */

export type InstancePatch = Partial<Omit<ObjectInstance, 'id' | 'position' | 'rotation'>> & {
  position?: Partial<ObjectInstance['position']>;
  rotation?: Partial<ObjectInstance['rotation']>;
};

export function updateInstance(layout: Layout, id: string, patch: InstancePatch): Layout {
  let changed = false;
  const instances = layout.instances.map((inst) => {
    if (inst.id !== id) return inst;
    changed = true;
    const rotation = patch.rotation ? { ...inst.rotation, ...patch.rotation } : inst.rotation;
    return {
      ...inst,
      ...patch,
      position: patch.position ? { ...inst.position, ...patch.position } : inst.position,
      rotation: { yaw: normalizeDeg(rotation.yaw), pitch: rotation.pitch },
    };
  });
  return changed ? { ...layout, instances } : layout;
}

export function updateDefinition(
  layout: Layout,
  id: string,
  patch: Partial<Omit<ObjectDefinition, 'id' | 'size'>> & { size?: Partial<Size> },
): Layout {
  const def = layout.definitions[id];
  if (!def) return layout;
  const next: ObjectDefinition = { ...def, ...patch, size: patch.size ? { ...def.size, ...patch.size } : def.size };
  return { ...layout, definitions: { ...layout.definitions, [id]: next } };
}

export function setDesk(layout: Layout, patch: Partial<Desk>): Layout {
  return { ...layout, desk: { ...layout.desk, ...patch } };
}

export function setListener(layout: Layout, patch: Partial<Listener>): Layout {
  return { ...layout, listener: { ...layout.listener, ...patch } };
}

export function setSettings(layout: Layout, patch: Partial<Settings>): Layout {
  return { ...layout, settings: { ...layout.settings, ...patch } };
}

/** Add a new definition + one instance, placed on the desk. Returns the new instance id too. */
export function addObject(
  layout: Layout,
  template: { category: Category; name: string; size: Size; extras?: Partial<ObjectDefinition> },
  at?: { x: number; z: number },
): { layout: Layout; instanceId: string } {
  const def = makeDefinition(template.category, template.name, { ...template.size }, { approx: true, ...template.extras });
  const inst = makeInstance(def, {
    position: { x: at?.x ?? 0, y: 0, z: at?.z ?? -layout.desk.depth / 2 },
  });
  return {
    layout: { ...layout, definitions: { ...layout.definitions, [def.id]: def }, instances: [...layout.instances, inst] },
    instanceId: inst.id,
  };
}

/** Delete an instance; garbage-collect its definition if nothing else uses it. */
export function deleteInstance(layout: Layout, id: string): Layout {
  const inst = layout.instances.find((i) => i.id === id);
  if (!inst) return layout;
  const instances = layout.instances
    .filter((i) => i.id !== id)
    .map((i) => (inst.pairId && i.pairId === inst.pairId ? { ...i, pairId: undefined } : i));
  const stillUsed = instances.some((i) => i.definitionId === inst.definitionId);
  const definitions = stillUsed
    ? layout.definitions
    : Object.fromEntries(Object.entries(layout.definitions).filter(([defId]) => defId !== inst.definitionId));
  return { ...layout, instances, definitions };
}

export function duplicateInstance(layout: Layout, id: string, offset = 20): { layout: Layout; instanceId: string } {
  const inst = layout.instances.find((i) => i.id === id);
  if (!inst) return { layout, instanceId: id };
  const copy: ObjectInstance = {
    ...inst,
    id: newId('obj'),
    label: `${inst.label} copy`,
    position: { ...inst.position, x: inst.position.x + offset, z: inst.position.z + offset },
    role: null,
    pairId: undefined,
    locked: false,
  };
  const idx = layout.instances.indexOf(inst);
  const instances = [...layout.instances.slice(0, idx + 1), copy, ...layout.instances.slice(idx + 1)];
  return { layout: { ...layout, instances }, instanceId: copy.id };
}

export function countInstancesOf(layout: Layout, definitionId: string): number {
  return layout.instances.filter((i) => i.definitionId === definitionId).length;
}
