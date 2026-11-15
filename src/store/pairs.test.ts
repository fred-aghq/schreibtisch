import { describe, expect, it } from 'vitest';
import { createDefaultLayout } from '../model/defaults';
import { BUILT_IN_PRESETS, monitorPreset } from '../model/presets';
import { forwardDir } from '../geometry/transform';
import { addFromPreset, makeUnique, moveInstance, pairPartner, regenerateMonitor, unlinkPair } from './ops';

const speakerPreset = BUILT_IN_PRESETS.find((p) => p.id === 'spk-medium')!;

function emptyLayout() {
  const l = createDefaultLayout();
  return { ...l, instances: [], definitions: {} };
}

describe('L/R pairs', () => {
  it('adds a mirrored, linked pair aimed at the listener', () => {
    const { layout, instanceIds } = addFromPreset(emptyLayout(), speakerPreset, { pair: true });
    const [l, r] = instanceIds.map((id) => layout.instances.find((i) => i.id === id)!);
    expect(l!.role).toBe('speakerL');
    expect(r!.role).toBe('speakerR');
    expect(l!.pairId).toBe(r!.pairId);
    expect(l!.definitionId).toBe(r!.definitionId);
    expect(r!.position.x).toBeCloseTo(-l!.position.x);
    expect(r!.rotation.yaw).toBeCloseTo(-l!.rotation.yaw);
    // The left speaker's forward axis points at the listener.
    const f = forwardDir(l!.rotation.yaw);
    const toListener = { x: 0 - l!.position.x, z: 600 - l!.position.z };
    expect(f.x * toListener.z - f.z * toListener.x).toBeCloseTo(0, 6);
  });

  it('mirrors moves and rotations across the listener centreline', () => {
    const added = addFromPreset(emptyLayout(), speakerPreset, { pair: true });
    const instanceIds = added.instanceIds;
    let layout = { ...added.layout, listener: { ...added.layout.listener, x: 100 } };
    const [lId, rId] = instanceIds as [string, string];
    layout = moveInstance(layout, lId, { position: { x: -400, y: 50, z: -500 }, rotation: { yaw: 25 } });
    const r = layout.instances.find((i) => i.id === rId)!;
    expect(r.position).toEqual({ x: 600, y: 50, z: -500 });
    expect(r.rotation.yaw).toBe(-25);
  });

  it('does not mirror when mirroring is off, unlinked, or the partner is locked', () => {
    const base = addFromPreset(emptyLayout(), speakerPreset, { pair: true });
    const [lId, rId] = base.instanceIds as [string, string];
    const rBefore = base.layout.instances.find((i) => i.id === rId)!;

    const off = moveInstance({ ...base.layout, settings: { ...base.layout.settings, mirrorPairs: false } }, lId, { position: { x: -100 } });
    expect(off.instances.find((i) => i.id === rId)!.position).toEqual(rBefore.position);

    const unlinked = unlinkPair(base.layout, lId);
    expect(pairPartner(unlinked, lId)).toBeUndefined();
    const moved = moveInstance(unlinked, lId, { position: { x: -100 } });
    expect(moved.instances.find((i) => i.id === rId)!.position).toEqual(rBefore.position);

    const locked = { ...base.layout, instances: base.layout.instances.map((i) => (i.id === rId ? { ...i, locked: true } : i)) };
    expect(moveInstance(locked, lId, { position: { x: -100 } }).instances.find((i) => i.id === rId)!.position).toEqual(rBefore.position);
  });

  it('non-speaker pairs have no speaker roles', () => {
    const lamp = BUILT_IN_PRESETS.find((p) => p.id === 'light-lamp')!;
    const { layout } = addFromPreset(emptyLayout(), lamp, { pair: true });
    expect(layout.instances.every((i) => i.role === null && i.pairId)).toBe(true);
  });
});

describe('presets and definitions', () => {
  it('places floor items on the floor and mounted items in the air', () => {
    const pc = BUILT_IN_PRESETS.find((p) => p.id === 'pc-tower')!;
    const r = addFromPreset(emptyLayout(), pc);
    expect(r.layout.instances[0]!.position.y).toBe(-740);
    const mon = addFromPreset(emptyLayout(), monitorPreset({ diagonalIn: 27, aspect: '16:9', bezelMm: 8, panelDepth: 50, support: 'stand' }));
    expect(mon.layout.instances[0]!.position.y).toBe(100);
  });

  it('make unique forks the definition for one instance only', () => {
    const { layout, instanceIds } = addFromPreset(emptyLayout(), speakerPreset, { pair: true });
    const [lId, rId] = instanceIds as [string, string];
    const next = makeUnique(layout, lId);
    const l = next.instances.find((i) => i.id === lId)!;
    const r = next.instances.find((i) => i.id === rId)!;
    expect(l.definitionId).not.toBe(r.definitionId);
    expect(next.definitions[l.definitionId]!.size).toEqual(next.definitions[r.definitionId]!.size);
    expect(Object.keys(next.definitions)).toHaveLength(2);
  });

  it('regenerates monitor sizes from parameters', () => {
    const { layout } = addFromPreset(emptyLayout(), monitorPreset({ diagonalIn: 27, aspect: '16:9', bezelMm: 8, panelDepth: 50, support: 'mount' }));
    const defId = layout.instances[0]!.definitionId;
    const next = regenerateMonitor(layout, defId, { diagonalIn: 34, aspect: '21:9', bezelMm: 5, panelDepth: 60, support: 'stand' });
    const def = next.definitions[defId]!;
    expect(def.size.w).toBeGreaterThan(780);
    expect(def.size.d).toBe(60);
    expect(def.monitor?.support).toBe('stand');
    expect(def.monitor?.stand).toBeDefined();
  });
});
