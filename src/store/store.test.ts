import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultLayout } from '../model/defaults';
import { moveInstance, renameLayout, updateInstance } from '../model/ops';
import { BUILT_IN_PRESETS } from '../model/presets';
import type { Layout } from '../model/types';
import { addPreset, deleteObject, deleteSelected, duplicateSelected, nudgeSelected, rotateSelected } from './commands';
import { AUTOSAVE_MS, initStore } from './init';
import { useStore } from './store';

const layout = (): Layout => useStore.getState().history.present;
const byLabel = (label: string) => layout().instances.find((i) => i.label === label)!;

beforeEach(() => {
  useStore.setState(useStore.getInitialState(), true);
  useStore.getState().replaceLayout(createDefaultLayout());
});

describe('apply / undo / redo', () => {
  it('each apply is one undo step', () => {
    const s = useStore.getState();
    const before = layout();
    s.apply((l) => renameLayout(l, 'A'));
    s.apply((l) => renameLayout(l, 'B'));
    expect(layout().name).toBe('B');
    s.undo();
    expect(layout().name).toBe('A');
    s.undo();
    expect(layout()).toBe(before);
    s.redo();
    expect(layout().name).toBe('A');
  });

  it('a no-op apply adds no history', () => {
    const s = useStore.getState();
    s.apply((l) => l);
    expect(useStore.getState().history.past).toHaveLength(0);
  });

  it('a drag-style transaction is a single undo step, and cancel reverts it', () => {
    const s = useStore.getState();
    const kb = byLabel('Keyboard');
    s.beginTx();
    for (const x of [10, 20, 30]) s.apply((l) => moveInstance(l, kb.id, { position: { x } }));
    s.endTx();
    expect(byLabel('Keyboard').position.x).toBe(30);
    expect(useStore.getState().history.past).toHaveLength(1);
    s.undo();
    expect(byLabel('Keyboard').position.x).toBe(kb.position.x);

    s.beginTx();
    s.apply((l) => moveInstance(l, kb.id, { position: { x: 99 } }));
    s.cancelTx();
    expect(byLabel('Keyboard').position.x).toBe(kb.position.x);
    expect(useStore.getState().history.past).toHaveLength(0);
  });
});

describe('commands', () => {
  it('addPreset adds a speaker pair and selects the left one', () => {
    const preset = BUILT_IN_PRESETS.find((p) => p.id === 'spk-small')!;
    const ids = addPreset(preset, { pair: true });
    expect(ids).toHaveLength(2);
    expect(useStore.getState().selection).toEqual({ kind: 'instance', id: ids[0] });
    expect(useStore.getState().history.past).toHaveLength(1);
  });

  it('duplicateSelected selects the copy', () => {
    const kb = byLabel('Keyboard');
    useStore.getState().select({ kind: 'instance', id: kb.id });
    const copyId = duplicateSelected();
    expect(copyId).not.toBeNull();
    expect(useStore.getState().selection).toEqual({ kind: 'instance', id: copyId });
  });

  it('deleteSelected removes and deselects, but not when locked', () => {
    const s = useStore.getState();
    const kb = byLabel('Keyboard');
    s.apply((l) => updateInstance(l, kb.id, { locked: true }));
    s.select({ kind: 'instance', id: kb.id });
    expect(deleteSelected()).toBe(false);
    expect(useStore.getState().selection).toEqual({ kind: 'instance', id: kb.id });

    s.apply((l) => updateInstance(l, kb.id, { locked: false }));
    expect(deleteSelected()).toBe(true);
    expect(useStore.getState().selection).toBeNull();
    expect(layout().instances.some((i) => i.id === kb.id)).toBe(false);
  });

  it('deleting an unselected object keeps the selection', () => {
    const s = useStore.getState();
    const kb = byLabel('Keyboard');
    const mouse = byLabel('Mouse');
    s.select({ kind: 'instance', id: kb.id });
    deleteObject(mouse.id);
    expect(useStore.getState().selection).toEqual({ kind: 'instance', id: kb.id });
  });

  it('nudges and rotates the selection; locked objects stay put', () => {
    const s = useStore.getState();
    const kb = byLabel('Keyboard');
    s.select({ kind: 'instance', id: kb.id });
    nudgeSelected(10, -1);
    rotateSelected(15);
    expect(byLabel('Keyboard').position).toMatchObject({ x: kb.position.x + 10, z: kb.position.z - 1 });
    expect(byLabel('Keyboard').rotation.yaw).toBe(15);

    s.apply((l) => updateInstance(l, kb.id, { locked: true }));
    const steps = useStore.getState().history.past.length;
    nudgeSelected(10, 0);
    rotateSelected(1);
    expect(useStore.getState().history.past).toHaveLength(steps);
  });

  it('nudges the listener', () => {
    const s = useStore.getState();
    const before = layout().listener;
    s.select({ kind: 'listener' });
    nudgeSelected(-10, 1);
    expect(layout().listener).toMatchObject({ x: before.x - 10, distanceFromFrontEdge: before.distanceFromFrontEdge + 1 });
  });
});

describe('view commands', () => {
  it('each view claims its own commands once, by seq', () => {
    const s = useStore.getState();
    s.sendViewCommand({ kind: 'fit' });
    expect(s.claimViewCommand('3d')).toBeNull();
    expect(s.claimViewCommand('2d')).toEqual({ kind: 'fit' });
    expect(s.claimViewCommand('2d')).toBeNull();

    // Repeating the same command is honoured because seq increases.
    s.sendViewCommand({ kind: 'fit' });
    expect(useStore.getState().viewCommand?.seq).toBe(2);
    expect(s.claimViewCommand('2d')).toEqual({ kind: 'fit' });
  });

  it('a pending camera command waits for the 3D view', () => {
    const s = useStore.getState();
    s.sendViewCommand({ kind: 'camera', preset: 'seated' });
    expect(s.claimViewCommand('2d')).toBeNull();
    expect(useStore.getState().activePreset).toBe('seated');
    expect(s.claimViewCommand('3d')).toEqual({ kind: 'camera', preset: 'seated' });
  });

  it('camera fit keeps the active preset highlight', () => {
    const s = useStore.getState();
    s.sendViewCommand({ kind: 'camera', preset: 'top' });
    s.sendViewCommand({ kind: 'camera', preset: 'fit' });
    expect(useStore.getState().activePreset).toBe('top');
  });

  it('mirrors the plan scale into zoom, and a new layout clears the plan viewport', () => {
    const s = useStore.getState();
    s.setPlanViewport({ scale: 0.75, offsetX: 1, offsetY: 2 });
    expect(useStore.getState().zoom).toBe(0.75);
    s.replaceLayout(createDefaultLayout());
    expect(useStore.getState().planViewport).toBeNull();
  });
});

describe('initStore', () => {
  let data: Map<string, string>;
  let dispose: (() => void) | null = null;

  beforeEach(() => {
    data = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      key: (i: number) => [...data.keys()][i] ?? null,
      get length() {
        return data.size;
      },
    });
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
    vi.useFakeTimers();
  });

  afterEach(() => {
    dispose?.();
    dispose = null;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('loads the saved layout, theme and presets', () => {
    const saved = renameLayout(createDefaultLayout(), 'Saved desk');
    data.set('schreibtisch:current-layout', JSON.stringify(saved));
    data.set('schreibtisch:theme', 'light');
    data.set('schreibtisch:presets', JSON.stringify([{ id: 'p1', name: 'My box', category: 'other', size: { w: 10, d: 10, h: 10 }, approx: false, group: 'My presets' }]));
    dispose = initStore();
    const st = useStore.getState();
    expect(st.history.present).toEqual(saved);
    expect(st.history.past).toHaveLength(0);
    expect(st.theme).toBe('light');
    expect(st.userPresets.map((p) => p.name)).toEqual(['My box']);
  });

  it('opens the setup wizard only in a fresh browser', () => {
    dispose = initStore();
    expect(useStore.getState().wizard).toBe('first-run');
    dispose();
    data.set('schreibtisch:theme', 'dark');
    dispose = initStore();
    expect(useStore.getState().wizard).toBeNull();
  });

  it('saves, lists, opens and deletes named layouts', () => {
    dispose = initStore();
    const s = useStore.getState();
    s.apply((l) => renameLayout(l, 'Studio'));
    expect(s.saveLayout()).toBe(true);
    const studioId = layout().id;
    expect(JSON.parse(data.get('schreibtisch:saved-layouts')!)[0].layout.name).toBe('Studio');

    s.replaceLayout(renameLayout(createDefaultLayout(), 'Other'));
    s.saveLayout();
    expect(useStore.getState().savedLayouts.map((x) => x.layout.name)).toEqual(['Other', 'Studio']);

    s.openSavedLayout(studioId);
    expect(layout().name).toBe('Studio');
    expect(useStore.getState().history.past).toHaveLength(0);

    s.deleteSavedLayout(studioId);
    expect(useStore.getState().savedLayouts.map((x) => x.layout.name)).toEqual(['Other']);
    // Saved layouts survive a reload.
    dispose();
    dispose = initStore();
    expect(useStore.getState().savedLayouts.map((x) => x.layout.name)).toEqual(['Other']);
  });

  it('keeps the default layout when nothing is saved, and does not save until something changes', () => {
    dispose = initStore();
    vi.advanceTimersByTime(AUTOSAVE_MS * 2);
    expect(data.has('schreibtisch:current-layout')).toBe(false);
    expect(useStore.getState().theme).toBe('dark');
  });

  it('autosaves after a debounce, and flushes on pagehide', () => {
    dispose = initStore();
    const s = useStore.getState();
    s.apply((l) => renameLayout(l, 'One'));
    vi.advanceTimersByTime(AUTOSAVE_MS - 1);
    expect(data.has('schreibtisch:current-layout')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(JSON.parse(data.get('schreibtisch:current-layout')!).name).toBe('One');

    s.apply((l) => renameLayout(l, 'Two'));
    window.dispatchEvent(new Event('pagehide'));
    expect(JSON.parse(data.get('schreibtisch:current-layout')!).name).toBe('Two');
  });

  it('flushes when the page becomes hidden', () => {
    dispose = initStore();
    useStore.getState().apply((l) => renameLayout(l, 'Hidden'));
    Object.assign(document, { visibilityState: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(JSON.parse(data.get('schreibtisch:current-layout')!).name).toBe('Hidden');
  });

  it('stops autosaving once disposed', () => {
    dispose = initStore();
    dispose();
    dispose = null;
    useStore.getState().apply((l) => renameLayout(l, 'After'));
    vi.advanceTimersByTime(AUTOSAVE_MS * 2);
    expect(data.has('schreibtisch:current-layout')).toBe(false);
  });
});
