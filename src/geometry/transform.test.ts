import { describe, expect, it } from 'vitest';
import { forwardDir, localToWorldPlan, mirrorX, mirrorYaw, rotatePlan, unrotatePlan, yawFromDir } from './transform';

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
