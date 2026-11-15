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
  addEventListener: (type: 'start' | 'end', fn: () => void) => void;
  removeEventListener: (type: 'start' | 'end', fn: () => void) => void;
}

const DURATION_MS = 450;

/**
 * Applies camera presets / fit requests with a short eased transition. The pose is saved to the
 * store (not every frame: when a user gesture or a transition ends, and on unmount), so the 3D
 * camera stays where you left it when switching 2D ↔ 3D.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as OrbitLike | null;
  const anim = useRef<{ from: CameraPose; to: CameraPose; start: number } | null>(null);
  const saveRef = useRef<(() => void) | null>(null);

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

    const save = () => useStore.getState().setCameraPose(current());
    saveRef.current = save;

    const handle = (animate: boolean) => {
      const cmd = useStore.getState().claimViewCommand('3d');
      if (cmd?.kind === 'camera') go(cmd.preset, animate);
    };
    const remembered = useStore.getState().cameraPose;
    if (remembered) setPose(remembered);
    else go('iso', false);
    handle(false);

    const unsubscribe = useStore.subscribe((s, prev) => {
      if (s.viewCommand !== prev.viewCommand) handle(true);
    });
    const onStart = () => {
      // The user grabbed the camera: stop any transition and drop the preset highlight.
      anim.current = null;
      if (useStore.getState().activePreset) useStore.getState().setActivePreset(null);
    };
    controls.addEventListener('start', onStart);
    controls.addEventListener('end', save);
    return () => {
      unsubscribe();
      controls.removeEventListener('start', onStart);
      controls.removeEventListener('end', save);
      saveRef.current = null;
      save();
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
    if (t >= 1) {
      anim.current = null;
      saveRef.current?.();
    }
  });

  return null;
}
