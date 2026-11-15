import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Raycaster, Vector2 } from 'three';
import { CAMERA_PRESETS, PRESET_LABELS } from '../../geometry/camera';
import { findOverlaps } from '../../geometry/overlap';
import { horizontalPlane, intersectRayPlane } from '../../geometry/ray';
import { setSettings } from '../../store/ops';
import { useLayout, useStore } from '../../store/store';
import { CameraRig } from './CameraRig';
import { LabelLayer, LabelProjector } from './labels';
import { deskLabels } from './sceneLabels';
import { SCENE_COLOURS } from './colours';
import { useDragController } from './dragController';
import { BackWall, Desk, DeskGrid, Floor, Listener3D, ObjectMesh } from './meshes';
import styles from './SceneView.module.css';

export default function SceneView() {
  const activePreset = useStore((s) => s.activePreset);
  const requestCamera = useStore((s) => s.requestCamera);
  const apply = useStore((s) => s.apply);
  const layout = useLayout();
  const showFloor = layout.settings.showFloor;
  const labelLayer = useRef<HTMLDivElement>(null);
  const labels = useMemo(() => deskLabels(layout), [layout]);

  return (
    <div className={styles.container}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        camera={{ fov: 45, near: 5, far: 100000, position: [1800, 1600, 2200] }}
        onPointerMissed={(e) => {
          if (e.button === 0) useStore.getState().select(null);
        }}
      >
        <SceneContent />
        <LabelProjector layerRef={labelLayer} />
      </Canvas>
      <LabelLayer labels={labels} layerRef={labelLayer} className={styles.dimLabel ?? ''} />

      <div className={styles.toolbar} role="toolbar" aria-label="Camera">
        {CAMERA_PRESETS.map((p, i) => (
          <button key={p} type="button" className={activePreset === p ? styles.on : ''} onClick={() => requestCamera(p)} title={`${PRESET_LABELS[p]} view (${i + 1})`}>
            {PRESET_LABELS[p]}
            <span className={styles.key}>{i + 1}</span>
          </button>
        ))}
        <span className={styles.sep} />
        <button type="button" onClick={() => requestCamera('fit')} title="Frame everything (F)">
          Fit
        </button>
        <label className={styles.toggle}>
          <input type="checkbox" checked={showFloor} onChange={(e) => {
            const v = e.currentTarget.checked;
            apply((l) => setSettings(l, { showFloor: v }));
          }} />
          Floor
        </label>
      </div>
      <div className={styles.hint}>
        Drag empty space to orbit · right-drag to pan · scroll to zoom · drag objects to move · <b>Shift</b>+drag to raise or lower
      </div>
    </div>
  );
}

function SceneContent() {
  const layout = useLayout();
  const selection = useStore((s) => s.selection);
  const theme = useStore((s) => s.theme);
  const colours = SCENE_COLOURS[theme];
  const startDrag = useDragController();
  const selectedId = selection?.kind === 'instance' ? selection.id : null;
  const overlaps = useMemo(() => findOverlaps(layout), [layout]);
  const shadowExtent = useMemo(() => Math.max(layout.desk.width, layout.desk.depth) + 1500, [layout.desk.width, layout.desk.depth]);

  return (
    <>
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} zoomToCursor minDistance={50} maxDistance={30000} />
      <CameraRig />
      <CursorTracker />
      <hemisphereLight args={['#ffffff', '#555a63', 0.9]} />
      <directionalLight
        position={[1500, 3200, 2200]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
        shadow-camera-near={100}
        shadow-camera-far={12000}
      />
      <Desk layout={layout} colours={colours} />
      {layout.settings.showGrid && <DeskGrid layout={layout} colours={colours} />}
      {layout.settings.showFloor && <Floor layout={layout} colours={colours} />}
      <BackWall layout={layout} colours={colours} />
      {layout.instances.map((inst) => {
        const def = layout.definitions[inst.definitionId];
        if (!def || !inst.visible) return null;
        return <ObjectMesh key={inst.id} inst={inst} def={def} selected={inst.id === selectedId} overlapping={overlaps.has(inst.id)} colours={colours} startDrag={startDrag} />;
      })}
      <Listener3D layout={layout} selected={selection?.kind === 'listener'} colours={colours} startDrag={startDrag} />
    </>
  );
}

/** Reports the desk-plane position under the cursor to the status bar. */
function CursorTracker() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const { origin, direction } = raycaster.ray;
      const hit = intersectRayPlane({ origin, direction }, horizontalPlane({ x: 0, y: 0, z: 0 }));
      useStore.getState().setCursor(hit ? { x: hit.x, z: hit.z } : null);
    };
    const onLeave = () => useStore.getState().setCursor(null);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [camera, gl]);
  return null;
}
