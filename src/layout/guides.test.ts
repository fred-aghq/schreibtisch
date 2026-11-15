import { describe, expect, it } from 'vitest';
import { dimensionGuides } from './guides';

describe('dimensionGuides', () => {
  it('measures to the nearer side, the nearer front/back edge and the centreline', () => {
    const g = dimensionGuides({ minX: -700, maxX: -500, minZ: -300, maxZ: -200 }, 1600, 800);
    const byId = Object.fromEntries(g.map((x) => [x.id, x]));
    expect(byId.left?.value).toBe(100);
    expect(byId.front?.value).toBe(200);
    expect(byId.centre?.value).toBe(-600);
    expect(byId.right).toBeUndefined();
    expect(byId.back).toBeUndefined();
  });

  it('switches to the right / back edges when nearer', () => {
    const g = dimensionGuides({ minX: 500, maxX: 700, minZ: -750, maxZ: -650 }, 1600, 800);
    const ids = g.map((x) => x.id);
    expect(ids).toContain('right');
    expect(ids).toContain('back');
    expect(g.find((x) => x.id === 'back')?.value).toBe(50);
  });

  it('reports negative distances when past an edge', () => {
    const g = dimensionGuides({ minX: -900, maxX: -700, minZ: -300, maxZ: -200 }, 1600, 800);
    expect(g.find((x) => x.id === 'left')?.value).toBe(-100);
  });

  it('omits the centre guide when centred', () => {
    const g = dimensionGuides({ minX: -100, maxX: 100, minZ: -300, maxZ: -200 }, 1600, 800);
    expect(g.some((x) => x.id === 'centre')).toBe(false);
  });
});
