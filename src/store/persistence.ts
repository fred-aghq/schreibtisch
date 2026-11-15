import { migrateLayout } from '../model/migrate';
import type { Layout } from '../model/types';

const CURRENT_KEY = 'schreibtisch:current-layout';
const THEME_KEY = 'schreibtisch:theme';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadCurrentLayout(): Layout | null {
  try {
    const raw = storage()?.getItem(CURRENT_KEY);
    if (!raw) return null;
    const result = migrateLayout(JSON.parse(raw));
    if (result.ok) return result.layout;
    console.warn('Ignoring saved layout:', result.errors);
    return null;
  } catch (e) {
    console.warn('Could not read saved layout', e);
    return null;
  }
}

export function saveCurrentLayout(layout: Layout): void {
  try {
    storage()?.setItem(CURRENT_KEY, JSON.stringify(layout));
  } catch (e) {
    console.warn('Could not save layout', e);
  }
}

export type Theme = 'dark' | 'light';

export function loadTheme(): Theme {
  try {
    return storage()?.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function saveTheme(theme: Theme): void {
  try {
    storage()?.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}

export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  /** Run any pending call immediately. */
  flush: () => void;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let t: ReturnType<typeof setTimeout> | undefined;
  let pending: A | null = null;
  const run = () => {
    if (t !== undefined) clearTimeout(t);
    t = undefined;
    if (pending) {
      const args = pending;
      pending = null;
      fn(...args);
    }
  };
  const d = (...args: A) => {
    pending = args;
    if (t !== undefined) clearTimeout(t);
    t = setTimeout(run, ms);
  };
  d.flush = run;
  return d;
}
