import { useMemo } from 'react';
import { obbCorners } from '../../geometry/obb';
import { LISTENER_BODY } from '../../layout/listenerBody';
import { instanceObb, isBelowDesk, layoutAabb, listenerPlan, visibleItems } from '../../layout/scene';
import { analyzeTriangle } from '../../layout/triangle';
import type { Layout } from '../../model/types';
import s from './MiniPlan.module.css';

/** A small, static top-down preview of a layout (desk, objects, listener and speaker triangle). */
export function MiniPlan({ layout, height = 220 }: { layout: Layout; height?: number }) {
  const t = useMemo(() => analyzeTriangle(layout), [layout]);
  const b = layoutAabb(layout);
  const pad = 80;
  const viewBox = `${b.minX - pad} ${b.minZ - pad} ${b.maxX - b.minX + 2 * pad} ${b.maxZ - b.minZ + 2 * pad}`;
  const { width: W, depth: D, colour } = layout.desk;
  const head = listenerPlan(layout);
  const items = visibleItems(layout).filter(({ inst, def }) => !isBelowDesk(inst, def));
  return (
    <svg className={s.plan} viewBox={viewBox} style={{ height }} role="img" aria-label={`Preview: ${W} × ${D} mm desk`}>
      <rect x={-W / 2} y={-D} width={W} height={D} fill={colour} className={s.desk} vectorEffect="non-scaling-stroke" />
      {items.map(({ inst, def }) => (
        <polygon
          key={inst.id}
          points={obbCorners(instanceObb(inst, def))
            .map((c) => `${c.x},${c.z}`)
            .join(' ')}
          fill={def.colour}
          className={s.object}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {t && (
        <polygon
          className={s.triangle}
          points={[t.corners.left, t.corners.right, t.corners.listener].map((c) => `${c.x},${c.z}`).join(' ')}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <circle cx={head.x} cy={head.z} r={LISTENER_BODY.headRadius} className={s.head} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
