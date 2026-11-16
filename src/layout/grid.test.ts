import { describe, expect, it } from 'vitest';
import { deskGridLines } from './grid';

describe('desk grid', () => {
  const desk = { width: 1600, depth: 800 };

  it('skips the outline and the centreline', () => {
    const lines = deskGridLines(desk, 100);
    const xs = lines.filter((l) => l.a.x === l.b.x).map((l) => l.a.x);
    const zs = lines.filter((l) => l.a.z === l.b.z).map((l) => l.a.z);
    expect(xs).toHaveLength(14); // −700 … 700 without 0
    expect(xs).not.toContain(0);
    expect(xs).not.toContain(800);
    expect(zs).toEqual([-100, -200, -300, -400, -500, -600, -700]);
  });

  it('marks every fifth line as major', () => {
    const lines = deskGridLines(desk, 100);
    const majorXs = lines.filter((l) => l.major && l.a.x === l.b.x).map((l) => l.a.x);
    expect(majorXs.sort((a, b) => a - b)).toEqual([-500, 500]);
  });

  it('doubles the spacing until it reaches the minimum', () => {
    const coarse = deskGridLines(desk, 10, 35);
    const zs = coarse.filter((l) => l.a.z === l.b.z).map((l) => l.a.z);
    expect(zs[0]).toBe(-40);
    expect(zs[1]).toBe(-80);
  });

  it('returns nothing for a non-positive spacing', () => {
    expect(deskGridLines(desk, 0)).toEqual([]);
  });
});
