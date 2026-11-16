import { describe, expect, it } from 'vitest';
import { obbAabb } from '../geometry/obb';
import { DEFAULT_DESK, DEFAULT_LISTENER } from '../model/defaults';
import { migrateLayout } from '../model/migrate';
import { BUILT_IN_PRESETS } from '../model/presets';
import type { Layout } from '../model/types';
import { arrangeLayout, SPEAKER_SIDE_RANGE } from './arrange';
import type { MonitorSpec, SetupSpec } from './arrange';
import { findOverlaps } from './overlap';
import { instanceObb, listenerHead } from './scene';
import { analyzeTriangle } from './triangle';

const preset = (id: string) => BUILT_IN_PRESETS.find((p) => p.id === id)!;
const mon = (diagonalIn: number, support: 'stand' | 'mount' = 'mount'): MonitorSpec => ({ diagonalIn, aspect: '16:9', bezelMm: 8, panelDepth: 50, support });
const speakers = { name: 'Speaker', size: { w: 210, d: 290, h: 350 }, acousticCentreHeight: 280, rearPorted: true, approx: true };

function spec(over: Partial<SetupSpec> = {}): SetupSpec {
  return {
    name: 'Test',
    desk: { ...DEFAULT_DESK },
    listener: { ...DEFAULT_LISTENER },
    monitors: [mon(27)],
    speakers,
    items: [
      { preset: preset('kb-tkl'), quantity: 1 },
      { preset: preset('mouse'), quantity: 1 },
      { preset: preset('mat'), quantity: 1 },
    ],
    ...over,
  };
}

const byLabel = (l: Layout, label: string) => l.instances.find((i) => i.label === label)!;
const box = (l: Layout, label: string) => {
  const inst = byLabel(l, label);
  return obbAabb(instanceObb(inst, l.definitions[inst.definitionId]!));
};

describe('auto-arrange', () => {
  it('produces a valid layout with the triangle on', () => {
    const { layout } = arrangeLayout(spec());
    expect(migrateLayout(JSON.parse(JSON.stringify(layout))).ok).toBe(true);
    expect(layout.settings.showTriangle).toBe(true);
    expect(layout.name).toBe('Test');
  });

  it('centres the main monitor on the listener near the back, facing them', () => {
    const { layout } = arrangeLayout(spec({ listener: { ...DEFAULT_LISTENER, x: 80 } }));
    const m = byLabel(layout, 'Monitor');
    expect(m.position.x).toBeCloseTo(80, 6);
    expect(m.rotation.yaw).toBeCloseTo(0, 6);
    expect(box(layout, 'Monitor').minZ).toBeGreaterThan(-layout.desk.depth);
    expect(m.position.z).toBeLessThan(-layout.desk.depth / 2);
    expect(m.position.y).toBe(150);
  });

  it('puts extra monitors beside the main one, angled toward the listener, without overlapping', () => {
    const { layout } = arrangeLayout(spec({ monitors: [mon(27), mon(24), mon(24)], speakers: null, items: [] }));
    const [main, right, left] = ['Monitor 1 (main)', 'Monitor 2', 'Monitor 3'].map((l) => byLabel(layout, l));
    expect(right!.position.x).toBeGreaterThan(main!.position.x);
    expect(left!.position.x).toBeLessThan(main!.position.x);
    const head = listenerHead(layout);
    for (const m of [right!, left!]) {
      const expected = (Math.atan2(head.x - m.position.x, head.z - m.position.z) * 180) / Math.PI;
      expect(m.rotation.yaw).toBeCloseTo(expected, 6);
    }
    expect(right!.rotation.yaw).toBeLessThan(0); // turned back toward the centre
    expect(left!.rotation.yaw).toBeGreaterThan(0);
    expect(findOverlaps(layout).size).toBe(0);
  });

  it('lifts monitors on stands onto their stand', () => {
    const { layout } = arrangeLayout(spec({ monitors: [mon(27, 'stand')] }));
    expect(byLabel(layout, 'Monitor').position.y).toBe(100);
  });

  it('places the speakers in an equilateral triangle, aimed at the listener, clear of the monitors', () => {
    const { layout, notes } = arrangeLayout(spec({ monitors: [mon(32)] }));
    expect(notes).toEqual([]);
    const t = analyzeTriangle(layout)!;
    expect(t.angles!.left).toBeCloseTo(60, 6);
    expect(t.angles!.listener).toBeCloseTo(60, 6);
    expect(t.left.toeInError).toBeCloseTo(0, 6);
    expect(t.right.toeInError).toBeCloseTo(0, 6);
    expect(t.sides.lr).toBeGreaterThanOrEqual(SPEAKER_SIDE_RANGE.min);
    expect(t.sides.lr).toBeLessThanOrEqual(SPEAKER_SIDE_RANGE.max);
    expect(box(layout, 'Left speaker').maxX).toBeLessThanOrEqual(box(layout, 'Monitor').minX - 60 + 1e-6);
    expect(box(layout, 'Right speaker').minX).toBeGreaterThanOrEqual(box(layout, 'Monitor').maxX + 60 - 1e-6);
  });

  it('uses the smallest triangle that clears the monitors', () => {
    const small = analyzeTriangle(arrangeLayout(spec({ monitors: [mon(24)] })).layout)!.sides.lr;
    const big = analyzeTriangle(arrangeLayout(spec({ monitors: [mon(34)] })).layout)!.sides.lr;
    expect(small).toBeGreaterThanOrEqual(SPEAKER_SIDE_RANGE.min);
    expect(big).toBeGreaterThan(small);
    // One step (10 mm) smaller would not clear.
    expect(big - 10).toBeGreaterThanOrEqual(SPEAKER_SIDE_RANGE.min);
    expect(analyzeTriangle(arrangeLayout(spec({ monitors: [] })).layout)!.sides.lr).toBeCloseTo(SPEAKER_SIDE_RANGE.noMonitors, 6);
  });

  it('places speakers off a small desk anyway, and says so', () => {
    const { layout, notes } = arrangeLayout(spec({ desk: { ...DEFAULT_DESK, width: 1000, depth: 600 }, monitors: [mon(27), mon(27)] }));
    expect(analyzeTriangle(layout)!.angles!.left).toBeCloseTo(60, 6);
    expect(notes.some((n) => /left speaker is \d+ mm past the left edge/.test(n))).toBe(true);
    expect(notes.some((n) => /stand or a clamp/.test(n))).toBe(true);
  });

  it('says so when even the largest triangle can’t clear the monitors (e.g. a second screen to one side)', () => {
    const { layout, notes } = arrangeLayout(spec({ monitors: [mon(27), mon(27)] }));
    expect(analyzeTriangle(layout)!.sides.lr).toBe(SPEAKER_SIDE_RANGE.max);
    expect(notes.some((n) => n.includes('doesn’t clear all the monitors'))).toBe(true);
  });

  it('puts the keyboard at the front on the listener, the mouse to its right, both on the mat', () => {
    const { layout } = arrangeLayout(spec());
    const kb = byLabel(layout, 'Keyboard');
    const mouse = byLabel(layout, 'Mouse');
    const mat = layout.instances.find((i) => layout.definitions[i.definitionId]?.category === 'mat')!;
    expect(kb.position.x).toBeCloseTo(layout.listener.x, 6);
    expect(box(layout, 'Keyboard').maxZ).toBeCloseTo(-100, 6);
    expect(mouse.position.x).toBeGreaterThan(box(layout, 'Keyboard').maxX);
    expect(kb.position.y).toBe(3);
    expect(mouse.position.y).toBe(3);
    const matBox = obbAabb(instanceObb(mat, layout.definitions[mat.definitionId]!));
    expect(matBox.minX).toBeLessThan(box(layout, 'Keyboard').minX);
    expect(matBox.maxX).toBeGreaterThan(box(layout, 'Mouse').maxX);
  });

  it('a typical setup has no overlaps and nothing to report', () => {
    const items = ['kb-tkl', 'mouse', 'mat', 'light-bar', 'light-lamp', 'audio-if', 'hp-stand', 'mic-clamp', 'pc-tower'].map((id) => ({ preset: preset(id), quantity: 1 }));
    const { layout, notes } = arrangeLayout(spec({ monitors: [mon(27)], items }));
    expect(findOverlaps(layout).size).toBe(0);
    expect(notes).toEqual([]);
    expect(byLabel(layout, 'PC tower (on floor)').position.y).toBe(-layout.desk.heightFromFloor);
    const bar = byLabel(layout, 'Monitor light bar');
    const main = byLabel(layout, 'Monitor');
    expect(bar.position.x).toBeCloseTo(main.position.x, 6);
    expect(bar.position.y).toBeGreaterThan(main.position.y);
  });

  it('places quantities as separate, numbered objects', () => {
    const { layout } = arrangeLayout(spec({ items: [{ preset: preset('hp-stand'), quantity: 2 }] }));
    expect(layout.instances.filter((i) => i.label.startsWith('Headphone stand')).map((i) => i.label)).toEqual(['Headphone stand 1', 'Headphone stand 2']);
    expect(findOverlaps(layout).size).toBe(0);
  });

  it('reports overlaps it couldn’t avoid', () => {
    const items = [{ preset: preset('box'), quantity: 1 }].map((i) => ({ ...i, preset: { ...i.preset, size: { w: 1600, d: 800, h: 100 } } }));
    const { notes } = arrangeLayout(spec({ items }));
    expect(notes.some((n) => n.startsWith('Some things overlap'))).toBe(true);
  });

  it('works with nothing at all', () => {
    const { layout, notes } = arrangeLayout(spec({ monitors: [], speakers: null, items: [] }));
    expect(layout.instances).toEqual([]);
    expect(notes).toEqual([]);
  });
});
