import { obbAabb } from '../../geometry/obb';
import { worldToScreen } from '../../geometry/viewport';
import type { Viewport } from '../../geometry/viewport';
import { dimensionGuides } from '../../layout/guides';
import { instanceObb } from '../../layout/scene';
import type { Layout } from '../../model/types';
import styles from './PlanView.module.css';

/** Live distances from the dragged object to the nearest desk edges and the centreline. */
export function DimensionGuides({ layout, vp, id }: { layout: Layout; vp: Viewport; id: string }) {
  const inst = layout.instances.find((i) => i.id === id);
  const def = inst ? layout.definitions[inst.definitionId] : undefined;
  if (!inst || !def) return null;
  const guides = dimensionGuides(obbAabb(instanceObb(inst, def)), layout.desk.width, layout.desk.depth);
  return (
    <g pointerEvents="none" className={styles.dims}>
      {guides.map((g) => {
        const a = worldToScreen(vp, g.a);
        const b = worldToScreen(vp, g.b);
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len < 4) return null;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const horizontal = Math.abs(b.x - a.x) > Math.abs(b.y - a.y);
        const tick = 5;
        const text = `${Math.round(Math.abs(g.value))}`;
        const tw = text.length * 6.6 + 10;
        return (
          <g key={g.id} className={g.id === 'centre' ? styles.dimCentre : g.value < 0 ? styles.dimNegative : ''}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            {horizontal ? (
              <>
                <line x1={a.x} y1={a.y - tick} x2={a.x} y2={a.y + tick} />
                <line x1={b.x} y1={b.y - tick} x2={b.x} y2={b.y + tick} />
              </>
            ) : (
              <>
                <line x1={a.x - tick} y1={a.y} x2={a.x + tick} y2={a.y} />
                <line x1={b.x - tick} y1={b.y} x2={b.x + tick} y2={b.y} />
              </>
            )}
            {len > 24 && (
              <>
                <rect x={mx - tw / 2} y={my - 9} width={tw} height={18} rx={9} />
                <text x={mx} y={my + 4} textAnchor="middle" className="num">
                  {g.value < 0 && g.id !== 'centre' ? '−' : ''}
                  {text}
                </text>
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}
