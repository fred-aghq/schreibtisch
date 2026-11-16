import { useMemo } from 'react';
import { obbCorners } from '../../geometry/obb';
import { worldToScreen } from '../../geometry/viewport';
import type { ScreenPoint, Viewport } from '../../geometry/viewport';
import type { Vec2 } from '../../geometry/vec';
import { LISTENER_BODY } from '../../layout/listenerBody';
import { instanceObb } from '../../layout/scene';
import { analyzeTriangle, classifyAngle } from '../../layout/triangle';
import type { SpeakerReading, ToleranceClass, TriangleReading } from '../../layout/triangle';
import { fixGhosts } from '../../layout/triangleFixes';
import type { Layout } from '../../model/types';
import { useStore } from '../../store/store';
import styles from './TriangleOverlay.module.css';

const ARC_PX = 26;
const ARC_LABEL_PX = 46;
const SIDE_LABEL_PX = 14;

const tone = (c: ToleranceClass | null) => (c ? styles[c] : '');

function unit(a: ScreenPoint, b: ScreenPoint): ScreenPoint | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy);
  return l < 1e-9 ? null : { x: dx / l, y: dy / l };
}

/** The interior-angle arc at `at` between the edges toward `a` and `b`, with its label. */
function AngleArc({ at, a, b, value, cls }: { at: ScreenPoint; a: ScreenPoint; b: ScreenPoint; value: number; cls: ToleranceClass }) {
  const ua = unit(at, a);
  const ub = unit(at, b);
  if (!ua || !ub) return null;
  const p1 = { x: at.x + ua.x * ARC_PX, y: at.y + ua.y * ARC_PX };
  const p2 = { x: at.x + ub.x * ARC_PX, y: at.y + ub.y * ARC_PX };
  // Sweep the short way round: in screen space (y down) a positive cross product is clockwise.
  const sweep = ua.x * ub.y - ua.y * ub.x > 0 ? 1 : 0;
  const bis = unit({ x: 0, y: 0 }, { x: ua.x + ub.x, y: ua.y + ub.y }) ?? ua;
  return (
    <g className={tone(cls)}>
      <path className={styles.arc} d={`M ${p1.x} ${p1.y} A ${ARC_PX} ${ARC_PX} 0 0 ${sweep} ${p2.x} ${p2.y}`} />
      <text className={`${styles.label} num`} x={at.x + bis.x * ARC_LABEL_PX} y={at.y + bis.y * ARC_LABEL_PX + 4} textAnchor="middle">
        {value.toFixed(1)}°
      </text>
    </g>
  );
}

/** A side of the triangle with its length written beside the middle, on the outside. */
function Side({ a, b, centroid, mm }: { a: ScreenPoint; b: ScreenPoint; centroid: ScreenPoint; mm: number }) {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const out = unit(centroid, mid);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  return (
    <g>
      <line className={styles.edge} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      {out && len > 70 && (
        <text className={`${styles.label} ${styles.side} num`} x={mid.x + out.x * SIDE_LABEL_PX} y={mid.y + out.y * SIDE_LABEL_PX + 4} textAnchor="middle">
          {Math.round(mm)} mm
        </text>
      )}
    </g>
  );
}

/** Where a speaker points (solid, coloured by toe-in) and where it should point (dashed). */
function Rays({ s, aim, vp, cls }: { s: SpeakerReading; aim: Vec2; vp: Viewport; cls: ToleranceClass | null }) {
  const from = worldToScreen(vp, s.acoustic);
  const reach = Math.max(s.distanceToListener, 1);
  const to = worldToScreen(vp, { x: s.acoustic.x + s.forward.x * reach, z: s.acoustic.z + s.forward.z * reach });
  const ideal = worldToScreen(vp, aim);
  return (
    <g>
      <line className={styles.idealRay} x1={from.x} y1={from.y} x2={ideal.x} y2={ideal.y} />
      <line className={`${styles.ray} ${tone(cls)}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
      <circle className={`${styles.dot} ${tone(cls)}`} cx={from.x} cy={from.y} r={3.5} />
    </g>
  );
}

function TriangleShape({ t, vp, layout, ghost }: { t: TriangleReading; vp: Viewport; layout: Layout; ghost?: boolean }) {
  const L = worldToScreen(vp, t.corners.left);
  const R = worldToScreen(vp, t.corners.right);
  const P = worldToScreen(vp, t.corners.listener);
  if (ghost) {
    return <polygon className={styles.ghostTriangle} points={`${L.x},${L.y} ${R.x},${R.y} ${P.x},${P.y}`} />;
  }
  const tol = layout.settings.tolerances;
  const centroid = { x: (L.x + R.x + P.x) / 3, y: (L.y + R.y + P.y) / 3 };
  const angleCls = (a: number) => classifyAngle(a - 60, tol);
  const toe = (s: SpeakerReading) => (s.toeInError === null ? null : classifyAngle(s.toeInError, tol));
  return (
    <g>
      <Side a={L} b={R} centroid={centroid} mm={t.sides.lr} />
      <Side a={L} b={P} centroid={centroid} mm={t.sides.leftListener} />
      <Side a={R} b={P} centroid={centroid} mm={t.sides.rightListener} />
      <Rays s={t.left} aim={t.aim} vp={vp} cls={toe(t.left)} />
      <Rays s={t.right} aim={t.aim} vp={vp} cls={toe(t.right)} />
      {t.angles && (
        <>
          <AngleArc at={L} a={R} b={P} value={t.angles.left} cls={angleCls(t.angles.left)} />
          <AngleArc at={R} a={L} b={P} value={t.angles.right} cls={angleCls(t.angles.right)} />
          <AngleArc at={P} a={L} b={R} value={t.angles.listener} cls={angleCls(t.angles.listener)} />
        </>
      )}
      {layout.settings.aimOffset !== 0 && <AimMark at={worldToScreen(vp, t.aim)} />}
    </g>
  );
}

function AimMark({ at }: { at: ScreenPoint }) {
  return (
    <g className={styles.aim}>
      <line x1={at.x - 5} y1={at.y - 5} x2={at.x + 5} y2={at.y + 5} />
      <line x1={at.x - 5} y1={at.y + 5} x2={at.x + 5} y2={at.y - 5} />
    </g>
  );
}

/** Dashed outlines showing where a hovered fix would put things. */
function Ghosts({ layout, vp }: { layout: Layout; vp: Viewport }) {
  const fix = useStore((s) => s.fixPreview);
  const mode = useStore((s) => s.speakerFitMode);
  const g = useMemo(() => (fix ? fixGhosts(layout, fix, mode) : null), [layout, fix, mode]);
  if (!g) return null;
  const r = LISTENER_BODY.headRadius * vp.scale;
  const head = g.listener ? worldToScreen(vp, g.listener) : null;
  return (
    <g className={styles.ghost}>
      {g.reading && <TriangleShape t={g.reading} vp={vp} layout={layout} ghost />}
      {g.speakers.map(({ inst, def }) => {
        const pts = obbCorners(instanceObb(inst, def)).map((c) => worldToScreen(vp, c));
        const [, , fr, fl] = pts;
        return (
          <g key={inst.id}>
            <polygon points={pts.map((p) => `${p.x},${p.y}`).join(' ')} />
            {fr && fl && <line className={styles.ghostFront} x1={fl.x} y1={fl.y} x2={fr.x} y2={fr.y} />}
          </g>
        );
      })}
      {head && <circle cx={head.x} cy={head.y} r={r} />}
    </g>
  );
}

/** The speaker-triangle overlay for the plan view, drawn in screen space. */
export function TriangleOverlay({ layout, vp }: { layout: Layout; vp: Viewport }) {
  const t = useMemo(() => analyzeTriangle(layout), [layout]);
  return (
    <g pointerEvents="none" className={styles.overlay}>
      {t && <TriangleShape t={t} vp={vp} layout={layout} />}
      <Ghosts layout={layout} vp={vp} />
    </g>
  );
}
