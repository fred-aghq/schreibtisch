import { describe, expect, it } from 'vitest';
import { createDefaultLayout, QUICK_ADD } from '../model/defaults';
import { addObject, countInstancesOf, deleteInstance, duplicateInstance, updateDefinition, updateInstance } from './ops';

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
    const { layout, instanceId } = addObject(l, QUICK_ADD[0]!);
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
