import { describe, expect, it } from 'vitest';
import { monitorSize, panelArea } from './monitor';

describe('monitor generator', () => {
  it('27" 16:9 active area is about 597.7 × 336.2 mm', () => {
    const a = panelArea(27, [16, 9]);
    expect(a.w).toBeCloseTo(597.7, 0);
    expect(a.h).toBeCloseTo(336.2, 0);
  });

  it('keeps the diagonal for every aspect', () => {
    for (const aspect of [[16, 9], [16, 10], [21, 9], [32, 9]] as const) {
      const a = panelArea(34, aspect);
      expect(Math.hypot(a.w, a.h)).toBeCloseTo(34 * 25.4);
    }
  });

  it('49" 32:9 super-ultrawide is about 1196 × 336 mm', () => {
    const a = panelArea(49, [32, 9]);
    expect(a.w).toBeCloseTo(1196, -1);
    expect(a.h).toBeCloseTo(336, -1);
  });

  it('adds bezels on both sides and uses the panel depth', () => {
    const s = monitorSize({ diagonalIn: 27, aspect: [16, 9], bezelMm: 10, panelDepth: 45 });
    const a = panelArea(27, [16, 9]);
    expect(s.w).toBeCloseTo(a.w + 20);
    expect(s.h).toBeCloseTo(a.h + 20);
    expect(s.d).toBe(45);
  });
});
