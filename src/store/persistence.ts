import { migrateLayout } from '../model/migrate';
import { CATEGORIES } from '../model/types';
import type { Layout } from '../model/types';
import type { Preset } from '../model/presets';

const CURRENT_KEY = 'schreibtisch:current-layout';
const THEME_KEY = 'schreibtisch:theme';
const PRESETS_KEY = 'schreibtisch:presets';

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

function isPreset(v: unknown): v is Preset {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  const size = p.size as Record<string, unknown> | undefined;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.category === 'string' &&
    (CATEGORIES as readonly string[]).includes(p.category) &&
    typeof size === 'object' &&
    size !== null &&
    ['w', 'd', 'h'].every((k) => typeof size[k] === 'number' && (size[k] as number) > 0)
  );
}

export function loadUserPresets(): Preset[] {
  try {
    const raw = storage()?.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPreset).map((p) => ({ ...p, group: 'My presets' as const })) : [];
  } catch {
    return [];
  }
}

export function saveUserPresets(presets: readonly Preset[]): void {
  try {
    storage()?.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch (e) {
    console.warn('Could not save presets', e);
  }
}
