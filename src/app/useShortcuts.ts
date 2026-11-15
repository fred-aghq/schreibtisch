import { useEffect } from 'react';
import { CAMERA_PRESETS } from '../geometry/camera';
import { deleteInstance, duplicateInstance, setListener, updateInstance } from '../store/ops';
import { useStore } from '../store/store';

function isTypingTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
}

/** Global keyboard shortcuts. Ignored while typing in a field. */
export function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const s = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && key === 'y') {
        e.preventDefault();
        s.redo();
        return;
      }

      const sel = s.selection;
      const layout = s.history.present;

      if (key === 'escape') {
        s.select(null);
        return;
      }
      if (!mod && key === 'f') {
        if (s.view === '3d') s.requestCamera('fit');
        else s.requestFit();
        return;
      }
      // Number keys: camera presets (switches to 3D).
      const presetIndex = !mod && !e.altKey ? Number.parseInt(e.key, 10) - 1 : -1;
      const preset = CAMERA_PRESETS[presetIndex];
      if (preset) {
        s.setView('3d');
        s.requestCamera(preset);
        return;
      }

      // Arrow nudges: 1 mm, Shift = 10 mm. Up = toward the back of the desk (−Z).
      const arrows: Record<string, [number, number]> = {
        arrowleft: [-1, 0],
        arrowright: [1, 0],
        arrowup: [0, -1],
        arrowdown: [0, 1],
      };
      const arrow = arrows[key];
      if (arrow && sel) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const [dx, dz] = arrow;
        if (sel.kind === 'listener') {
          s.apply((l) => setListener(l, { x: l.listener.x + dx * step, distanceFromFrontEdge: l.listener.distanceFromFrontEdge + dz * step }));
        } else {
          const inst = layout.instances.find((i) => i.id === sel.id);
          if (inst && !inst.locked) {
            s.apply((l) => updateInstance(l, inst.id, { position: { x: inst.position.x + dx * step, z: inst.position.z + dz * step } }));
          }
        }
        return;
      }

      if (sel?.kind !== 'instance') return;
      const inst = layout.instances.find((i) => i.id === sel.id);
      if (!inst) return;

      // Q / E rotate 1° (Shift = 15°). Q turns counter-clockwise when seen from above.
      if (!mod && (key === 'q' || key === 'e') && !inst.locked) {
        const step = e.shiftKey ? 15 : 1;
        const dir = key === 'q' ? 1 : -1;
        s.apply((l) => updateInstance(l, inst.id, { rotation: { yaw: inst.rotation.yaw + dir * step } }));
        return;
      }
      if (mod && key === 'd') {
        e.preventDefault();
        let newId = inst.id;
        s.apply((l) => {
          const r = duplicateInstance(l, inst.id);
          newId = r.instanceId;
          return r.layout;
        });
        s.select({ kind: 'instance', id: newId });
        return;
      }
      if ((key === 'delete' || key === 'backspace') && !inst.locked) {
        e.preventDefault();
        s.apply((l) => deleteInstance(l, inst.id));
        s.select(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
