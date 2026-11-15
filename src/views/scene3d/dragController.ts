import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useCallback } from 'react';
import { Raycaster, Vector2, Vector3 } from 'three';
import { horizontalPlane, intersectRayPlane, verticalPlaneFacing } from '../../geometry/ray';
import type { Plane, Ray } from '../../geometry/ray';
import { listenerHead } from '../../layout/scene';
import { snapInstance, snapListener } from '../../layout/snap';
import { snapTo } from '../../geometry/math';
import type { Vec3 } from '../../geometry/vec';
import { add3, sub3 } from '../../geometry/vec';
import { moveInstance, setListener } from '../../model/ops';
import { useStore } from '../../store/store';

export type DragTarget = { kind: 'object'; id: string } | { kind: 'listener' };

const THRESHOLD_PX = 3;
/** Edge-snap distance in 3D (mm); there's no single zoom level, so it's fixed. */
const SNAP_MM = 12;

interface ControlsLike {
  enabled: boolean;
}

function currentPosition(target: DragTarget): Vec3 | null {
  const layout = useStore.getState().history.present;
  if (target.kind === 'listener') return listenerHead(layout);
  const inst = layout.instances.find((i) => i.id === target.id);
  return inst ? { ...inst.position } : null;
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
      if (target.kind === 'object') {
        const inst = store.history.present.instances.find((i) => i.id === target.id);
        if (!inst || inst.locked) return;
      }
      const startPos = currentPosition(target);
      if (!startPos) return;

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

      let vertical = native.shiftKey;
      let anchorPos = startPos;
      let anchorHit: Vec3 = { x: e.point.x, y: e.point.y, z: e.point.z };
      let plane = makePlane(vertical, anchorHit);
      let moved = false;
      const sx = native.clientX;
      const sy = native.clientY;
      const controls = get().controls as unknown as ControlsLike | null;
      if (controls) controls.enabled = false;

      const apply = (pos: Vec3) => {
        const s = useStore.getState();
        if (target.kind === 'object') {
          s.apply((l) => moveInstance(l, target.id, { position: pos }));
        } else {
          s.apply((l) =>
            setListener(l, {
              x: pos.x,
              distanceFromFrontEdge: pos.z,
              earHeightFromFloor: pos.y + l.desk.heightFromFloor,
            }),
          );
        }
      };

      const onMove = (ev: PointerEvent) => {
        if (!moved) {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < THRESHOLD_PX) return;
          moved = true;
          useStore.getState().beginTx();
        }
        if (ev.shiftKey !== vertical) {
          // Switching between horizontal and vertical mid-drag: re-anchor where we are now.
          const now = currentPosition(target) ?? anchorPos;
          const through = add3(anchorHit, sub3(now, anchorPos));
          vertical = ev.shiftKey;
          plane = makePlane(vertical, through);
          anchorHit = intersectRayPlane(rayAt(ev.clientX, ev.clientY), plane) ?? through;
          anchorPos = now;
        }
        const hit = intersectRayPlane(rayAt(ev.clientX, ev.clientY), plane);
        if (!hit) return;
        const d = sub3(hit, anchorHit);
        const layout = useStore.getState().history.present;
        const { snapEnabled, snapStep } = layout.settings;
        const step = snapEnabled && !ev.altKey ? snapStep : 0;
        if (vertical) {
          apply({ ...anchorPos, y: snapTo(anchorPos.y + d.y, step) });
        } else {
          const raw = { x: anchorPos.x + d.x, z: anchorPos.z + d.z };
          const r =
            target.kind === 'object'
              ? snapInstance(layout, target.id, raw, SNAP_MM, ev.altKey)
              : snapListener(layout, raw, SNAP_MM, ev.altKey);
          apply({ ...anchorPos, x: r.pos.x, z: r.pos.z });
        }
      };

      const cleanup = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        window.removeEventListener('keydown', onKey, true);
        if (controls) controls.enabled = true;
      };
      const onUp = () => {
        cleanup();
        if (moved) useStore.getState().endTx();
      };
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key !== 'Escape') return;
        ev.stopPropagation();
        cleanup();
        if (moved) useStore.getState().cancelTx();
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      window.addEventListener('keydown', onKey, true);
    },
    [camera, gl, get],
  );
}
