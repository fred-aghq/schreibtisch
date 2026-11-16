import { describe, expect, it } from 'vitest';
import { niceLength, normalizeDeg, snapTo } from './math';

describe('math', () => {
  it('normalises angles to (-180, 180]', () => {
    expect(normalizeDeg(0)).toBe(0);
    expect(normalizeDeg(180)).toBe(180);
    expect(normalizeDeg(-180)).toBe(180);
    expect(normalizeDeg(270)).toBe(-90);
    expect(normalizeDeg(-370)).toBe(-10);
    expect(normalizeDeg(720)).toBe(0);
  });

  it('snaps to steps', () => {
    expect(snapTo(13, 5)).toBe(15);
    expect(snapTo(12.4, 5)).toBe(10);
    expect(snapTo(-2, 5)).toBe(0);
    expect(snapTo(12.3, 0)).toBe(12.3);
  });

  it('picks nice scale-bar lengths', () => {
    expect(niceLength(130)).toBe(100);
    expect(niceLength(260)).toBe(200);
    expect(niceLength(999)).toBe(500);
    expect(niceLength(1)).toBe(1);
    expect(niceLength(0)).toBe(0);
  });
});
