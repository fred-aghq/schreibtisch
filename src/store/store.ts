import { create } from 'zustand';
import type { CameraPose, CameraPreset } from '../layout/cameraPoses';
import type { Viewport } from '../geometry/viewport';
import type { SpeakerFitMode, TriangleFix } from '../layout/triangleFixes';
import { createDefaultLayout } from '../model/defaults';
import type { Layout } from '../model/types';
import * as H from './history';
import type { Preset } from '../model/presets';
import { saveTheme, saveUserPresets } from './persistence';

export type Theme = 'dark' | 'light';
export type Selection = { kind: 'instance'; id: string } | { kind: 'listener' } | null;
export type ViewMode = '2d' | '3d';
export type SidebarTab = 'library' | 'scene';

/** One-shot requests to whichever view handles them (plan: fit / zoom, 3D: camera). */
export type ViewCommand = { kind: 'fit' } | { kind: 'zoom'; scale: number } | { kind: 'camera'; preset: CameraPreset | 'fit' };

/** The view that handles a command. */
export function commandView(cmd: ViewCommand): ViewMode {
  return cmd.kind === 'camera' ? '3d' : '2d';
}

export interface Cursor {
  x: number;
  z: number;
}

export interface AppState {
  history: H.History<Layout>;
  selection: Selection;
  view: ViewMode;
  theme: Theme;
  sidebarTab: SidebarTab;
  /** Plan-view zoom (px per mm) and cursor position, mirrored here for the status bar. */
  zoom: number;
  cursor: Cursor | null;
  /** Latest view command; `seq` increases on every request so repeats are honoured. */
  viewCommand: { seq: number; cmd: ViewCommand } | null;
  /** The last command `seq` each view has handled. */
  handledSeq: Record<ViewMode, number>;
  /** View state kept here (not persisted) so it survives switching 2D ↔ 3D. */
  planViewport: Viewport | null;
  cameraPose: CameraPose | null;
  activePreset: CameraPreset | null;
  /** The user's saved definitions (library "My presets"), kept outside any single layout. */
  userPresets: Preset[];
  showShortcuts: boolean;
  /** The triangle fix being hovered, previewed as ghosts in both views. */
  fixPreview: TriangleFix | null;
  /** How "Move speakers to ideal" sizes the triangle. */
  speakerFitMode: SpeakerFitMode;

  /** Apply a change to the layout (one undo step unless a transaction is open). */
  apply: (recipe: (layout: Layout) => Layout) => void;
  beginTx: () => void;
  endTx: () => void;
  cancelTx: () => void;
  undo: () => void;
  redo: () => void;
  replaceLayout: (layout: Layout) => void;

  select: (s: Selection) => void;
  setView: (v: ViewMode) => void;
  toggleTheme: () => void;
  setSidebarTab: (t: SidebarTab) => void;
  setZoom: (z: number) => void;
  setCursor: (c: Cursor | null) => void;
  sendViewCommand: (cmd: ViewCommand) => void;
  /** Take the pending command for `view` if it hasn't handled it yet (and mark it handled). */
  claimViewCommand: (view: ViewMode) => ViewCommand | null;
  /** Also mirrors the scale into `zoom` for the status bar. */
  setPlanViewport: (vp: Viewport | null) => void;
  setCameraPose: (pose: CameraPose) => void;
  setActivePreset: (preset: CameraPreset | null) => void;
  addUserPreset: (preset: Preset) => void;
  removeUserPreset: (id: string) => void;
  setShowShortcuts: (show: boolean) => void;
  setFixPreview: (fix: TriangleFix | null) => void;
  setSpeakerFitMode: (mode: SpeakerFitMode) => void;
}

/**
 * The app store: the layout document (with undo history), UI state and view state. Creating it
 * has no side effects; `initStore()` (store/init.ts) loads saved data and starts autosave.
 */
export const useStore = create<AppState>()((set, get) => ({
  history: H.createHistory(createDefaultLayout()),
  selection: null,
  view: '2d',
  theme: 'dark',
  sidebarTab: 'scene',
  zoom: 1,
  cursor: null,
  viewCommand: null,
  handledSeq: { '2d': 0, '3d': 0 },
  planViewport: null,
  cameraPose: null,
  activePreset: null,
  userPresets: [],
  showShortcuts: false,
  fixPreview: null,
  speakerFitMode: 'distance',

  apply: (recipe) => set((s) => ({ history: H.commit(s.history, recipe(s.history.present)) })),
  beginTx: () => set((s) => ({ history: H.beginTx(s.history) })),
  endTx: () => set((s) => ({ history: H.endTx(s.history) })),
  cancelTx: () => set((s) => ({ history: H.cancelTx(s.history) })),
  undo: () => set((s) => ({ history: H.undo(s.history) })),
  redo: () => set((s) => ({ history: H.redo(s.history) })),
  // A new layout is framed afresh by the plan view the next time it renders.
  replaceLayout: (layout) => set({ history: H.createHistory(layout), selection: null, planViewport: null }),

  select: (selection) => set({ selection }),
  setView: (view) => set({ view }),
  toggleTheme: () =>
    set((s) => {
      const theme: Theme = s.theme === 'dark' ? 'light' : 'dark';
      saveTheme(theme);
      return { theme };
    }),
  setSidebarTab: (sidebarTab) => set({ sidebarTab }),
  setZoom: (zoom) => set({ zoom }),
  setCursor: (cursor) => set({ cursor }),
  sendViewCommand: (cmd) =>
    set((s) => ({
      viewCommand: { seq: (s.viewCommand?.seq ?? 0) + 1, cmd },
      activePreset: cmd.kind === 'camera' && cmd.preset !== 'fit' ? cmd.preset : s.activePreset,
    })),
  claimViewCommand: (view) => {
    const { viewCommand, handledSeq } = get();
    if (!viewCommand || viewCommand.seq <= handledSeq[view] || commandView(viewCommand.cmd) !== view) return null;
    set({ handledSeq: { ...handledSeq, [view]: viewCommand.seq } });
    return viewCommand.cmd;
  },
  setPlanViewport: (planViewport) => set(planViewport ? { planViewport, zoom: planViewport.scale } : { planViewport }),
  setCameraPose: (cameraPose) => set({ cameraPose }),
  setActivePreset: (activePreset) => set({ activePreset }),
  addUserPreset: (preset) =>
    set((s) => {
      const userPresets = [...s.userPresets, preset];
      saveUserPresets(userPresets);
      return { userPresets };
    }),
  removeUserPreset: (id) =>
    set((s) => {
      const userPresets = s.userPresets.filter((p) => p.id !== id);
      saveUserPresets(userPresets);
      return { userPresets };
    }),
  setShowShortcuts: (showShortcuts) => set({ showShortcuts }),
  setFixPreview: (fixPreview) => set({ fixPreview }),
  setSpeakerFitMode: (speakerFitMode) => set({ speakerFitMode }),
}));

/** Current layout selector. */
export const useLayout = (): Layout => useStore((s) => s.history.present);
