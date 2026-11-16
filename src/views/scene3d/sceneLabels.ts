import { formatMm } from '../../lib/format';
import type { Layout } from '../../model/types';
import { classifyAngle } from '../../layout/triangle';
import type { TriangleReading } from '../../layout/triangle';
import type { SceneLabel } from './labels';

export function deskLabels(layout: Layout): SceneLabel[] {
  const { width: W, depth: D } = layout.desk;
  return [
    { id: 'desk-w', text: formatMm(W), position: { x: 0, y: 0, z: 45 } },
    { id: 'desk-d', text: formatMm(D), position: { x: -W / 2 - 40, y: 0, z: -D / 2 } },
  ];
}

/** Side lengths and interior angles of the speaker triangle, on the ear-height plane. */
export function triangleLabels(t: TriangleReading, layout: Layout): SceneLabel[] {
  const { left: L, right: R, listener: P } = t.corners;
  const y = t.earY;
  const c = { x: (L.x + R.x + P.x) / 3, z: (L.z + R.z + P.z) / 3 };
  const mid = (a: { x: number; z: number }, b: { x: number; z: number }) => ({ x: (a.x + b.x) / 2, y, z: (a.z + b.z) / 2 });
  // Angle labels sit a little inside each corner, toward the centroid.
  const inside = (p: { x: number; z: number }) => {
    const dx = c.x - p.x;
    const dz = c.z - p.z;
    const k = Math.min(160, Math.hypot(dx, dz) * 0.5) / Math.max(Math.hypot(dx, dz), 1e-9);
    return { x: p.x + dx * k, y, z: p.z + dz * k };
  };
  const labels: SceneLabel[] = [
    { id: 'tri-lr', text: formatMm(t.sides.lr), position: mid(L, R), tone: 'accent' },
    { id: 'tri-lp', text: formatMm(t.sides.leftListener), position: mid(L, P), tone: 'accent' },
    { id: 'tri-rp', text: formatMm(t.sides.rightListener), position: mid(R, P), tone: 'accent' },
  ];
  if (t.angles) {
    const tol = layout.settings.tolerances;
    const add = (id: string, p: { x: number; z: number }, a: number) =>
      labels.push({ id, text: `${a.toFixed(1)}°`, position: inside(p), tone: classifyAngle(a - 60, tol) });
    add('tri-al', L, t.angles.left);
    add('tri-ar', R, t.angles.right);
    add('tri-ap', P, t.angles.listener);
  }
  return labels;
}
