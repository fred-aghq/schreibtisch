import { formatMm } from '../../geometry/units';
import type { Layout } from '../../model/types';
import type { SceneLabel } from './labels';

export function deskLabels(layout: Layout): SceneLabel[] {
  const { width: W, depth: D } = layout.desk;
  return [
    { id: 'desk-w', text: formatMm(W), position: { x: 0, y: 0, z: 45 } },
    { id: 'desk-d', text: formatMm(D), position: { x: -W / 2 - 40, y: 0, z: -D / 2 } },
  ];
}
