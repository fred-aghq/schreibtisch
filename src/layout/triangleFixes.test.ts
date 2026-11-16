import { describe, expect, it } from 'vitest';
import { updateInstance } from '../model/ops';
import type { Layout } from '../model/types';
import { expectFinite, H, perfectLayout, speakerLayout } from './triangle.fixtures';
import { analyzeTriangle } from './triangle';
import { aimSpeakersAtListener, fixGhosts, moveListenerToIdeal, moveSpeakersToIdeal, tiltSpeakersToEars } from './triangleFixes';

const read = (l: Layout) => {
  const t = analyzeTriangle(l)!;
  expectFinite(t);
  return t;
};
const expectEquilateral = (l: Layout) => {
  const t = read(l);
  expect(t.angles!.left).toBeCloseTo(60, 6);
  expect(t.angles!.right).toBeCloseTo(60, 6);
  expect(t.angles!.listener).toBeCloseTo(60, 6);
};
const lock = (l: Layout, label: string) => updateInstance(l, l.instances.find((i) => i.label === label)!.id, { locked: true });

/** Speakers in an uneven spot, listener off-centre, mirroring on. */
const messy = () => speakerLayout({ left: { x: -620, z: -350 }, right: { x: 480, z: -420 }, leftYaw: 10, rightYaw: -45, listener: { x: 60, z: 640 } });

describe('move listener to ideal', () => {
  it('puts the listener at the apex, keeping ear height', () => {
    const l = messy();
    const next = moveListenerToIdeal(l);
    expectEquilateral(next);
    expect(next.listener.earHeightFromFloor).toBe(l.listener.earHeightFromFloor);
    expect(read(next).sides.leftListener).toBeCloseTo(read(l).sides.lr, 6);
  });

  it('stays on the listener’s side of the speakers, or the user’s side when in line', () => {
    const behind = speakerLayout({ left: { x: -500, z: 0 }, right: { x: 500, z: 0 }, leftYaw: 180, rightYaw: 180, listener: { x: 0, z: -300 } });
    expect(moveListenerToIdeal(behind).listener.distanceFromFrontEdge).toBeCloseTo(-1000 * H, 6);
    const inLine = speakerLayout({ left: { x: -500, z: 0 }, right: { x: 500, z: 0 }, leftYaw: 0, rightYaw: 0, listener: { x: 900, z: 0 } });
    expect(moveListenerToIdeal(inLine).listener.distanceFromFrontEdge).toBeCloseTo(1000 * H, 6);
  });

  it('does nothing when the speakers coincide', () => {
    const l = speakerLayout({ left: { x: 0, z: -400 }, right: { x: 0, z: -400 }, leftYaw: 0, rightYaw: 0, listener: { x: 0, z: 600 } });
    expect(moveListenerToIdeal(l)).toBe(l);
  });
});

describe('move speakers to ideal', () => {
  it('keeping the listener distance: equilateral, aimed, side = mean distance', () => {
    const l = messy();
    const before = read(l);
    const next = moveSpeakersToIdeal(l, 'distance');
    expectEquilateral(next);
    const t = read(next);
    expect(t.sides.lr).toBeCloseTo((before.sides.leftListener + before.sides.rightListener) / 2, 6);
    expect(t.left.toeInError).toBeCloseTo(0, 6);
    expect(t.right.toeInError).toBeCloseTo(0, 6);
    // Mirrored about the listener, who didn't move.
    expect(next.listener).toEqual(l.listener);
    expect(t.corners.left.x + t.corners.right.x).toBeCloseTo(2 * l.listener.x, 6);
  });

  it('keeping the spacing: same L–R distance', () => {
    const l = messy();
    const next = moveSpeakersToIdeal(l, 'spacing');
    expectEquilateral(next);
    expect(read(next).sides.lr).toBeCloseTo(read(l).sides.lr, 6);
  });

  it('keeps each speaker’s elevation and tilt', () => {
    const l = updateInstance(messy(), messy().instances[0]!.id, {});
    const raised = updateInstance(l, l.instances[0]!.id, { position: { y: 120 }, rotation: { pitch: 5 } });
    const next = moveSpeakersToIdeal(raised, 'distance');
    expect(next.instances[0]!.position.y).toBe(120);
    expect(next.instances[0]!.rotation.pitch).toBe(5);
    expect(read(next).left.toeInError).toBeCloseTo(0, 6);
  });

  it('leaves a locked speaker where it is', () => {
    const l = lock(messy(), 'R');
    const next = moveSpeakersToIdeal(l, 'distance');
    const r = (x: Layout) => x.instances.find((i) => i.label === 'R')!;
    expect(r(next)).toEqual(r(l));
    expect(next.instances.find((i) => i.label === 'L')).not.toEqual(l.instances.find((i) => i.label === 'L'));
  });
});

describe('aim and tilt', () => {
  it('aims both speakers at the listener', () => {
    const next = aimSpeakersAtListener(messy());
    const t = read(next);
    expect(t.left.toeInError).toBeCloseTo(0, 9);
    expect(t.right.toeInError).toBeCloseTo(0, 9);
  });

  it('aims at the aim point when an aim offset is set', () => {
    const l = messy();
    const t = read(aimSpeakersAtListener({ ...l, settings: { ...l.settings, aimOffset: 150 } }));
    expect(t.left.toeInError).toBeCloseTo(0, 9);
  });

  it('skips a locked speaker', () => {
    const l = lock(messy(), 'L');
    const t = read(aimSpeakersAtListener(l));
    expect(t.left.toeInError).toBeCloseTo(read(l).left.toeInError!, 9);
    expect(t.right.toeInError).toBeCloseTo(0, 9);
  });

  it('tilts the tweeters to point at the ears', () => {
    const l = messy();
    const low = { ...l, listener: { ...l.listener, earHeightFromFloor: l.listener.earHeightFromFloor + 200 } };
    const next = tiltSpeakersToEars(low);
    const t = read(next);
    for (const s of [t.left, t.right]) {
      const pitch = next.instances.find((i) => i.id === s.id)!.rotation.pitch;
      expect(pitch).toBeGreaterThan(0);
      expect(s.vertical.angle!).toBeCloseTo(pitch, 2);
    }
  });

  it('a perfect setup needs no changes', () => {
    const l = perfectLayout();
    const t = read(aimSpeakersAtListener(l));
    expect(t.left.toeInError).toBeCloseTo(0, 9);
    expect(read(moveListenerToIdeal(l)).corners.listener.z).toBeCloseTo(600, 6);
  });
});

describe('fix previews', () => {
  it('lists what a fix would move', () => {
    const l = messy();
    const listener = fixGhosts(l, 'listener', 'distance')!;
    expect(listener.speakers).toHaveLength(0);
    expect(listener.listener).not.toBeNull();
    expect(listener.reading!.angles!.listener).toBeCloseTo(60, 6);

    const aim = fixGhosts(l, 'aim', 'distance')!;
    expect(aim.speakers.map((s) => s.inst.label).sort()).toEqual(['L', 'R']);
    expect(aim.listener).toBeNull();
  });

  it('is null when nothing would change', () => {
    expect(fixGhosts(lock(lock(messy(), 'L'), 'R'), 'aim', 'distance')).toBeNull();
  });
});

describe('fixes are idempotent', () => {
  it('applying a fix twice changes nothing the second time', () => {
    const m = messy();
    // Raise the ears so there is something to tilt toward.
    const l = { ...m, listener: { ...m.listener, earHeightFromFloor: m.listener.earHeightFromFloor + 150 } };
    for (const fix of [aimSpeakersAtListener, moveListenerToIdeal, (x: Layout) => moveSpeakersToIdeal(x, 'distance'), (x: Layout) => moveSpeakersToIdeal(x, 'spacing'), tiltSpeakersToEars]) {
      const once = fix(l);
      expect(once).not.toBe(l);
      expect(fix(once)).toBe(once);
    }
  });

  it('a perfect, level setup needs no fixes at all', () => {
    const l = perfectLayout();
    expect(aimSpeakersAtListener(l)).toBe(l);
    expect(moveListenerToIdeal(l)).toBe(l);
    expect(moveSpeakersToIdeal(l, 'distance')).toBe(l);
    expect(tiltSpeakersToEars(l)).toBe(l);
  });

  it('after tilting, the tilt error is zero', () => {
    const l = messy();
    const low = { ...l, listener: { ...l.listener, earHeightFromFloor: l.listener.earHeightFromFloor + 200 } };
    expect(read(low).left.vertical.tiltError!).toBeGreaterThan(5);
    expect(read(tiltSpeakersToEars(low)).left.vertical.tiltError).toBeCloseTo(0, 2);
  });
});
