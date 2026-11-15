import type { PointerEvent as ReactPointerEvent } from 'react';
import { CHAIR, listenerPlan } from '../../layout/scene';
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

export function GridLines({ layout, scale }: { layout: Layout; scale: number }) {
  const { width, depth } = layout.desk;
  let spacing = layout.settings.gridSpacing;
  // Keep at least ~6 px between lines when zoomed out.
  while (spacing * scale < 6) spacing *= 2;
  const lines: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = [];
  const half = width / 2;
  for (let x = Math.ceil(-half / spacing) * spacing; x <= half; x += spacing) {
    if (Math.abs(x) < 1e-6 || Math.abs(Math.abs(x) - half) < 1e-6) continue;
    lines.push({ x1: x, y1: -depth, x2: x, y2: 0, major: Math.round(x) % (spacing * 5) === 0 });
  }
  for (let z = -spacing; z > -depth; z -= spacing) {
    lines.push({ x1: -half, y1: z, x2: half, y2: z, major: Math.round(z) % (spacing * 5) === 0 });
  }
  return (
    <g pointerEvents="none">
      {lines.map((l, i) => (
        <line key={i} {...l} className={l.major ? styles.gridMajor : styles.grid} vectorEffect="non-scaling-stroke" />
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
  const r = CHAIR.headRadius;
  return (
    <g
      className={`${styles.listener} ${selected ? styles.listenerSelected : ''}`}
      transform={`translate(${p.x} ${p.z})`}
      onPointerDown={onPointerDown}
    >
      {/* Chair: seat behind the head, with armrests. */}
      <rect className={styles.chair} x={-CHAIR.width / 2} y={-r * 0.6} width={CHAIR.width} height={CHAIR.depth} rx={60} vectorEffect="non-scaling-stroke" />
      <rect className={styles.chair} x={-CHAIR.width / 2 + 70} y={CHAIR.depth * 0.45} width={CHAIR.width - 140} height={CHAIR.depth * 0.3} rx={30} vectorEffect="non-scaling-stroke" />
      {/* Head, with a nose pointing at the desk (−Z). */}
      <circle className={styles.head} r={r} vectorEffect="non-scaling-stroke" />
      <path className={styles.head} d={`M ${-r * 0.3} ${-r * 0.92} L 0 ${-r * 1.3} L ${r * 0.3} ${-r * 0.92} Z`} vectorEffect="non-scaling-stroke" />
      <circle className={styles.ear} r={r * 0.12} vectorEffect="non-scaling-stroke" />
    </g>
  );
}
