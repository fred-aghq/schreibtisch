import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useCallback } from 'react';
import { Raycaster, Vector2, Vector3 } from 'three';
import { snapTo } from '../../geometry/math';
import { horizontalPlane, intersectRayPlane, verticalPlaneFacing } from '../../geometry/ray';
import type { Plane, Ray } from '../../geometry/ray';
import type { Vec3 } from '../../geometry/vec';
import { add3, sub3 } from '../../geometry/vec';
import { canDrag, DragSession, moveTarget, snapTarget, targetPosition } from '../../layout/drag';
import type { DragTarget } from '../../layout/drag';
import { useStore } from '../../store/store';

/** Edge-snap distance in 3D (mm); there's no single zoom level, so it's fixed. */
const SNAP_MM = 12;

interface ControlsLike {
  enabled: boolean;
}

/**
 * Returns a pointer-down handler that drags an object (or the listener) on the horizontal
 * plane through the grab point. Holding Shift drags vertically instead (elevation / ear height).
 * Alt bypasses snapping. Escape cancels. The whole drag is a single undo step.
 */
export function useDragController(): (e: ThreeEvent<PointerEvent>, target: DragTarget) => void {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);

  return useCallback(
    (e: ThreeEvent<PointerEvent>, target: DragTarget) => {
      const native = e.nativeEvent;
      if (native.button !== 0) return;
      e.stopPropagation();
      const store = useStore.getState();
      store.select(target.kind === 'listener' ? { kind: 'listener' } : { kind: 'instance', id: target.id });
      const layout = store.history.present;
      const startPos = targetPosition(layout, target);
      if (!startPos || !canDrag(layout, target)) return;

      const raycaster = new Raycaster();
      const ndc = new Vector2();
      const viewDir = new Vector3();
      const rayAt = (clientX: number, clientY: number): Ray => {
        const rect = gl.domElement.getBoundingClientRect();
        ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(ndc, camera);
        const { origin, direction } = raycaster.ray;
        return { origin: { x: origin.x, y: origin.y, z: origin.z }, direction: { x: direction.x, y: direction.y, z: direction.z } };
      };
      const makePlane = (vertical: boolean, through: Vec3): Plane => {
        if (!vertical) return horizontalPlane(through);
        camera.getWorldDirection(viewDir);
        return verticalPlaneFacing(through, { x: viewDir.x, y: viewDir.y, z: viewDir.z }) ?? horizontalPlane(through);
      };
      const current = () => targetPosition(useStore.getState().history.present, target);

      let vertical = native.shiftKey;
      let anchorPos = startPos;
      let anchorHit: Vec3 = { x: e.point.x, y: e.point.y, z: e.point.z };
      let plane = makePlane(vertical, anchorHit);
      const sx = native.clientX;
      const sy = native.clientY;
      const controls = get().controls as unknown as ControlsLike | null;
      if (controls) controls.enabled = false;

      const onMove = (ev: PointerEvent) => {
        if (!session.update(Math.hypot(ev.clientX - sx, ev.clientY - sy))) return;
        if (ev.shiftKey !== vertical) {
          // Switching between horizontal and vertical mid-drag: re-anchor where we are now.
          const now = current() ?? anchorPos;
          const through = add3(anchorHit, sub3(now, anchorPos));
          vertical = ev.shiftKey;
          plane = makePlane(vertical, through);
          anchorHit = intersectRayPlane(rayAt(ev.clientX, ev.clientY), plane) ?? through;
          anchorPos = now;
        }
        const hit = intersectRayPlane(rayAt(ev.clientX, ev.clientY), plane);
        if (!hit) return;
        const d = sub3(hit, anchorHit);
        const s = useStore.getState();
        const layoutNow = s.history.present;
        let pos: Vec3;
        if (vertical) {
          const { snapEnabled, snapStep } = layoutNow.settings;
          pos = { ...anchorPos, y: snapTo(anchorPos.y + d.y, snapEnabled && !ev.altKey ? snapStep : 0) };
        } else {
          const r = snapTarget(layoutNow, target, { x: anchorPos.x + d.x, z: anchorPos.z + d.z }, SNAP_MM, ev.altKey);
          pos = { ...anchorPos, x: r.pos.x, z: r.pos.z };
        }
        s.apply((l) => moveTarget(l, target, pos));
      };
      const onUp = () => session.end();

      const session = new DragSession({
        tx: store,
        keys: window,
        onFinish: () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onUp);
          if (controls) controls.enabled = true;
        },
      });
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [camera, gl, get],
  );
}
