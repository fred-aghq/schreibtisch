import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { PerspectiveCamera } from 'three';
import { cameraPose, easeInOut, fitPose } from '../../geometry/camera';
import type { CameraPose, CameraPreset } from '../../geometry/camera';
import { lerp3 } from '../../geometry/vec3';
import { useStore } from '../../store/store';

interface OrbitLike {
  target: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void };
  update: () => void;
  addEventListener: (type: 'start' | 'change', fn: () => void) => void;
  removeEventListener: (type: 'start' | 'change', fn: () => void) => void;
}

/** Survives remounts (switching 2D ↔ 3D), so the 3D camera stays where you left it. */
let memory: CameraPose | null = null;
let handledSeq = 0;

const DURATION_MS = 450;

/** Applies camera presets / fit requests with a short eased transition. */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as OrbitLike | null;
  const anim = useRef<{ from: CameraPose; to: CameraPose; start: number } | null>(null);

  useEffect(() => {
    if (!controls) return;
    const current = (): CameraPose => ({
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
    });
    const setPose = (p: CameraPose) => {
      camera.position.set(p.position.x, p.position.y, p.position.z);
      controls.target.set(p.target.x, p.target.y, p.target.z);
      controls.update();
    };
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const go = (preset: CameraPreset | 'fit', animate: boolean) => {
      const layout = useStore.getState().history.present;
      const to = preset === 'fit' ? fitPose(current(), layout, camera.fov, camera.aspect) : cameraPose(preset, layout, camera.fov, camera.aspect);
      if (animate && !reduceMotion) anim.current = { from: current(), to, start: performance.now() };
      else setPose(to);
    };

    const pending = useStore.getState().cameraRequest;
    if (pending && pending.seq > handledSeq) {
      handledSeq = pending.seq;
      go(pending.preset, false);
    } else if (memory) {
      setPose(memory);
    } else {
      go('iso', false);
    }

    const unsubscribe = useStore.subscribe((s, prev) => {
      const req = s.cameraRequest;
      if (req && req !== prev.cameraRequest && req.seq > handledSeq) {
        handledSeq = req.seq;
        go(req.preset, true);
      }
    });
    const onStart = () => {
      // The user grabbed the camera: stop any transition and drop the preset highlight.
      anim.current = null;
      if (useStore.getState().activePreset) useStore.getState().setActivePreset(null);
    };
    const onChange = () => {
      memory = current();
    };
    controls.addEventListener('start', onStart);
    controls.addEventListener('change', onChange);
    return () => {
      unsubscribe();
      controls.removeEventListener('start', onStart);
      controls.removeEventListener('change', onChange);
      memory = current();
    };
  }, [camera, controls]);

  useFrame(() => {
    const a = anim.current;
    if (!a || !controls) return;
    const t = (performance.now() - a.start) / DURATION_MS;
    const k = easeInOut(t);
    const pos = lerp3(a.from.position, a.to.position, k);
    const tgt = lerp3(a.from.target, a.to.target, k);
    camera.position.set(pos.x, pos.y, pos.z);
    controls.target.set(tgt.x, tgt.y, tgt.z);
    controls.update();
    if (t >= 1) anim.current = null;
  });

  return null;
}
