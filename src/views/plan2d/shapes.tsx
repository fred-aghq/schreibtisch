import type { PointerEvent as ReactPointerEvent } from 'react';
import { deskGridLines } from '../../layout/grid';
import { LISTENER_BODY } from '../../layout/listenerBody';
import { listenerPlan } from '../../layout/scene';
import type { Layout } from '../../model/types';
import styles from './PlanView.module.css';

export function DeskShape({ layout }: { layout: Layout }) {
  const { width, depth, colour } = layout.desk;
  return (
    <g pointerEvents="none">
      <rect className={styles.desk} x={-width / 2} y={-depth} width={width} height={depth} fill={colour} vectorEffect="non-scaling-stroke" />
      {/* Front edge is the origin line. */}
      <line className={styles.deskFront} x1={-width / 2} x2={width / 2} y1={0} y2={0} vectorEffect="non-scaling-stroke" />
    </g>
  );
}

/** Keep at least this many screen pixels between grid lines when zoomed out. */
const MIN_GRID_PX = 6;

export function GridLines({ layout, scale }: { layout: Layout; scale: number }) {
  const { depth } = layout.desk;
  const lines = deskGridLines(layout.desk, layout.settings.gridSpacing, MIN_GRID_PX / scale);
  return (
    <g pointerEvents="none">
      {lines.map((l, i) => (
        <line key={i} x1={l.a.x} y1={l.a.z} x2={l.b.x} y2={l.b.z} className={l.major ? styles.gridMajor : styles.grid} vectorEffect="non-scaling-stroke" />
      ))}
      <line className={styles.centreline} x1={0} x2={0} y1={-depth} y2={0} vectorEffect="non-scaling-stroke" />
    </g>
  );
}

export function ListenerShape({
  layout,
  selected,
  onPointerDown,
}: {
  layout: Layout;
  selected: boolean;
  onPointerDown: (e: ReactPointerEvent) => void;
}) {
  const p = listenerPlan(layout);
  const { headRadius: r, chairWidth, chairPlanDepth } = LISTENER_BODY;
  return (
    <g
      className={`${styles.listener} ${selected ? styles.listenerSelected : ''}`}
      transform={`translate(${p.x} ${p.z})`}
      onPointerDown={onPointerDown}
    >
      {/* Chair: seat behind the head, with armrests. */}
      <rect className={styles.chair} x={-chairWidth / 2} y={-r * 0.6} width={chairWidth} height={chairPlanDepth} rx={60} vectorEffect="non-scaling-stroke" />
      <rect className={styles.chair} x={-chairWidth / 2 + 70} y={chairPlanDepth * 0.45} width={chairWidth - 140} height={chairPlanDepth * 0.3} rx={30} vectorEffect="non-scaling-stroke" />
      {/* Head, with a nose pointing at the desk (−Z). */}
      <circle className={styles.head} r={r} vectorEffect="non-scaling-stroke" />
      <path className={styles.head} d={`M ${-r * 0.3} ${-r * 0.92} L 0 ${-r * 1.3} L ${r * 0.3} ${-r * 0.92} Z`} vectorEffect="non-scaling-stroke" />
      <circle className={styles.ear} r={r * 0.12} vectorEffect="non-scaling-stroke" />
    </g>
  );
}
