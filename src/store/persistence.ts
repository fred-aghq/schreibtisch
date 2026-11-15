import { migrateLayout } from '../model/migrate';
import { parseWith, PresetSchema } from '../model/schema';
import type { Layout } from '../model/types';
import type { Preset } from '../model/presets';
import type { Theme } from './store';

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

export function loadUserPresets(): Preset[] {
  try {
    const raw = storage()?.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Skip anything that doesn't validate rather than losing every preset to one bad entry.
    return parsed.flatMap((p: unknown) => {
      const r = parseWith(PresetSchema, typeof p === 'object' && p !== null ? { approx: false, ...p, group: 'My presets' } : p);
      return r.ok ? [r.value] : [];
    });
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
