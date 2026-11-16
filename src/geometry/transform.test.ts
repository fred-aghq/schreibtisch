import { describe, expect, it } from 'vitest';
import { forward3, forwardDir, localToWorldPlan, mirrorX, mirrorYaw, objectEuler, rotateLocal, rotatePlan, unrotatePlan, yawFromDir } from './transform';

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 9);

describe('yaw convention', () => {
  it('yaw 0 faces +Z (the user)', () => {
    const f = forwardDir(0);
    close(f.x, 0);
    close(f.z, 1);
  });

  it('yaw +90 faces +X (the user\'s right)', () => {
    const f = forwardDir(90);
    close(f.x, 1);
    close(f.z, 0);
  });

  it('matches three.js Object3D rotation.y for local +Z', () => {
    // three.js: rotating (0,0,1) by +θ about Y yields (sin θ, 0, cos θ)
    const r = rotatePlan({ x: 0, z: 1 }, 30);
    close(r.x, Math.sin(Math.PI / 6));
    close(r.z, Math.cos(Math.PI / 6));
    // ...and local +X goes to (cos θ, 0, −sin θ)
    const rx = rotatePlan({ x: 1, z: 0 }, 30);
    close(rx.x, Math.cos(Math.PI / 6));
    close(rx.z, -Math.sin(Math.PI / 6));
  });

  it('yawFromDir inverts forwardDir', () => {
    for (const yaw of [-179, -90, -30, 0, 15, 90, 135, 180]) {
      close(yawFromDir(forwardDir(yaw)), yaw);
    }
    expect(yawFromDir({ x: 0, z: 0 })).toBe(0);
  });

  it('unrotate inverts rotate', () => {
    const p = { x: 123, z: -45 };
    const back = unrotatePlan(rotatePlan(p, 37), 37);
    close(back.x, p.x);
    close(back.z, p.z);
  });

  it('local → world translates after rotating', () => {
    const w = localToWorldPlan({ x: 0, z: 100 }, { x: 10, z: 20 }, 90);
    close(w.x, 110);
    close(w.z, 20);
  });
});

describe('mirroring', () => {
  it('mirrors x about a centre and negates yaw', () => {
    expect(mirrorX(-300, 0)).toBe(300);
    expect(mirrorX(-300, 50)).toBe(400);
    expect(mirrorYaw(25)).toBe(-25);
    expect(mirrorYaw(180)).toBe(180);
  });

  it('a mirrored object points at the mirrored target', () => {
    // Left speaker at (-500, -500) aimed at (0, 600); mirrored right speaker should aim at the same point.
    const target = { x: 0, z: 600 };
    const yawL = yawFromDir({ x: target.x - -500, z: target.z - -500 });
    const yawR = mirrorYaw(yawL);
    const expected = yawFromDir({ x: target.x - 500, z: target.z - -500 });
    close(yawR, expected);
  });
});

describe('3D orientation', () => {
  it('pitch tips the front upward', async () => {
    const { forward3, objectEuler } = await import('./transform');
    const f = forward3(0, 10);
    expect(f.y).toBeGreaterThan(0);
    expect(f.z).toBeCloseTo(Math.cos(Math.PI / 18));
    expect(objectEuler(0, 10).x).toBeLessThan(0);
  });

  it('forward3 with zero pitch equals the plan forward', async () => {
    const { forward3 } = await import('./transform');
    const f = forward3(30, 0);
    const p = forwardDir(30);
    expect(f.x).toBeCloseTo(p.x);
    expect(f.z).toBeCloseTo(p.z);
    expect(f.y).toBeCloseTo(0);
  });

  it('matches three.js YXZ Euler applied to local +Z', async () => {
    // Rx(a) then Ry(b) applied to (0,0,1): Rx gives (0, -sin a, cos a); Ry rotates in XZ.
    const { forward3, objectEuler } = await import('./transform');
    const e = objectEuler(40, 15);
    const yx = { x: 0, y: -Math.sin(e.x), z: Math.cos(e.x) };
    const world = { x: yx.x * Math.cos(e.y) + yx.z * Math.sin(e.y), y: yx.y, z: -yx.x * Math.sin(e.y) + yx.z * Math.cos(e.y) };
    const f = forward3(40, 15);
    expect(world.x).toBeCloseTo(f.x);
    expect(world.y).toBeCloseTo(f.y);
    expect(world.z).toBeCloseTo(f.z);
  });
});

describe('rotateLocal', () => {
  it('matches three.js with the objectEuler rotation', async () => {
    const { Euler, Vector3 } = await import('three');
    for (const [yaw, pitch] of [[0, 0], [30, 0], [0, 15], [-40, 10], [135, -20]] as const) {
      const e = objectEuler(yaw, pitch);
      const v = new Vector3(12, 300, 145).applyEuler(new Euler(e.x, e.y, e.z, e.order));
      const r = rotateLocal({ x: 12, y: 300, z: 145 }, yaw, pitch);
      expect(r.x).toBeCloseTo(v.x, 9);
      expect(r.y).toBeCloseTo(v.y, 9);
      expect(r.z).toBeCloseTo(v.z, 9);
    }
  });

  it('local front (+Z) becomes forward3', () => {
    const r = rotateLocal({ x: 0, y: 0, z: 1 }, 25, 12);
    const f = forward3(25, 12);
    expect(r.x).toBeCloseTo(f.x, 12);
    expect(r.y).toBeCloseTo(f.y, 12);
    expect(r.z).toBeCloseTo(f.z, 12);
  });
});
