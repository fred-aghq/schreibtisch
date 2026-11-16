import { worldToScreen } from '../../geometry/viewport';
import type { Viewport } from '../../geometry/viewport';
import type { SnapLine } from '../../layout/snap';
import styles from './PlanView.module.css';

export interface ActiveSnap {
  lineX: SnapLine | null;
  lineZ: SnapLine | null;
}

/** The lines the dragged object is currently snapped to. */
export function SnapGuides({ vp, snap }: { vp: Viewport; snap: ActiveSnap }) {
  const lines: { key: string; a: { x: number; y: number }; b: { x: number; y: number } }[] = [];
  const pad = 60;
  if (snap.lineX) {
    const [z0, z1] = snap.lineX.span;
    lines.push({ key: 'x', a: worldToScreen(vp, { x: snap.lineX.value, z: z0 - pad }), b: worldToScreen(vp, { x: snap.lineX.value, z: z1 + pad }) });
  }
  if (snap.lineZ) {
    const [x0, x1] = snap.lineZ.span;
    lines.push({ key: 'z', a: worldToScreen(vp, { x: x0 - pad, z: snap.lineZ.value }), b: worldToScreen(vp, { x: x1 + pad, z: snap.lineZ.value }) });
  }
  return (
    <g pointerEvents="none">
      {lines.map((l) => (
        <line key={l.key} className={styles.snapLine} x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} />
      ))}
    </g>
  );
}
