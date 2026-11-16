import { describe, expect, it } from 'vitest';
import { createDefaultLayout } from './defaults';
import { BUILT_IN_PRESETS } from './presets';
import {
  addFromPreset,
  countInstancesOf,
  deleteInstance,
  duplicateInstance,
  moveInstance,
  renameLayout,
  setBackWall,
  setSpeakerRole,
  updateDefinition,
  updateInstance,
} from './ops';

describe('layout ops', () => {
  it('updates an instance immutably and normalises yaw', () => {
    const l = createDefaultLayout();
    const id = l.instances[0]!.id;
    const next = updateInstance(l, id, { position: { x: 123 }, rotation: { yaw: 370 } });
    expect(next).not.toBe(l);
    expect(next.instances[0]!.position.x).toBe(123);
    expect(next.instances[0]!.position.y).toBe(l.instances[0]!.position.y);
    expect(next.instances[0]!.rotation.yaw).toBe(10);
    expect(l.instances[0]!.position.x).toBe(0);
    expect(updateInstance(l, 'nope', { label: 'x' })).toBe(l);
  });

  it('editing a definition affects every instance of it', () => {
    const l = createDefaultLayout();
    const speakerDef = Object.values(l.definitions).find((d) => d.category === 'speaker')!;
    expect(countInstancesOf(l, speakerDef.id)).toBe(2);
    const next = updateDefinition(l, speakerDef.id, { size: { w: 250 } });
    expect(next.definitions[speakerDef.id]!.size).toEqual({ ...speakerDef.size, w: 250 });
  });

  it('adds and deletes objects, collecting unused definitions', () => {
    const l = createDefaultLayout();
    const { layout, instanceIds } = addFromPreset(l, BUILT_IN_PRESETS.find((p) => p.id === 'kb-tkl')!);
    const instanceId = instanceIds[0]!;
    expect(layout.instances).toHaveLength(l.instances.length + 1);
    const inst = layout.instances.find((i) => i.id === instanceId)!;
    expect(layout.definitions[inst.definitionId]).toBeDefined();
    const removed = deleteInstance(layout, instanceId);
    expect(removed.instances).toHaveLength(l.instances.length);
    expect(removed.definitions[inst.definitionId]).toBeUndefined();
  });

  it('deleting one of a pair keeps the shared definition and unlinks the other', () => {
    const l = createDefaultLayout();
    const left = l.instances.find((i) => i.role === 'speakerL')!;
    const next = deleteInstance(l, left.id);
    const right = next.instances.find((i) => i.role === 'speakerR')!;
    expect(next.definitions[right.definitionId]).toBeDefined();
    expect(right.pairId).toBeUndefined();
  });

  it('duplicates next to the original without copying pair links', () => {
    const l = createDefaultLayout();
    const left = l.instances.find((i) => i.role === 'speakerL')!;
    const { layout, instanceId } = duplicateInstance(l, left.id);
    const copy = layout.instances.find((i) => i.id === instanceId)!;
    expect(copy.definitionId).toBe(left.definitionId);
    expect(copy.pairId).toBeUndefined();
    expect(copy.role).toBeNull();
    expect(copy.position.x).toBe(left.position.x + 20);
  });
});

describe('locked instances', () => {
  function lockedLayout() {
    const l = createDefaultLayout();
    const kb = l.instances.find((i) => i.label === 'Keyboard')!;
    return { layout: updateInstance(l, kb.id, { locked: true }), id: kb.id };
  }

  it('cannot be moved or rotated', () => {
    const { layout, id } = lockedLayout();
    expect(moveInstance(layout, id, { position: { x: 500 } })).toBe(layout);
    expect(moveInstance(layout, id, { rotation: { yaw: 45 } })).toBe(layout);
  });

  it('cannot be deleted', () => {
    const { layout, id } = lockedLayout();
    expect(deleteInstance(layout, id)).toBe(layout);
  });

  it('can still be relabelled, unlocked and duplicated', () => {
    const { layout, id } = lockedLayout();
    expect(updateInstance(layout, id, { label: 'KB' }).instances.find((i) => i.id === id)!.label).toBe('KB');
    const unlocked = updateInstance(layout, id, { locked: false });
    expect(moveInstance(unlocked, id, { position: { x: 500 } }).instances.find((i) => i.id === id)!.position.x).toBe(500);
    const dup = duplicateInstance(layout, id);
    expect(dup.layout.instances.find((i) => i.id === dup.instanceId)!.locked).toBe(false);
  });

  it('a locked partner does not block moving its unlocked twin', () => {
    const l = createDefaultLayout();
    const left = l.instances.find((i) => i.role === 'speakerL')!;
    const right = l.instances.find((i) => i.role === 'speakerR')!;
    const locked = updateInstance(l, right.id, { locked: true });
    const moved = moveInstance(locked, left.id, { position: { x: -700 } });
    expect(moved.instances.find((i) => i.id === left.id)!.position.x).toBe(-700);
    expect(moved.instances.find((i) => i.id === right.id)!.position).toEqual(right.position);
  });
});

describe('layout-level ops', () => {
  it('sets and clears the back wall', () => {
    const l = createDefaultLayout();
    const on = setBackWall(l, { distanceBehindDesk: 80 });
    expect(on.backWall).toEqual({ distanceBehindDesk: 80 });
    expect(setBackWall(on, null).backWall).toBeNull();
    expect(l.backWall).toBeNull();
  });

  it('renames, and returns the same layout for no change', () => {
    const l = createDefaultLayout();
    expect(renameLayout(l, 'Studio').name).toBe('Studio');
    expect(renameLayout(l, l.name)).toBe(l);
  });
});

describe('speaker roles', () => {
  it('assigning a role takes it from whoever had it', () => {
    const l = createDefaultLayout();
    const kb = l.instances.find((i) => i.label === 'Keyboard')!;
    const next = setSpeakerRole(l, kb.id, 'speakerL');
    expect(next.instances.filter((i) => i.role === 'speakerL').map((i) => i.id)).toEqual([kb.id]);
    expect(next.instances.filter((i) => i.role === 'speakerR')).toHaveLength(1);
  });

  it('clearing a role leaves the others alone, and a no-op returns the same layout', () => {
    const l = createDefaultLayout();
    const left = l.instances.find((i) => i.role === 'speakerL')!;
    const next = setSpeakerRole(l, left.id, null);
    expect(next.instances.find((i) => i.id === left.id)!.role).toBeNull();
    expect(next.instances.filter((i) => i.role === 'speakerR')).toHaveLength(1);
    expect(setSpeakerRole(l, left.id, 'speakerL')).toBe(l);
  });

  it('works on locked objects (a role is not a pose)', () => {
    const l = createDefaultLayout();
    const kb = l.instances.find((i) => i.label === 'Keyboard')!;
    const locked = updateInstance(l, kb.id, { locked: true });
    expect(setSpeakerRole(locked, kb.id, 'speakerR').instances.find((i) => i.id === kb.id)!.role).toBe('speakerR');
  });
});
