import { Line } from '@react-three/drei';
import { useMemo } from 'react';
import { objectEuler } from '../../geometry/transform';
import type { Vec2 } from '../../geometry/vec';
import { LISTENER_BODY } from '../../layout/listenerBody';
import { classifyAngle } from '../../layout/triangle';
import type { SpeakerReading, ToleranceClass, TriangleReading } from '../../layout/triangle';
import { fixGhosts } from '../../layout/triangleFixes';
import type { Layout } from '../../model/types';
import { useStore } from '../../store/store';
import type { SceneColours } from './colours';

type P3 = [number, number, number];

const ARC_MM = 140;
const ARC_STEPS = 24;

const toneColour = (c: ToleranceClass | null, colours: SceneColours) =>
  c === 'green' ? colours.ok : c === 'amber' ? colours.warn : c === 'red' ? colours.danger : colours.muted;

/** Points of an arc of radius r at `at`, from the direction of `a` to the direction of `b` (the short way). */
function arcPoints(at: Vec2, a: Vec2, b: Vec2, y: number, r: number): P3[] | null {
  const a0 = Math.atan2(a.z - at.z, a.x - at.x);
  const b0 = Math.atan2(b.z - at.z, b.x - at.x);
  let d = b0 - a0;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  if (!Number.isFinite(d)) return null;
  const pts: P3[] = [];
  for (let i = 0; i <= ARC_STEPS; i++) {
    const t = a0 + (d * i) / ARC_STEPS;
    pts.push([at.x + Math.cos(t) * r, y, at.z + Math.sin(t) * r]);
  }
  return pts;
}

function SpeakerRays({ s, t, colours, cls }: { s: SpeakerReading; t: TriangleReading; colours: SceneColours; cls: ToleranceClass | null }) {
  const y = t.earY;
  const from: P3 = [s.acoustic.x, y, s.acoustic.z];
  const reach = Math.max(s.distanceToListener, 1);
  const to: P3 = [s.acoustic.x + s.forward.x * reach, y, s.acoustic.z + s.forward.z * reach];
  return (
    <>
      <Line points={[from, [t.aim.x, y, t.aim.z]]} color={colours.muted} lineWidth={1.25} dashed dashSize={40} gapSize={30} />
      <Line points={[from, to]} color={toneColour(cls, colours)} lineWidth={2.5} />
      {/* A drop from the tweeter to the ear plane shows the height difference. */}
      {Math.abs(s.acoustic.y - y) > 1 && <Line points={[[s.acoustic.x, s.acoustic.y, s.acoustic.z], from]} color={colours.muted} lineWidth={1} dashed dashSize={15} gapSize={15} />}
    </>
  );
}

function Triangle({ t, layout, colours }: { t: TriangleReading; layout: Layout; colours: SceneColours }) {
  const y = t.earY;
  const { left: L, right: R, listener: P } = t.corners;
  const tol = layout.settings.tolerances;
  const p = (v: Vec2): P3 => [v.x, y, v.z];
  const toe = (s: SpeakerReading) => (s.toeInError === null ? null : classifyAngle(s.toeInError, tol));
  const arcs = t.angles
    ? ([
        [L, R, P, t.angles.left],
        [R, L, P, t.angles.right],
        [P, L, R, t.angles.listener],
      ] as const)
    : [];
  return (
    <group>
      <Line points={[p(L), p(R), p(P), p(L)]} color={colours.accent} lineWidth={2} />
      <SpeakerRays s={t.left} t={t} colours={colours} cls={toe(t.left)} />
      <SpeakerRays s={t.right} t={t} colours={colours} cls={toe(t.right)} />
      {arcs.map(([at, a, b, value], i) => {
        const pts = arcPoints(at, a, b, y, ARC_MM);
        return pts && <Line key={i} points={pts} color={toneColour(classifyAngle(value - 60, tol), colours)} lineWidth={2.5} />;
      })}
    </group>
  );
}

/** Translucent copies of what a hovered fix would move. */
function Ghosts({ layout, colours }: { layout: Layout; colours: SceneColours }) {
  const fix = useStore((s) => s.fixPreview);
  const mode = useStore((s) => s.speakerFitMode);
  const g = useMemo(() => (fix ? fixGhosts(layout, fix, mode) : null), [layout, fix, mode]);
  if (!g) return null;
  const r = g.reading;
  const mat = <meshBasicMaterial color={colours.accent} transparent opacity={0.28} depthWrite={false} />;
  return (
    <group raycast={() => null}>
      {r && (
        <Line
          points={[r.corners.left, r.corners.right, r.corners.listener, r.corners.left].map((v): P3 => [v.x, r.earY, v.z])}
          color={colours.accent}
          lineWidth={1.5}
          dashed
          dashSize={40}
          gapSize={30}
        />
      )}
      {g.speakers.map(({ inst, def }) => {
        const e = objectEuler(inst.rotation.yaw, inst.rotation.pitch);
        return (
          <group key={inst.id} position={[inst.position.x, inst.position.y, inst.position.z]} rotation={[e.x, e.y, e.z, e.order]}>
            <mesh position={[0, def.size.h / 2, 0]} raycast={() => null}>
              <boxGeometry args={[def.size.w, def.size.h, def.size.d]} />
              {mat}
            </mesh>
          </group>
        );
      })}
      {g.listener && (
        <mesh position={[g.listener.x, g.listener.y, g.listener.z]} raycast={() => null}>
          <sphereGeometry args={[LISTENER_BODY.headRadius, 24, 16]} />
          {mat}
        </mesh>
      )}
    </group>
  );
}

/** The speaker triangle in 3D, on a horizontal plane at ear height. */
export function TriangleOverlay3D({ t, layout, colours }: { t: TriangleReading | null; layout: Layout; colours: SceneColours }) {
  return (
    <group raycast={() => null}>
      {t && <Triangle t={t} layout={layout} colours={colours} />}
      <Ghosts layout={layout} colours={colours} />
    </group>
  );
}
