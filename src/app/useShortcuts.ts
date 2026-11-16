import { useEffect } from 'react';
import { isTypingTarget } from '../lib/dom';
import { CAMERA_PRESETS } from '../layout/cameraPoses';
import { deleteSelected, duplicateSelected, nudgeSelected, rotateSelected, toggleTriangle } from '../store/commands';
import { useStore } from '../store/store';

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
      if (mod && key === 's') {
        e.preventDefault();
        s.saveLayout();
        return;
      }
      if (mod && key === 'y') {
        e.preventDefault();
        s.redo();
        return;
      }

      if (key === 'escape') {
        if (s.showShortcuts) s.setShowShortcuts(false);
        else s.select(null);
        return;
      }
      if (e.key === '?') {
        s.setShowShortcuts(!s.showShortcuts);
        return;
      }
      if (!mod && !e.altKey && key === 't') {
        toggleTriangle();
        return;
      }
      if (!mod && key === 'f') {
        s.sendViewCommand(s.view === '3d' ? { kind: 'camera', preset: 'fit' } : { kind: 'fit' });
        return;
      }
      // Number keys: camera presets (switches to 3D).
      const presetIndex = !mod && !e.altKey ? Number.parseInt(e.key, 10) - 1 : -1;
      const preset = CAMERA_PRESETS[presetIndex];
      if (preset) {
        s.setView('3d');
        s.sendViewCommand({ kind: 'camera', preset });
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
      if (arrow && s.selection) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        nudgeSelected(arrow[0] * step, arrow[1] * step);
        return;
      }

      if (s.selection?.kind !== 'instance') return;

      // Q / E rotate 1° (Shift = 15°). Q turns counter-clockwise when seen from above.
      if (!mod && (key === 'q' || key === 'e')) {
        rotateSelected((key === 'q' ? 1 : -1) * (e.shiftKey ? 15 : 1));
        return;
      }
      if (mod && key === 'd') {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if (key === 'delete' || key === 'backspace') {
        e.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
