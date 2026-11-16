import { describe, expect, it } from 'vitest';
import { updateInstance } from '../model/ops';
import type { Layout } from '../model/types';
import { expectFinite, H, perfectLayout, SPK, speakerLayout } from './triangle.fixtures';
import { acousticPoint, aimPoint, analyzeTriangle, classify, findSpeakerPair } from './triangle';

const read = (l: Layout) => {
  const t = analyzeTriangle(l);
  if (!t) throw new Error('no triangle');
  expectFinite(t);
  return t;
};
const byLabel = (l: Layout, label: string) => l.instances.find((i) => i.label === label)!;
const turn = (l: Layout, label: string, yaw: number, pitch = 0) => updateInstance(l, byLabel(l, label).id, { rotation: { yaw, pitch } });

describe('speaker triangle: perfect equilateral', () => {
  const t = read(perfectLayout());

  it('has 1 m sides and 60° everywhere', () => {
    expect(t.sides.lr).toBeCloseTo(1000, 6);
    expect(t.sides.leftListener).toBeCloseTo(1000, 6);
    expect(t.sides.rightListener).toBeCloseTo(1000, 6);
    expect(t.angles!.left).toBeCloseTo(60, 9);
    expect(t.angles!.right).toBeCloseTo(60, 9);
    expect(t.angles!.listener).toBeCloseTo(60, 9);
  });

  it('has no toe-in error and needs ±30° yaw', () => {
    expect(t.left.toeInError).toBeCloseTo(0, 9);
    expect(t.right.toeInError).toBeCloseTo(0, 9);
    expect(t.left.requiredYaw).toBeCloseTo(30, 9);
    expect(t.right.requiredYaw).toBeCloseTo(-30, 9);
  });

  it('is symmetric, with the listener lr·√3/2 from the speaker line', () => {
    expect(t.symmetry.distanceDiff).toBeCloseTo(0, 9);
    expect(t.symmetry.offsetAlong).toBeCloseTo(0, 9);
    expect(t.symmetry.offsetAcross).toBeCloseTo(1000 * H, 6);
  });

  it('has the tweeters level with the ears', () => {
    expect(t.left.vertical.dy).toBeCloseTo(0, 9);
    expect(t.left.vertical.angle).toBeCloseTo(0, 9);
    expect(t.earY).toBeCloseTo(SPK.ac, 9);
  });

  it('reports no wall distance without a back wall', () => {
    expect(t.left.wallDistance).toBeNull();
  });
});

describe('speaker triangle: rotation and mirroring', () => {
  it('mirrored pairs have opposite toe-in errors', () => {
    const t = read(turn(turn(perfectLayout(), 'L', 35), 'R', -35));
    // About −5° (turning about the footprint centre also moves the tweeter a little).
    expect(t.left.toeInError!).toBeLessThan(-4);
    expect(t.left.toeInError!).toBeGreaterThan(-7);
    expect(t.left.toeInError!).toBeCloseTo(-t.right.toeInError!, 9);
  });

  it('a speaker facing straight ahead needs to turn toward the listener', () => {
    const l = turn(perfectLayout(), 'L', 0);
    const t = read(l);
    // The footprint didn't move, so the required yaw is still exactly 30°…
    expect(t.left.requiredYaw).toBeCloseTo(30, 9);
    // …and the error is about +30° (the acoustic point moved a little when it turned).
    expect(t.left.toeInError!).toBeGreaterThan(25);
    expect(t.left.toeInError!).toBeLessThan(35);
    // Applying the required yaw removes the error.
    expect(read(turn(l, 'L', t.left.requiredYaw!)).left.toeInError).toBeCloseTo(0, 9);
  });

  it('pitch moves the acoustic point up and back', () => {
    const l = turn(perfectLayout(), 'L', 30, 10);
    const inst = byLabel(l, 'L');
    const def = l.definitions[inst.definitionId]!;
    const p = acousticPoint(inst, def);
    const r = (10 * Math.PI) / 180;
    expect(p.y).toBeCloseTo(SPK.ac * Math.cos(r) + (SPK.d / 2) * Math.sin(r), 9);
    // The front offset shrinks to d/2·cos(p) − h·sin(p) along the forward axis.
    const along = (SPK.d / 2) * Math.cos(r) - SPK.ac * Math.sin(r);
    expect(Math.hypot(p.x - inst.position.x, p.z - inst.position.z)).toBeCloseTo(Math.abs(along), 9);
    // Tilted up, the ears are below the tweeter.
    expect(read(l).left.vertical.dy).toBeLessThan(0);
  });
});

describe('speaker triangle: asymmetric placements', () => {
  it('a speaker further back makes the sides unequal', () => {
    const l = speakerLayout({ left: { x: -500, z: -300 }, right: { x: 500, z: -400 }, leftYaw: 30, rightYaw: -30, listener: { x: 0, z: 600 } });
    const t = read(l);
    expect(t.symmetry.distanceDiff).toBeLessThan(0); // left is closer
    expect(t.angles!.left + t.angles!.right + t.angles!.listener).toBeCloseTo(180, 9);
    expect(t.angles!.left).toBeGreaterThan(t.angles!.right);
  });

  it('a listener off the centreline is offset toward one speaker', () => {
    const l = speakerLayout({ left: { x: -500, z: 600 - 1000 * H }, right: { x: 500, z: 600 - 1000 * H }, leftYaw: 30, rightYaw: -30, listener: { x: 100, z: 600 } });
    const t = read(l);
    expect(t.symmetry.offsetAlong).toBeCloseTo(100, 9);
    expect(t.symmetry.offsetAcross).toBeCloseTo(1000 * H, 6);
    expect(t.symmetry.distanceDiff).toBeGreaterThan(0); // left is further away
    expect(t.angles!.left).toBeLessThan(60);
    expect(t.angles!.right).toBeGreaterThan(60);
    // The listener moved toward +X, so both speakers must turn toward +X (positive yaw).
    expect(t.left.toeInError!).toBeGreaterThan(0);
    expect(t.right.toeInError!).toBeGreaterThan(0);
  });

  it('the aim offset moves the aim point behind the head', () => {
    const l = perfectLayout();
    const behind = { ...l, settings: { ...l.settings, aimOffset: 100 } };
    expect(aimPoint(behind).z).toBe(700);
    const t = read(behind);
    // Aiming further back means turning the left speaker a little less toward +X.
    expect(t.left.toeInError!).toBeLessThan(0);
    expect(t.right.toeInError!).toBeCloseTo(-t.left.toeInError!, 9);
    // The triangle itself still uses the head.
    expect(t.angles!.listener).toBeCloseTo(60, 9);
  });
});

describe('speaker triangle: back wall', () => {
  it('measures from the rear of the footprint to the wall', () => {
    const base = speakerLayout({ left: { x: -500, z: -500 }, right: { x: 500, z: -500 }, leftYaw: 0, rightYaw: 90, listener: { x: 0, z: 600 } });
    const l = { ...base, backWall: { distanceBehindDesk: 50 } };
    const t = read(l);
    // Left faces +Z: its rear is d/2 behind the footprint centre, at −500 − 300 = −800. The wall is at −850.
    expect(t.left.wallDistance).toBeCloseTo(50, 9);
    // Right faces +X: its rear (in z) is w/2 behind the centre.
    const r = byLabel(l, 'R');
    expect(t.right.wallDistance).toBeCloseTo(r.position.z - SPK.w / 2 + 850, 9);
    expect(t.left.rearPorted).toBe(true);
  });
});

describe('speaker triangle: degenerate cases', () => {
  it('no pair gives no reading', () => {
    const l = perfectLayout();
    expect(analyzeTriangle({ ...l, instances: l.instances.filter((i) => i.role !== 'speakerR') })).toBeNull();
    expect(findSpeakerPair({ ...l, instances: [] })).toBeNull();
  });

  it('speakers at the same point', () => {
    const t = read(speakerLayout({ left: { x: 0, z: -400 }, right: { x: 0, z: -400 }, leftYaw: 0, rightYaw: 0, listener: { x: 0, z: 600 } }));
    expect(t.sides.lr).toBeCloseTo(0, 9);
    expect(t.angles).toBeNull();
    expect(t.symmetry.offsetAlong).toBeNull();
    expect(t.symmetry.offsetAcross).toBeNull();
  });

  it('a listener in line with the speakers', () => {
    const t = read(speakerLayout({ left: { x: -500, z: -400 }, right: { x: 500, z: -400 }, leftYaw: 90, rightYaw: -90, listener: { x: 1200, z: -400 } }));
    expect(t.angles).toBeNull();
    expect(t.symmetry.offsetAcross).toBeCloseTo(0, 9);
  });

  it('a speaker exactly at the aim point', () => {
    const t = read(speakerLayout({ left: { x: 0, z: 600 }, right: { x: 500, z: -400 }, leftYaw: 0, rightYaw: 0, listener: { x: 0, z: 600 } }));
    expect(t.left.toeInError).toBeNull();
    expect(t.left.requiredYaw).toBeNull();
    expect(t.left.vertical.angle).toBeNull();
    expect(t.left.vertical.suggestedPitch).toBeNull();
    expect(t.angles).toBeNull();
    expect(t.right.toeInError).not.toBeNull();
  });
});

describe('tolerance classes', () => {
  it('uses the absolute value and inclusive boundaries', () => {
    expect(classify(0, 2, 5)).toBe('green');
    expect(classify(2, 2, 5)).toBe('green');
    expect(classify(-2, 2, 5)).toBe('green');
    expect(classify(2.01, 2, 5)).toBe('amber');
    expect(classify(-5, 2, 5)).toBe('amber');
    expect(classify(5.01, 2, 5)).toBe('red');
    expect(classify(20, 20, 50)).toBe('green');
    expect(classify(51, 20, 50)).toBe('red');
  });
});
