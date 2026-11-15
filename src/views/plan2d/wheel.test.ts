import { describe, expect, it } from 'vitest';
import { classifyWheel } from './wheel';

describe('classifyWheel', () => {
  const base = { deltaX: 0, deltaY: 0, deltaMode: 0, ctrlKey: false, metaKey: false };

  it('treats pinch (ctrl+wheel) as zoom', () => {
    const r = classifyWheel({ ...base, deltaY: -10, ctrlKey: true });
    expect(r.kind).toBe('zoom');
    if (r.kind === 'zoom') expect(r.factor).toBeGreaterThan(1);
  });

  it('treats notched mouse wheels as zoom', () => {
    expect(classifyWheel({ ...base, deltaY: 100 }).kind).toBe('zoom');
    expect(classifyWheel({ ...base, deltaY: 3, deltaMode: 1 }).kind).toBe('zoom');
    const out = classifyWheel({ ...base, deltaY: 100 });
    if (out.kind === 'zoom') expect(out.factor).toBeLessThan(1);
  });

  it('treats smooth two-finger scrolls as pan', () => {
    expect(classifyWheel({ ...base, deltaX: 4.5, deltaY: 2 }).kind).toBe('pan');
    expect(classifyWheel({ ...base, deltaY: 7.25 }).kind).toBe('pan');
  });
});
