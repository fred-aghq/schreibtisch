import { describe, expect, it } from 'vitest';
import { createDefaultLayout } from '../model/defaults';
import { aabbHalfExtents, buildSnapTargets, snapBox } from './snap';
import type { SnapTargets } from './snap';

const targets: SnapTargets = {
  xs: [
    { value: -800, kind: 'desk-edge', span: [-800, 0] },
    { value: 0, kind: 'centreline', span: [-800, 0] },
    { value: 300, kind: 'object-edge', span: [-500, -400] },
  ],
  zs: [{ value: 0, kind: 'desk-edge', span: [-800, 800] }],
};

describe('aabbHalfExtents', () => {
  it('is the plain half size when unrotated and swaps at 90°', () => {
    expect(aabbHalfExtents(200, 100, 0)).toEqual({ hx: 100, hz: 50 });
    const r = aabbHalfExtents(200, 100, 90);
    expect(r.hx).toBeCloseTo(50);
    expect(r.hz).toBeCloseTo(100);
  });
});

describe('snapBox', () => {
  const half = { hx: 100, hz: 50 };

  it('snaps a left edge to the desk edge', () => {
    const r = snapBox({ x: -695, z: -300 }, half, targets, 10, 0);
    expect(r.pos.x).toBe(-700);
    expect(r.lineX?.kind).toBe('desk-edge');
  });

  it('snaps the centre to the centreline', () => {
    const r = snapBox({ x: 4, z: -300 }, half, targets, 10, 0);
    expect(r.pos.x).toBe(0);
    expect(r.lineX?.kind).toBe('centreline');
  });

  it('snaps a front edge flush with the desk front', () => {
    const r = snapBox({ x: 500, z: -46 }, half, targets, 10, 0);
    expect(r.pos.z).toBe(-50);
  });

  it('butts up against another object (right edge to its left edge)', () => {
    const r = snapBox({ x: 205, z: -450 }, half, targets, 10, 0);
    expect(r.pos.x).toBe(200);
    expect(r.lineX?.kind).toBe('object-edge');
  });

  it('picks the closest line', () => {
    const r = snapBox({ x: 3, z: -300 }, { hx: 297, hz: 50 }, targets, 10, 0);
    // centre is 3 from 0, right edge is 0 from 300: the edge wins.
    expect(r.pos.x).toBe(3);
    expect(r.lineX?.value).toBe(300);
  });

  it('falls back to the grid when nothing is near', () => {
    const r = snapBox({ x: 512, z: -333 }, half, targets, 5, 10);
    expect(r.pos).toEqual({ x: 510, z: -330 });
    expect(r.lineX).toBeNull();
    expect(r.lineZ).toBeNull();
  });

  it('leaves positions free with no grid and nothing near', () => {
    expect(snapBox({ x: 512.3, z: -333.3 }, half, targets, 5, 0).pos).toEqual({ x: 512.3, z: -333.3 });
  });
});

describe('buildSnapTargets', () => {
  it('includes desk edges, centreline and other objects but not excluded ones', () => {
    const layout = createDefaultLayout();
    const kb = layout.instances.find((i) => i.label === 'Keyboard')!;
    const all = buildSnapTargets(layout, new Set());
    const without = buildSnapTargets(layout, new Set([kb.id]));
    expect(all.xs.some((l) => l.kind === 'desk-edge' && l.value === -800)).toBe(true);
    expect(all.xs.some((l) => l.kind === 'centreline')).toBe(true);
    expect(all.zs.some((l) => l.value === -800)).toBe(true);
    expect(all.xs.length - without.xs.length).toBe(3);
  });

  it('adds a listener line when the listener is off centre', () => {
    const layout = createDefaultLayout();
    layout.listener.x = 120;
    expect(buildSnapTargets(layout, new Set()).xs.some((l) => l.kind === 'listener' && l.value === 120)).toBe(true);
  });
});

describe('snapInstance', () => {
  it('ignores the dragged object and its pair partner', async () => {
    const { snapInstance } = await import('./snap');
    const layout = createDefaultLayout();
    const left = layout.instances.find((i) => i.role === 'speakerL')!;
    const right = layout.instances.find((i) => i.role === 'speakerR')!;
    // Put the raw position so its right edge would touch the partner's left edge if it were a target.
    const half = aabbHalfExtents(210, 290, left.rotation.yaw);
    const partnerMinX = right.position.x - aabbHalfExtents(210, 290, right.rotation.yaw).hx;
    const raw = { x: partnerMinX - half.hx - 2, z: right.position.z + 133 };
    const r = snapInstance({ ...layout, settings: { ...layout.settings, snapStep: 1 } }, left.id, raw, 4, false);
    expect(r.lineX?.value === partnerMinX).toBe(false);
  });

  it('is bypassed with Alt or when snapping is off', async () => {
    const { snapInstance } = await import('./snap');
    const layout = createDefaultLayout();
    const kb = layout.instances.find((i) => i.label === 'Keyboard')!;
    expect(snapInstance(layout, kb.id, { x: 1.3, z: -100.7 }, 10, true).pos).toEqual({ x: 1.3, z: -100.7 });
    const off = { ...layout, settings: { ...layout.settings, snapEnabled: false } };
    expect(snapInstance(off, kb.id, { x: 1.3, z: -100.7 }, 10, false).pos).toEqual({ x: 1.3, z: -100.7 });
  });
});
