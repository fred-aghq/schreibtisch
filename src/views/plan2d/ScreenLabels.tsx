import { obbAabb } from '../../geometry/obb';
import { worldToScreen } from '../../geometry/viewport';
import type { Viewport } from '../../geometry/viewport';
import { instanceObb } from '../../layout/scene';
import { formatMm } from '../../lib/format';
import type { Layout } from '../../model/types';
import type { PlanItem } from './PlanObject';
import styles from './PlanView.module.css';

/** Desk dimensions and object labels, drawn in screen space so text stays a constant size. */
export function ScreenLabels({ layout, vp, items, selectedId }: { layout: Layout; vp: Viewport; items: PlanItem[]; selectedId: string | null }) {
  const { width, depth } = layout.desk;
  const topMid = worldToScreen(vp, { x: 0, z: -depth });
  const leftMid = worldToScreen(vp, { x: -width / 2, z: -depth / 2 });
  return (
    <g className={styles.labels} pointerEvents="none">
      <text x={topMid.x} y={topMid.y - 10} textAnchor="middle" className={`${styles.dim} num`}>
        {formatMm(width)}
      </text>
      <text
        x={leftMid.x - 10}
        y={leftMid.y}
        textAnchor="middle"
        transform={`rotate(-90 ${leftMid.x - 10} ${leftMid.y})`}
        className={`${styles.dim} num`}
      >
        {formatMm(depth)}
      </text>
      {items.map(({ inst, def }) => {
        const box = obbAabb(instanceObb(inst, def));
        const pxW = (box.maxX - box.minX) * vp.scale;
        const pxH = (box.maxZ - box.minZ) * vp.scale;
        const isSel = inst.id === selectedId;
        if (!isSel && (pxW < 46 || pxH < 16)) return null;
        const c = worldToScreen(vp, { x: inst.position.x, z: inst.position.z });
        return (
          <text key={inst.id} x={c.x} y={c.y + 4} textAnchor="middle" className={`${styles.objLabel} ${isSel ? styles.objLabelSel : ''}`}>
            {inst.label}
          </text>
        );
      })}
    </g>
  );
}
