import { addFromPreset, deleteInstance, duplicateInstance, moveInstance, setListener } from '../model/ops';
import type { Preset } from '../model/presets';
import type { Layout } from '../model/types';
import { useStore } from './store';

/**
 * Store commands: apply a pure layout op as one undo step and update the selection to match.
 * They read the current state when called, so they're safe to use from event handlers.
 */

function commit(next: Layout): void {
  useStore.getState().apply(() => next);
}

function selectedInstanceId(): string | null {
  const sel = useStore.getState().selection;
  return sel?.kind === 'instance' ? sel.id : null;
}

/** Add a library preset (optionally as a mirrored L/R pair) and select the first new object. */
export function addPreset(preset: Preset, opts: { pair?: boolean } = {}): string[] {
  const { layout, instanceIds } = addFromPreset(useStore.getState().history.present, preset, { pair: opts.pair ?? false });
  commit(layout);
  const first = instanceIds[0];
  if (first) useStore.getState().select({ kind: 'instance', id: first });
  return instanceIds;
}

/** Duplicate an object and select the copy. Returns the copy's id, or null if `id` is unknown. */
export function duplicateObject(id: string): string | null {
  const before = useStore.getState().history.present;
  const { layout, instanceId } = duplicateInstance(before, id);
  if (layout === before) return null;
  commit(layout);
  useStore.getState().select({ kind: 'instance', id: instanceId });
  return instanceId;
}

/** Delete an object (a no-op when locked) and clear the selection if it was selected. */
export function deleteObject(id: string): boolean {
  const before = useStore.getState().history.present;
  const next = deleteInstance(before, id);
  if (next === before) return false;
  const wasSelected = selectedInstanceId() === id;
  commit(next);
  if (wasSelected) useStore.getState().select(null);
  return true;
}

export function duplicateSelected(): string | null {
  const id = selectedInstanceId();
  return id ? duplicateObject(id) : null;
}

export function deleteSelected(): boolean {
  const id = selectedInstanceId();
  return id ? deleteObject(id) : false;
}

/** Move the selected object or the listener by (dx, dz) mm in plan. */
export function nudgeSelected(dx: number, dz: number): void {
  const { selection, history } = useStore.getState();
  const layout = history.present;
  if (selection?.kind === 'listener') {
    const { x, distanceFromFrontEdge } = layout.listener;
    commit(setListener(layout, { x: x + dx, distanceFromFrontEdge: distanceFromFrontEdge + dz }));
    return;
  }
  if (selection?.kind !== 'instance') return;
  const inst = layout.instances.find((i) => i.id === selection.id);
  if (!inst) return;
  commit(moveInstance(layout, inst.id, { position: { x: inst.position.x + dx, z: inst.position.z + dz } }));
}

/** Turn the selected object by `deg` degrees of yaw (positive = counter-clockwise from above). */
export function rotateSelected(deg: number): void {
  const id = selectedInstanceId();
  const layout = useStore.getState().history.present;
  const inst = id ? layout.instances.find((i) => i.id === id) : undefined;
  if (!inst) return;
  commit(moveInstance(layout, inst.id, { rotation: { yaw: inst.rotation.yaw + deg } }));
}
