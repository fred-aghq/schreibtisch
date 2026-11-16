import { makeInstance } from './defaults';
import { newId } from './ids';
import { DEFAULT_MOUNT_ELEVATION, DEFAULT_STAND, definitionFromPreset, monitorPanelSize } from './presets';
import type { Preset } from './presets';
import type { AspectRatio, BackWall, Desk, Layout, Listener, ObjectDefinition, ObjectInstance, Settings, Size } from './types';
import { mirrorPose, yawFromDir } from '../geometry/transform';
import { normalizeDeg } from '../geometry/math';

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

/** Add, change or remove (null) the wall behind the desk. */
export function setBackWall(layout: Layout, backWall: BackWall | null): Layout {
  return { ...layout, backWall: backWall ? { ...backWall } : null };
}

export function renameLayout(layout: Layout, name: string): Layout {
  return name === layout.name ? layout : { ...layout, name };
}

function findInstance(layout: Layout, id: string): ObjectInstance | undefined {
  return layout.instances.find((i) => i.id === id);
}

/**
 * Delete an instance; garbage-collect its definition if nothing else uses it.
 * A locked instance can't be deleted (the layout is returned unchanged).
 */
export function deleteInstance(layout: Layout, id: string): Layout {
  const inst = findInstance(layout, id);
  if (!inst || inst.locked) return layout;
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

/** The other half of an instance's L/R pair, if any. */
export function pairPartner(layout: Layout, id: string): ObjectInstance | undefined {
  const inst = layout.instances.find((i) => i.id === id);
  if (!inst?.pairId) return undefined;
  return layout.instances.find((i) => i.pairId === inst.pairId && i.id !== id);
}

export interface PosePatch {
  position?: Partial<ObjectInstance['position']>;
  rotation?: Partial<ObjectInstance['rotation']>;
}

/**
 * Move / rotate an instance. With mirroring on, its pair partner follows, mirrored across the
 * listener's centreline (x → mirrored, yaw → −yaw). A locked instance doesn't move (the layout is
 * returned unchanged), and a locked partner stays put.
 */
export function moveInstance(layout: Layout, id: string, patch: PosePatch): Layout {
  if (findInstance(layout, id)?.locked) return layout;
  const next = updateInstance(layout, id, patch);
  if (next === layout || !layout.settings.mirrorPairs) return next;
  const partner = pairPartner(next, id);
  const moved = next.instances.find((i) => i.id === id);
  if (!partner || !moved || partner.locked) return next;
  return updateInstance(next, partner.id, mirrorPose(moved, layout.listener.x));
}

export interface AddOptions {
  pair?: boolean;
  at?: { x: number; z: number };
}

function presetElevation(layout: Layout, preset: Preset): number {
  switch (preset.placement) {
    case 'floor':
      return -layout.desk.heightFromFloor;
    case 'mount':
      return preset.elevation ?? DEFAULT_MOUNT_ELEVATION;
    default:
      return 0;
  }
}

/**
 * Add a preset to the layout as a new definition plus one instance, or two linked, mirrored
 * instances when `pair` is set (speakers become speakerL / speakerR, toed in at the listener).
 */
export function addFromPreset(layout: Layout, preset: Preset, opts: AddOptions = {}): { layout: Layout; instanceIds: string[] } {
  const def = definitionFromPreset(preset, newId('def'));
  const y = presetElevation(layout, preset);
  const { width: W, depth: D } = layout.desk;
  const definitions = { ...layout.definitions, [def.id]: def };

  if (!opts.pair) {
    const floor = preset.placement === 'floor';
    const at = opts.at ?? (floor ? { x: W / 2 - def.size.w / 2 - 150, z: -D / 2 } : { x: 0, z: -D / 2 });
    const inst = makeInstance(def, { position: { x: at.x, y, z: at.z } });
    return { layout: { ...layout, definitions, instances: [...layout.instances, inst] }, instanceIds: [inst.id] };
  }

  const lp = { x: layout.listener.x, z: layout.listener.distanceFromFrontEdge };
  const offset = Math.max(W / 2 - def.size.w / 2 - 40, def.size.w);
  const z = opts.at?.z ?? -D + def.size.d / 2 + 120;
  const leftPos = { x: lp.x - offset, y, z };
  const isSpeaker = def.category === 'speaker';
  const yaw = isSpeaker ? yawFromDir({ x: lp.x - leftPos.x, z: lp.z - leftPos.z }) : 0;
  const pairId = newId('pair');
  const base = /^[A-Z][a-z]/.test(def.name) ? def.name[0]?.toLowerCase() + def.name.slice(1) : def.name;
  const left = makeInstance(def, {
    label: `Left ${base}`,
    position: leftPos,
    rotation: { yaw, pitch: 0 },
    role: isSpeaker ? 'speakerL' : null,
    pairId,
  });
  const right = makeInstance(def, {
    label: `Right ${base}`,
    ...mirrorPose(left, lp.x),
    role: isSpeaker ? 'speakerR' : null,
    pairId,
  });
  return { layout: { ...layout, definitions, instances: [...layout.instances, left, right] }, instanceIds: [left.id, right.id] };
}

/** Fork the definition so this instance can be edited on its own. */
export function makeUnique(layout: Layout, id: string): Layout {
  const inst = layout.instances.find((i) => i.id === id);
  const def = inst ? layout.definitions[inst.definitionId] : undefined;
  if (!inst || !def) return layout;
  const copy: ObjectDefinition = { ...structuredClone(def), id: newId('def'), name: `${def.name} (unique)` };
  return {
    ...layout,
    definitions: { ...layout.definitions, [copy.id]: copy },
    instances: layout.instances.map((i) => (i.id === id ? { ...i, definitionId: copy.id } : i)),
  };
}

/** Break an L/R link; both objects keep their pose and roles. */
export function unlinkPair(layout: Layout, id: string): Layout {
  const inst = layout.instances.find((i) => i.id === id);
  if (!inst?.pairId) return layout;
  const pairId = inst.pairId;
  return { ...layout, instances: layout.instances.map((i) => (i.pairId === pairId ? { ...i, pairId: undefined } : i)) };
}

export interface MonitorEdit {
  diagonalIn: number;
  aspect: AspectRatio;
  bezelMm: number;
  panelDepth: number;
  support: 'stand' | 'mount';
  stand?: Size;
}

/** Recompute a generated monitor's size from its parameters. */
export function regenerateMonitor(layout: Layout, defId: string, p: MonitorEdit): Layout {
  const def = layout.definitions[defId];
  if (!def) return layout;
  const stand = p.support === 'stand' ? (p.stand ?? def.monitor?.stand ?? DEFAULT_STAND) : undefined;
  const next: ObjectDefinition = {
    ...def,
    size: monitorPanelSize(p),
    monitor: { diagonalIn: p.diagonalIn, aspect: p.aspect, bezelMm: p.bezelMm, support: p.support, ...(stand ? { stand } : {}) },
  };
  return { ...layout, definitions: { ...layout.definitions, [defId]: next } };
}
