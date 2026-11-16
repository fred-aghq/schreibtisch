import { debounce } from '../lib/debounce';
import { createHistory } from './history';
import { hasStoredData, loadCurrentLayout, loadSavedLayouts, loadTheme, loadUserPresets, saveCurrentLayout } from './persistence';
import { useStore } from './store';

export const AUTOSAVE_MS = 400;

/**
 * Load the saved layout, theme, user presets and saved layouts into the store. In a fresh browser
 * (no Schreibtisch data at all) the setup wizard opens. Then autosave then autosave the layout
 * (debounced) whenever it changes. Pending saves are flushed when the page is hidden or closed,
 * so a quick reload never loses the last edit. Returns a function that undoes the wiring.
 */
export function initStore(): () => void {
  // Check before anything below can write to storage.
  const freshBrowser = !hasStoredData();
  const saved = loadCurrentLayout();
  useStore.setState({
    savedLayouts: loadSavedLayouts(),
    wizardOpen: freshBrowser,
    ...(saved ? { history: createHistory(saved), selection: null } : {}),
    theme: loadTheme(),
    userPresets: loadUserPresets(),
  });

  const autosave = debounce(saveCurrentLayout, AUTOSAVE_MS);
  const unsubscribe = useStore.subscribe((state, prev) => {
    if (state.history.present !== prev.history.present) autosave(state.history.present);
  });

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') autosave.flush();
  };
  const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';
  if (hasDom) {
    window.addEventListener('pagehide', autosave.flush);
    document.addEventListener('visibilitychange', onVisibility);
  }
  return () => {
    unsubscribe();
    if (hasDom) {
      window.removeEventListener('pagehide', autosave.flush);
      document.removeEventListener('visibilitychange', onVisibility);
    }
    autosave.flush();
  };
}
