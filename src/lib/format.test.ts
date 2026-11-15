import { describe, expect, it } from 'vitest';
import { formatMm, roundMm } from './format';

describe('format', () => {
  it('rounds to whole mm without negative zero', () => {
    expect(roundMm(12.4)).toBe(12);
    expect(roundMm(12.5)).toBe(13);
    expect(Object.is(roundMm(-0.2), 0)).toBe(true);
    expect(formatMm(1599.6)).toBe('1600 mm');
    expect(formatMm(-3.2, false)).toBe('-3');
  });
});
