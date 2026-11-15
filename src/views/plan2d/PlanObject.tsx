import type { PointerEvent as ReactPointerEvent } from 'react';
import type { ObjectDefinition, ObjectInstance } from '../../model/types';
import styles from './PlanView.module.css';

export interface PlanItem {
  inst: ObjectInstance;
  def: ObjectDefinition;
  /** Entirely below the desk top (drawn under the desk, dimmed). */
  below: boolean;
}

/** One object's footprint, in world units inside the viewport transform. */
export function PlanObject({
  inst,
  def,
  below,
  selected,
  overlapping,
  onPointerDown,
}: PlanItem & { selected: boolean; overlapping: boolean; onPointerDown: (e: ReactPointerEvent, id: string) => void }) {
  const { w, d } = def.size;
  const stand = def.monitor?.support === 'stand' ? def.monitor.stand : undefined;
  const className = [styles.object, below ? styles.below : '', overlapping ? styles.overlap : '', selected ? styles.selected : '', inst.locked ? styles.locked : '']
    .filter(Boolean)
    .join(' ');
  return (
    <g
      className={className}
      transform={`translate(${inst.position.x} ${inst.position.z}) rotate(${-inst.rotation.yaw})`}
      onPointerDown={(e) => onPointerDown(e, inst.id)}
    >
      {stand && <rect className={styles.stand} x={-stand.w / 2} y={-stand.d / 2} width={stand.w} height={stand.d} rx={12} vectorEffect="non-scaling-stroke" />}
      {def.shape === 'cylinder' ? (
        <ellipse rx={w / 2} ry={d / 2} fill={def.colour} vectorEffect="non-scaling-stroke" />
      ) : (
        <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={Math.min(w, d) * 0.04} fill={def.colour} vectorEffect="non-scaling-stroke" />
      )}
      {/* Front edge marker (local +Z faces the user at yaw 0). */}
      <line className={styles.front} x1={-w / 2 + Math.min(w * 0.1, 20)} x2={w / 2 - Math.min(w * 0.1, 20)} y1={d / 2} y2={d / 2} vectorEffect="non-scaling-stroke" />
    </g>
  );
}
