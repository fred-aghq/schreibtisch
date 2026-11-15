import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { pan, screenToWorld } from '../../geometry/viewport';
import type { Viewport } from '../../geometry/viewport';
import type { Vec2 } from '../../geometry/vec';
import { canDrag, DragSession, moveTarget, snapTarget } from '../../layout/drag';
import type { DragTarget } from '../../layout/drag';
import { useStore } from '../../store/store';
import type { ActiveSnap } from './SnapGuides';
import { updateViewport } from './usePlanViewport';

/** Edge-snap distance in screen pixels (converted to mm at the current zoom). */
const SNAP_PX = 6;
const NO_SNAP: ActiveSnap = { lineX: null, lineZ: null };

type Drag =
  | { kind: 'pan'; pointerId: number; lastX: number; lastY: number }
  | { kind: 'move'; pointerId: number; target: DragTarget; startClient: { x: number; y: number }; startWorld: Vec2; startPos: Vec2; session: DragSession };

export type DragMode = 'pan' | 'move' | null;

/**
 * Pointer handling for the plan: dragging objects and the listener (through the shared drag core),
 * and click-drag panning on empty space, with the middle button, or while Space is held.
 */
export function usePlanDrag(svgRef: RefObject<SVGSVGElement | null>, vp: Viewport, spaceHeld: boolean) {
  const drag = useRef<Drag | null>(null);
  const [mode, setMode] = useState<DragMode>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [snap, setSnap] = useState<ActiveSnap>(NO_SNAP);

  const toWorld = useCallback(
    (e: { clientX: number; clientY: number }): Vec2 => {
      const rect = svgRef.current?.getBoundingClientRect();
      return screenToWorld(vp, { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) });
    },
    [vp, svgRef],
  );

  const capture = (e: ReactPointerEvent) => svgRef.current?.setPointerCapture(e.pointerId);

  const finish = () => {
    drag.current = null;
    setMode(null);
    setDraggingId(null);
    setSnap(NO_SNAP);
  };

  const startMove = (e: ReactPointerEvent, target: DragTarget) => {
    if (e.button === 1 || spaceHeld) return; // let it bubble to the background → pan
    e.stopPropagation();
    if (e.button !== 0) return;
    const store = useStore.getState();
    store.select(target.kind === 'listener' ? { kind: 'listener' } : { kind: 'instance', id: target.id });
    const layout = store.history.present;
    if (!canDrag(layout, target)) return;
    const startPos =
      target.kind === 'listener'
        ? { x: layout.listener.x, z: layout.listener.distanceFromFrontEdge }
        : layout.instances.find((i) => i.id === target.id)?.position;
    if (!startPos) return;
    capture(e);
    const session = new DragSession({ tx: store, keys: window, onFinish: finish });
    drag.current = {
      kind: 'move',
      pointerId: e.pointerId,
      target,
      startClient: { x: e.clientX, y: e.clientY },
      startWorld: toWorld(e),
      startPos: { x: startPos.x, z: startPos.z },
      session,
    };
    setMode('move');
  };

  const onBackgroundPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    if (e.button === 0 && !spaceHeld) useStore.getState().select(null);
    capture(e);
    drag.current = { kind: 'pan', pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
    setMode('pan');
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const world = toWorld(e);
    const store = useStore.getState();
    store.setCursor(world);
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;

    if (d.kind === 'pan') {
      updateViewport((v) => pan(v, e.clientX - d.lastX, e.clientY - d.lastY));
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      return;
    }

    const wasLive = d.session.moved;
    if (!d.session.update(Math.hypot(e.clientX - d.startClient.x, e.clientY - d.startClient.y))) return;
    if (!wasLive && d.target.kind === 'object') setDraggingId(d.target.id);
    const raw = { x: d.startPos.x + world.x - d.startWorld.x, z: d.startPos.z + world.z - d.startWorld.z };
    const r = snapTarget(store.history.present, d.target, raw, SNAP_PX / vp.scale, e.altKey);
    setSnap({ lineX: r.lineX, lineZ: r.lineZ });
    store.apply((l) => moveTarget(l, d.target, r.pos));
  };

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (svgRef.current?.hasPointerCapture(e.pointerId)) svgRef.current.releasePointerCapture(e.pointerId);
    if (d.kind === 'move') d.session.end();
    else finish();
  };

  return {
    mode,
    draggingId,
    snap,
    onBackgroundPointerDown,
    onObjectPointerDown: (e: ReactPointerEvent, id: string) => startMove(e, { kind: 'object', id }),
    onListenerPointerDown: (e: ReactPointerEvent) => startMove(e, { kind: 'listener' }),
    onPointerMove,
    onPointerUp,
  };
}
