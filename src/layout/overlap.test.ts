import { describe, expect, it } from 'vitest';
import { makeDefinition, makeInstance } from '../model/defaults';
import { DEFAULT_SETTINGS } from '../model/defaults';
import type { Layout, ObjectInstance } from '../model/types';
import { findOverlaps } from './overlap';

function layoutWith(...items: { cat?: 'other' | 'mat'; w: number; d: number; h: number; x: number; y?: number; z: number; yaw?: number; visible?: boolean }[]): { layout: Layout; ids: string[] } {
  const defs = items.map((it) => makeDefinition(it.cat ?? 'other', 'x', { w: it.w, d: it.d, h: it.h }));
  const instances: ObjectInstance[] = items.map((it, i) =>
    makeInstance(defs[i]!, { position: { x: it.x, y: it.y ?? 0, z: it.z }, rotation: { yaw: it.yaw ?? 0, pitch: 0 }, visible: it.visible ?? true }),
  );
  return {
    layout: {
      schemaVersion: 1,
      id: 'l',
      name: 'l',
      desk: { width: 1600, depth: 800, thickness: 25, heightFromFloor: 740, colour: '#fff' },
      backWall: null,
      listener: { x: 0, distanceFromFrontEdge: 600, earHeightFromFloor: 1200 },
      definitions: Object.fromEntries(defs.map((d) => [d.id, d])),
      instances,
      settings: DEFAULT_SETTINGS,
    },
    ids: instances.map((i) => i.id),
  };
}

describe('findOverlaps', () => {
  it('flags intersecting footprints', () => {
    const { layout, ids } = layoutWith({ w: 200, d: 200, h: 100, x: 0, z: -300 }, { w: 200, d: 200, h: 100, x: 150, z: -300 });
    expect(findOverlaps(layout)).toEqual(new Set(ids));
  });

  it('ignores objects that only touch', () => {
    const { layout } = layoutWith({ w: 200, d: 200, h: 100, x: 0, z: -300 }, { w: 200, d: 200, h: 100, x: 200, z: -300 });
    expect(findOverlaps(layout).size).toBe(0);
  });

  it('ignores objects at different heights (speaker on a stand above a PC)', () => {
    const { layout } = layoutWith({ w: 200, d: 200, h: 470, x: 0, y: -740, z: -300 }, { w: 200, d: 200, h: 300, x: 50, y: 50, z: -300 });
    expect(findOverlaps(layout).size).toBe(0);
  });

  it('never flags desk mats', () => {
    const { layout } = layoutWith({ cat: 'mat', w: 900, d: 400, h: 3, x: 0, z: -300 }, { w: 360, d: 135, h: 35, x: 0, z: -300 });
    expect(findOverlaps(layout).size).toBe(0);
  });

  it('ignores hidden objects', () => {
    const { layout } = layoutWith({ w: 200, d: 200, h: 100, x: 0, z: -300 }, { w: 200, d: 200, h: 100, x: 50, z: -300, visible: false });
    expect(findOverlaps(layout).size).toBe(0);
  });

  it('uses oriented boxes, not axis-aligned ones', () => {
    const { layout } = layoutWith({ w: 300, d: 20, h: 50, x: 0, z: -300, yaw: 45 }, { w: 300, d: 20, h: 50, x: 60, z: -240, yaw: 45 });
    expect(findOverlaps(layout).size).toBe(0);
  });
});
