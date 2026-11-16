import { describe, expect, it } from 'vitest';
import { interiorAngleDeg, signedAngleDeg } from './angles';
import { forwardDir } from './transform';

describe('plan angles', () => {
  it('turning +Z toward +X is positive, like yaw', () => {
    expect(signedAngleDeg({ x: 0, z: 1 }, { x: 1, z: 0 })).toBeCloseTo(90);
    expect(signedAngleDeg({ x: 1, z: 0 }, { x: 0, z: 1 })).toBeCloseTo(-90);
  });

  it('turns one forward direction onto another, the short way round', () => {
    for (const [a, b] of [[10, 70], [-30, 25], [0, -45]] as const) {
      expect(signedAngleDeg(forwardDir(a), forwardDir(b))).toBeCloseTo(b - a);
    }
    expect(signedAngleDeg(forwardDir(170), forwardDir(-170))).toBeCloseTo(20);
  });

  it('is null for zero vectors', () => {
    expect(signedAngleDeg({ x: 0, z: 0 }, { x: 1, z: 0 })).toBeNull();
    expect(interiorAngleDeg({ x: 1, z: 0 }, { x: 1, z: 0 }, { x: 0, z: 1 })).toBeNull();
  });

  it('measures interior angles', () => {
    expect(interiorAngleDeg({ x: 1, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 1 })).toBeCloseTo(90);
    expect(interiorAngleDeg({ x: -1, z: 0 }, { x: 0, z: 0 }, { x: 1, z: 0 })).toBeCloseTo(180);
    const h = Math.sqrt(3) / 2;
    expect(interiorAngleDeg({ x: -0.5, z: 0 }, { x: 0.5, z: 0 }, { x: 0, z: h })).toBeCloseTo(60);
  });
});
