import { describe, expect, it } from 'vitest';
import { panelArea } from '../geometry/monitor';
import { monitorName, monitorPanelSize, monitorPreset } from './presets';

describe('monitor presets', () => {
  it('names monitors readably', () => {
    expect(monitorName({ diagonalIn: 27, aspect: '16:9' })).toBe('Monitor 27" 16:9');
    expect(monitorName({ diagonalIn: 21.5, aspect: '16:9' })).toBe('Monitor 21.5" 16:9');
  });

  it('maps named aspect ratios onto the generator', () => {
    const s = monitorPanelSize({ diagonalIn: 34, aspect: '21:9', bezelMm: 0, panelDepth: 60 });
    const a = panelArea(34, [21, 9]);
    expect(s).toEqual({ w: a.w, d: 60, h: a.h });
  });

  it('a 34" 21:9 monitor on a stand is about 810 × 356 mm and lifted onto the stand', () => {
    const p = monitorPreset({ diagonalIn: 34, aspect: '21:9', bezelMm: 8, panelDepth: 50, support: 'stand' });
    expect(Math.round(p.size.w)).toBe(810);
    expect(Math.round(p.size.h)).toBe(356);
    expect(p.elevation).toBe(100);
  });
});
