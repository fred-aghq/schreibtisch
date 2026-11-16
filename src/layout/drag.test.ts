import { describe, expect, it, vi } from 'vitest';
import { createDefaultLayout } from '../model/defaults';
import { updateInstance } from '../model/ops';
import { canDrag, DragSession, moveTarget, snapTarget, targetPosition } from './drag';
import type { KeyEventLike, KeyTarget } from './drag';

const layout = createDefaultLayout(); // desk 740 high, ears at 1200, listener 600 from the edge
const kb = layout.instances.find((i) => i.label === 'Keyboard')!;
const left = layout.instances.find((i) => i.role === 'speakerL')!;
const right = layout.instances.find((i) => i.role === 'speakerR')!;

describe('drag targets', () => {
  it('reports object and listener positions', () => {
    expect(targetPosition(layout, { kind: 'object', id: kb.id })).toEqual(kb.position);
    expect(targetPosition(layout, { kind: 'listener' })).toEqual({ x: 0, y: 1200 - 740, z: 600 });
    expect(targetPosition(layout, { kind: 'object', id: 'nope' })).toBeNull();
  });

  it('does not drag locked or missing objects', () => {
    const locked = updateInstance(layout, kb.id, { locked: true });
    expect(canDrag(layout, { kind: 'object', id: kb.id })).toBe(true);
    expect(canDrag(locked, { kind: 'object', id: kb.id })).toBe(false);
    expect(canDrag(layout, { kind: 'object', id: 'nope' })).toBe(false);
    expect(canDrag(locked, { kind: 'listener' })).toBe(true);
  });

  it('moves objects in plan, keeping elevation unless y is given', () => {
    const t = { kind: 'object', id: kb.id } as const;
    const plan = moveTarget(layout, t, { x: 10, z: -300 });
    expect(plan.instances.find((i) => i.id === kb.id)!.position).toEqual({ x: 10, y: kb.position.y, z: -300 });
    const raised = moveTarget(layout, t, { x: 10, y: 55, z: -300 });
    expect(raised.instances.find((i) => i.id === kb.id)!.position.y).toBe(55);
  });

  it('moving one speaker mirrors its partner', () => {
    const next = moveTarget(layout, { kind: 'object', id: left.id }, { x: -500, z: -400 });
    expect(next.instances.find((i) => i.id === right.id)!.position).toMatchObject({ x: 500, z: -400 });
  });

  it('moves the listener, converting head height to ear height from the floor', () => {
    const t = { kind: 'listener' } as const;
    expect(moveTarget(layout, t, { x: 20, z: 700 }).listener).toEqual({ x: 20, distanceFromFrontEdge: 700, earHeightFromFloor: 1200 });
    expect(moveTarget(layout, t, { x: 0, y: 500, z: 600 }).listener.earHeightFromFloor).toBe(1240);
  });

  it('snaps objects to desk edges and the listener to the centreline, unless bypassed', () => {
    const w = layout.definitions[kb.definitionId]!.size.w;
    const nearEdge = { x: -800 + w / 2 + 4, z: -300 };
    expect(snapTarget(layout, { kind: 'object', id: kb.id }, nearEdge, 10, false).pos.x).toBe(-800 + w / 2);
    expect(snapTarget(layout, { kind: 'object', id: kb.id }, nearEdge, 10, true).pos).toEqual(nearEdge);
    expect(snapTarget(layout, { kind: 'listener' }, { x: 6, z: 600 }, 10, false).pos.x).toBe(0);
  });
});

function fakeKeys() {
  const handlers = new Set<(e: KeyEventLike) => void>();
  const keys: KeyTarget = {
    addEventListener: (_t, fn) => void handlers.add(fn),
    removeEventListener: (_t, fn) => void handlers.delete(fn),
  };
  const press = (key: string) => {
    const e = { key, stopPropagation: vi.fn() };
    for (const h of [...handlers]) h(e);
    return e;
  };
  return { keys, handlers, press };
}

function fakeTx() {
  return { beginTx: vi.fn(), endTx: vi.fn(), cancelTx: vi.fn() };
}

describe('DragSession', () => {
  it('opens a transaction only past the threshold, and ends it on release', () => {
    const tx = fakeTx();
    const onFinish = vi.fn();
    const s = new DragSession({ tx, keys: null, onFinish });
    expect(s.update(2)).toBe(false);
    expect(tx.beginTx).not.toHaveBeenCalled();
    expect(s.update(3)).toBe(true);
    expect(s.update(50)).toBe(true);
    expect(tx.beginTx).toHaveBeenCalledTimes(1);
    s.end();
    expect(tx.endTx).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledExactlyOnceWith(false);
    s.end();
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(s.update(100)).toBe(false);
  });

  it('a click (no travel) touches no history', () => {
    const tx = fakeTx();
    const s = new DragSession({ tx, keys: null });
    s.update(1);
    s.end();
    expect(tx.beginTx).not.toHaveBeenCalled();
    expect(tx.endTx).not.toHaveBeenCalled();
  });

  it('Escape cancels a live drag and swallows the key', () => {
    const tx = fakeTx();
    const { keys, handlers, press } = fakeKeys();
    const onFinish = vi.fn();
    const s = new DragSession({ tx, keys, onFinish });
    expect(handlers.size).toBe(1);
    s.update(10);
    expect(press('a').stopPropagation).not.toHaveBeenCalled();
    const esc = press('Escape');
    expect(esc.stopPropagation).toHaveBeenCalled();
    expect(tx.cancelTx).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledExactlyOnceWith(true);
    expect(handlers.size).toBe(0);
    s.end();
    expect(tx.endTx).not.toHaveBeenCalled();
  });

  it('Escape before the drag starts ends the press but lets Escape through', () => {
    const tx = fakeTx();
    const { keys, press } = fakeKeys();
    const s = new DragSession({ tx, keys });
    expect(press('Escape').stopPropagation).not.toHaveBeenCalled();
    expect(tx.cancelTx).not.toHaveBeenCalled();
    expect(s.done).toBe(true);
  });
});
