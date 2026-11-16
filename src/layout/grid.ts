import type { Vec2 } from '../geometry/vec';
import type { Desk } from '../model/types';

export interface GridLine {
  a: Vec2;
  b: Vec2;
  /** Every fifth line (by world position) is drawn stronger. */
  major: boolean;
}

/**
 * Grid line segments on the desk top. Lines on the desk's outline and its centreline are left
 * out (the views draw those themselves). The spacing doubles until it is at least `minSpacing`,
 * so a zoomed-out plan doesn't turn into a solid fill.
 */
export function deskGridLines(desk: Pick<Desk, 'width' | 'depth'>, spacingMm: number, minSpacing = 0): GridLine[] {
  if (!(spacingMm > 0)) return [];
  let spacing = spacingMm;
  while (spacing < minSpacing) spacing *= 2;
  const { width, depth } = desk;
  const half = width / 2;
  const major = (v: number) => Math.round(v) % (spacing * 5) === 0;
  const lines: GridLine[] = [];
  for (let x = Math.ceil(-half / spacing) * spacing; x <= half; x += spacing) {
    if (Math.abs(x) < 1e-6 || Math.abs(Math.abs(x) - half) < 1e-6) continue;
    lines.push({ a: { x, z: -depth }, b: { x, z: 0 }, major: major(x) });
  }
  for (let z = -spacing; z > -depth; z -= spacing) {
    lines.push({ a: { x: -half, z }, b: { x: half, z }, major: major(z) });
  }
  return lines;
}
