import type { Vec2, Vec3 } from '../geometry/vec';
import { moveInstance, setListener } from '../model/ops';
import type { Layout } from '../model/types';
import { listenerHead } from './scene';
import { snapInstance, snapListener } from './snap';
import type { SnapResult } from './snap';

/**
 * The drag core shared by the 2D and 3D views. The views only turn pointer positions into world
 * positions (2D: screen → plan; 3D: ray → plane); everything else lives here.
 */

export type DragTarget = { kind: 'object'; id: string } | { kind: 'listener' };

/** Pointer travel (CSS px) before a press becomes a drag, so clicks don't nudge things. */
export const DRAG_THRESHOLD_PX = 3;

/** The dragged thing's current position: an object's bottom-centre, or the listener's head centre. */
export function targetPosition(layout: Layout, target: DragTarget): Vec3 | null {
  if (target.kind === 'listener') return listenerHead(layout);
  const inst = layout.instances.find((i) => i.id === target.id);
  return inst ? { ...inst.position } : null;
}

/** Whether a press on `target` should start a drag (locked objects are only selected). */
export function canDrag(layout: Layout, target: DragTarget): boolean {
  if (target.kind === 'listener') return true;
  const inst = layout.instances.find((i) => i.id === target.id);
  return inst !== undefined && !inst.locked;
}

/**
 * Move the target to `pos`. Objects move through `moveInstance` (so pairs mirror and locks hold);
 * for the listener, x / z are the head position and y (if given) the head height above the desk.
 */
export function moveTarget(layout: Layout, target: DragTarget, pos: Vec2 & { y?: number }): Layout {
  if (target.kind === 'object') {
    const position = pos.y === undefined ? { x: pos.x, z: pos.z } : { x: pos.x, y: pos.y, z: pos.z };
    return moveInstance(layout, target.id, { position });
  }
  return setListener(layout, {
    x: pos.x,
    distanceFromFrontEdge: pos.z,
    ...(pos.y === undefined ? {} : { earHeightFromFloor: pos.y + layout.desk.heightFromFloor }),
  });
}

/** Snap a raw plan position for the target (`thresholdMm` is the edge-snap distance). */
export function snapTarget(layout: Layout, target: DragTarget, raw: Vec2, thresholdMm: number, bypass: boolean): SnapResult {
  return target.kind === 'object' ? snapInstance(layout, target.id, raw, thresholdMm, bypass) : snapListener(layout, raw, thresholdMm, bypass);
}

/** The store's transaction calls, injected so the session stays testable. */
export interface TxApi {
  beginTx: () => void;
  endTx: () => void;
  cancelTx: () => void;
}

export interface KeyEventLike {
  key: string;
  stopPropagation: () => void;
}

export interface KeyTarget {
  addEventListener: (type: 'keydown', fn: (e: KeyEventLike) => void, capture: boolean) => void;
  removeEventListener: (type: 'keydown', fn: (e: KeyEventLike) => void, capture: boolean) => void;
}

export interface DragSessionOptions {
  tx: TxApi;
  /** Where to listen for Escape (normally `window`); null to not listen. */
  keys: KeyTarget | null;
  thresholdPx?: number;
  /** Called once when the session finishes, whether it ended normally or was cancelled. */
  onFinish?: (cancelled: boolean) => void;
}

/**
 * One press-drag-release. It opens a transaction once the pointer has travelled past the
 * threshold, so the whole drag is one undo step; Escape cancels it and restores the layout.
 */
export class DragSession {
  private live = false;
  private finished = false;
  private readonly opts: DragSessionOptions;
  private readonly onKey = (e: KeyEventLike) => {
    if (e.key !== 'Escape') return;
    // Only swallow Escape for a real drag; a plain press still lets Escape deselect.
    if (this.live) e.stopPropagation();
    this.cancel();
  };

  constructor(opts: DragSessionOptions) {
    this.opts = opts;
    opts.keys?.addEventListener('keydown', this.onKey, true);
  }

  /** True once the pointer has moved far enough to count as a drag. */
  get moved(): boolean {
    return this.live;
  }

  get done(): boolean {
    return this.finished;
  }

  /** Report the pointer's travel from where it was pressed (px). Returns true while dragging. */
  update(travelPx: number): boolean {
    if (this.finished) return false;
    if (!this.live) {
      if (travelPx < (this.opts.thresholdPx ?? DRAG_THRESHOLD_PX)) return false;
      this.live = true;
      this.opts.tx.beginTx();
    }
    return true;
  }

  /** Pointer released: keep the changes as one undo step. */
  end(): void {
    if (!this.finish()) return;
    if (this.live) this.opts.tx.endTx();
    this.opts.onFinish?.(false);
  }

  /** Escape or lost pointer: put everything back. */
  cancel(): void {
    if (!this.finish()) return;
    if (this.live) this.opts.tx.cancelTx();
    this.opts.onFinish?.(true);
  }

  private finish(): boolean {
    if (this.finished) return false;
    this.finished = true;
    this.opts.keys?.removeEventListener('keydown', this.onKey, true);
    return true;
  }
}
