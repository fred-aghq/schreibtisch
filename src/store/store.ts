import { create } from 'zustand';
import { createDefaultLayout } from '../model/defaults';
import type { Layout } from '../model/types';
import * as H from './history';
import { debounce, loadCurrentLayout, loadTheme, saveCurrentLayout, saveTheme } from './persistence';
import type { Theme } from './persistence';

export type Selection = { kind: 'instance'; id: string } | { kind: 'listener' } | null;
export type ViewMode = '2d' | '3d';
export type SidebarTab = 'library' | 'scene';

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
  /** Monotonic counter; plan view zooms to fit whenever it changes. */
  fitRequest: number;
  /** Absolute zoom request (e.g. 1 for 100 %); handled and cleared by the plan view. */
  zoomRequest: number | null;

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
  requestFit: () => void;
  requestZoom: (scale: number | null) => void;
}

const initialLayout = loadCurrentLayout() ?? createDefaultLayout();

export const useStore = create<AppState>()((set) => ({
  history: H.createHistory(initialLayout),
  selection: null,
  view: '2d',
  theme: loadTheme(),
  sidebarTab: 'scene',
  zoom: 1,
  cursor: null,
  fitRequest: 0,
  zoomRequest: null,

  apply: (recipe) => set((s) => ({ history: H.commit(s.history, recipe(s.history.present)) })),
  beginTx: () => set((s) => ({ history: H.beginTx(s.history) })),
  endTx: () => set((s) => ({ history: H.endTx(s.history) })),
  cancelTx: () => set((s) => ({ history: H.cancelTx(s.history) })),
  undo: () => set((s) => ({ history: H.undo(s.history) })),
  redo: () => set((s) => ({ history: H.redo(s.history) })),
  replaceLayout: (layout) => set({ history: H.createHistory(layout), selection: null }),

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
  requestFit: () => set((s) => ({ fitRequest: s.fitRequest + 1 })),
  requestZoom: (zoomRequest) => set({ zoomRequest }),
}));

/** Current layout selector. */
export const useLayout = (): Layout => useStore((s) => s.history.present);

// Debounced autosave whenever the layout changes.
const autosave = debounce(saveCurrentLayout, 400);
useStore.subscribe((state, prev) => {
  if (state.history.present !== prev.history.present) autosave(state.history.present);
});
// Never lose the last edit to a quick reload or tab close.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', autosave.flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') autosave.flush();
  });
}
