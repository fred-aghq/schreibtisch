import { Edges } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from 'three';
import type { Group } from 'three';
import { deskGridLines } from '../../layout/grid';
import { LISTENER_BODY, listenerFigure } from '../../layout/listenerBody';
import type { BodyBox } from '../../layout/listenerBody';
import type { Vec3 } from '../../geometry/vec';
import { floorY, listenerHead } from '../../layout/scene';
import { objectEuler } from '../../geometry/transform';
import type { Layout, ObjectDefinition, ObjectInstance } from '../../model/types';
import type { SceneColours as Colours } from './colours';
import type { DragTarget } from '../../layout/drag';

type StartDrag = (e: ThreeEvent<PointerEvent>, target: DragTarget) => void;

const xyz = (v: Vec3): [number, number, number] => [v.x, v.y, v.z];
const whd = (b: BodyBox): [number, number, number] => [b.size.w, b.size.h, b.size.d];

const setCursor = (e: ThreeEvent<PointerEvent>, cursor: string) => {
  const el = e.nativeEvent.target;
  if (el instanceof HTMLElement) el.style.cursor = cursor;
};

export function Desk({ layout, colours }: { layout: Layout; colours: Colours }) {
  const { width: W, depth: D, thickness: T, heightFromFloor: H, colour } = layout.desk;
  const legH = Math.max(H - T, 1);
  const leg = 50;
  const inset = 40;
  const legXs = [-W / 2 + inset + leg / 2, W / 2 - inset - leg / 2];
  const legZs = [-D + inset + leg / 2, -inset - leg / 2];
  return (
    <group>
      <mesh position={[0, -T / 2, -D / 2]} receiveShadow castShadow>
        <boxGeometry args={[W, T, D]} />
        <meshStandardMaterial color={colour} roughness={0.75} />
      </mesh>
      {legXs.flatMap((x) =>
        legZs.map((z) => (
          <mesh key={`${x}:${z}`} position={[x, -T - legH / 2, z]} castShadow>
            <boxGeometry args={[leg, legH, leg]} />
            <meshStandardMaterial color={colours.legs} roughness={0.6} metalness={0.3} />
          </mesh>
        )),
      )}
    </group>
  );
}

/** The 3D grid has no zoom level to adapt to, so it just never gets finer than this. */
const MIN_GRID_MM = 5;

export function DeskGrid({ layout, colours }: { layout: Layout; colours: Colours }) {
  const { width: W, depth: D } = layout.desk;
  const spacing = layout.settings.gridSpacing;
  const geometry = useMemo(() => {
    const y = 0.5;
    const pts = deskGridLines({ width: W, depth: D }, spacing, MIN_GRID_MM).flatMap((l) => [l.a.x, y, l.a.z, l.b.x, y, l.b.z]);
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pts, 3));
    return g;
  }, [W, D, spacing]);
  const centre = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute([0, 0.6, -D, 0, 0.6, 0], 3));
    return g;
  }, [D]);
  return (
    <group>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color="#000000" transparent opacity={0.13} />
      </lineSegments>
      <lineSegments geometry={centre}>
        <lineBasicMaterial color={colours.accent} transparent opacity={0.6} />
      </lineSegments>
    </group>
  );
}

export function Floor({ layout, colours }: { layout: Layout; colours: Colours }) {
  const y = floorY(layout);
  return (
    <group position={[0, y, -layout.desk.depth / 2]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[8000, 8000]} />
        <meshStandardMaterial color={colours.floor} roughness={1} />
      </mesh>
      <gridHelper args={[8000, 16, colours.floorGridMajor, colours.floorGrid]} position={[0, 0.5, 0]} />
    </group>
  );
}

export function BackWall({ layout, colours }: { layout: Layout; colours: Colours }) {
  if (!layout.backWall) return null;
  const z = -layout.desk.depth - layout.backWall.distanceBehindDesk;
  const h = 2600;
  const y = floorY(layout) + h / 2;
  return (
    <mesh position={[0, y, z]}>
      <planeGeometry args={[Math.max(layout.desk.width + 1600, 3000), h]} />
      <meshStandardMaterial color={colours.wall} side={DoubleSide} transparent opacity={0.55} roughness={1} />
    </mesh>
  );
}

export function ObjectMesh({
  inst,
  def,
  selected,
  overlapping,
  colours,
  startDrag,
}: {
  inst: ObjectInstance;
  def: ObjectDefinition;
  selected: boolean;
  overlapping: boolean;
  colours: Colours;
  startDrag: StartDrag;
}) {
  const { w, d, h } = def.size;
  const e = objectEuler(inst.rotation.yaw, inst.rotation.pitch);
  return (
    <group position={[inst.position.x, inst.position.y, inst.position.z]} rotation={[e.x, e.y, e.z, e.order]}>
      <mesh
        position={[0, h / 2, 0]}
        scale={def.shape === 'cylinder' ? [w, h, d] : [1, 1, 1]}
        castShadow
        receiveShadow
        onPointerDown={(ev) => startDrag(ev, { kind: 'object', id: inst.id })}
        onPointerOver={(ev) => {
          ev.stopPropagation();
          setCursor(ev, inst.locked ? 'pointer' : 'move');
        }}
        onPointerOut={(ev) => setCursor(ev, '')}
      >
        {def.shape === 'cylinder' ? <cylinderGeometry args={[0.5, 0.5, 1, 40]} /> : <boxGeometry args={[w, h, d]} />}
        <meshStandardMaterial color={def.colour} roughness={0.55} emissive={selected ? colours.accent : '#000000'} emissiveIntensity={selected ? 0.18 : 0} />
        {(selected || overlapping) && <Edges color={selected ? colours.accent : colours.danger} threshold={20} />}
      </mesh>
      <FrontDetail def={def} colours={colours} />
      <MonitorStand def={def} elevation={inst.position.y} colours={colours} />
    </group>
  );
}

/** A simple stand (base plate + neck) under a monitor whose support is 'stand'. Purely cosmetic. */
function MonitorStand({ def, elevation, colours }: { def: ObjectDefinition; elevation: number; colours: Colours }) {
  const stand = def.monitor?.support === 'stand' ? def.monitor.stand : undefined;
  // The stand reaches down to the desk top (world y = 0, i.e. −elevation locally).
  if (!stand || elevation <= 0) return null;
  const drop = elevation;
  const plate = 12;
  const neckH = Math.max(drop - plate + def.size.h * 0.3, 1);
  return (
    <group raycast={() => null}>
      <mesh position={[0, -drop + plate / 2, 0]} castShadow receiveShadow raycast={() => null}>
        <boxGeometry args={[stand.w, plate, stand.d]} />
        <meshStandardMaterial color={colours.legs} roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, -drop + plate + neckH / 2, -def.size.d / 2 - 15]} castShadow raycast={() => null}>
        <boxGeometry args={[60, neckH, 25]} />
        <meshStandardMaterial color={colours.legs} roughness={0.5} metalness={0.3} />
      </mesh>
    </group>
  );
}

/** Cosmetic front-face details so orientation is obvious: a screen for monitors, drivers for speakers. */
function FrontDetail({ def, colours }: { def: ObjectDefinition; colours: Colours }) {
  const { w, d, h } = def.size;
  const z = d / 2 + 0.6;
  if (def.shape !== 'box') return null;
  if (def.category === 'monitor') {
    const bezel = Math.min(def.monitor?.bezelMm ?? 8, w / 4, h / 4);
    return (
      <mesh position={[0, h / 2, z]} raycast={() => null}>
        <planeGeometry args={[w - 2 * bezel, h - 2 * bezel]} />
        <meshStandardMaterial color={colours.screen} roughness={0.25} metalness={0.1} />
      </mesh>
    );
  }
  if (def.category === 'speaker') {
    const ac = Math.min(Math.max(def.speaker?.acousticCentreHeight ?? h * 0.8, 0), h);
    const tweeterR = Math.min(w * 0.12, 16);
    const wooferR = Math.min(w * 0.38, (ac - tweeterR - 30) / 2);
    const wooferY = ac - tweeterR - 20 - wooferR;
    return (
      <group position={[0, 0, z]}>
        <mesh position={[0, ac, 0]} raycast={() => null}>
          <circleGeometry args={[tweeterR, 32]} />
          <meshStandardMaterial color={colours.driver} roughness={0.4} />
        </mesh>
        {wooferR > 10 && wooferY - wooferR > 0 && (
          <mesh position={[0, wooferY, 0]} raycast={() => null}>
            <circleGeometry args={[wooferR, 48]} />
            <meshStandardMaterial color={colours.driver} roughness={0.6} />
          </mesh>
        )}
      </group>
    );
  }
  return null;
}

export function Listener3D({ layout, selected, colours, startDrag }: { layout: Layout; selected: boolean; colours: Colours; startDrag: StartDrag }) {
  const { head, torso, seat, backrest, pedestal } = listenerFigure(listenerHead(layout), floorY(layout));
  const headR = LISTENER_BODY.headRadius;
  const headRef = useRef<Group>(null);
  const camera = useThree((s) => s.camera);

  // Hide the head when the camera is inside it (Seated view).
  useFrame(() => {
    const g = headRef.current;
    if (!g) return;
    const dx = camera.position.x - head.x;
    const dy = camera.position.y - head.y;
    const dz = camera.position.z - head.z;
    g.visible = Math.hypot(dx, dy, dz) > headR * 2.5;
  });

  const mat = (opacity: number) => (
    <meshStandardMaterial
      color={colours.listener}
      roughness={0.8}
      transparent={opacity < 1}
      opacity={opacity}
      depthWrite={opacity >= 1}
      emissive={selected ? colours.accent : '#000000'}
      emissiveIntensity={selected ? 0.25 : 0}
    />
  );
  const onDown = (ev: ThreeEvent<PointerEvent>) => startDrag(ev, { kind: 'listener' });
  const over = (ev: ThreeEvent<PointerEvent>) => {
    ev.stopPropagation();
    setCursor(ev, 'move');
  };
  const out = (ev: ThreeEvent<PointerEvent>) => setCursor(ev, '');

  return (
    <group>
      <group ref={headRef} position={[head.x, head.y, head.z]}>
        <mesh castShadow onPointerDown={onDown} onPointerOver={over} onPointerOut={out}>
          <sphereGeometry args={[headR, 32, 20]} />
          {mat(1)}
        </mesh>
        <mesh position={[0, -10, -headR]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <coneGeometry args={[18, 40, 16]} />
          {mat(1)}
        </mesh>
      </group>
      {/* Torso */}
      <mesh position={xyz(torso.center)} castShadow onPointerDown={onDown} onPointerOver={over} onPointerOut={out}>
        <boxGeometry args={whd(torso)} />
        {mat(0.35)}
      </mesh>
      {/* Chair seat and back */}
      <mesh position={xyz(seat.center)} castShadow raycast={() => null}>
        <boxGeometry args={whd(seat)} />
        <meshStandardMaterial color={colours.legs} roughness={0.9} transparent opacity={0.45} depthWrite={false} />
      </mesh>
      <mesh position={xyz(backrest.center)} castShadow raycast={() => null}>
        <boxGeometry args={whd(backrest)} />
        <meshStandardMaterial color={colours.legs} roughness={0.9} transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <mesh position={xyz(pedestal.center)} raycast={() => null}>
        <cylinderGeometry args={[LISTENER_BODY.pedestalRadius, LISTENER_BODY.pedestalRadius, pedestal.height, 12]} />
        <meshStandardMaterial color={colours.legs} roughness={0.5} metalness={0.4} />
      </mesh>
    </group>
  );
}
