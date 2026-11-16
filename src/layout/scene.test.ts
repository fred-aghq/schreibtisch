import { describe, expect, it } from 'vitest';
import { createDefaultLayout } from '../model/defaults';
import { deskAabb, floorY, isBelowDesk, layoutAabb, listenerHead } from './scene';

describe('scene coordinates', () => {
  const layout = createDefaultLayout();

  it('desk spans x ∈ [−W/2, W/2], z ∈ [−D, 0]', () => {
    expect(deskAabb(layout)).toEqual({ minX: -800, maxX: 800, minZ: -800, maxZ: 0 });
  });

  it('floor sits heightFromFloor below the desk top', () => {
    expect(floorY(layout)).toBe(-740);
  });

  it('listener head is in front of the desk at ear height', () => {
    expect(listenerHead(layout)).toEqual({ x: 0, y: 1200 - 740, z: 600 });
  });

  it('layout bounds include desk and listener', () => {
    const b = layoutAabb(layout);
    expect(b.minZ).toBeLessThanOrEqual(-800);
    expect(b.maxZ).toBeGreaterThan(600);
  });

  it('detects objects below the desk', () => {
    const def = Object.values(layout.definitions)[0]!;
    const inst = layout.instances.find((i) => i.definitionId === def.id)!;
    expect(isBelowDesk({ ...inst, position: { ...inst.position, y: -def.size.h - 10 } }, def)).toBe(true);
    expect(isBelowDesk(inst, def)).toBe(false);
  });
});
