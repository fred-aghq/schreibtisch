import { migrateLayout } from '../model/migrate';
import { parseWith, PresetSchema } from '../model/schema';
import type { Layout } from '../model/types';
import type { Preset } from '../model/presets';
import type { SavedLayout } from './savedLayouts';
import type { Theme } from './store';

/**
 * Builds a localStorage key. PR preview builds set VITE_STORAGE_NAMESPACE (e.g. "pr-12")
 * because they share the github.io origin with production; namespacing keeps a preview
 * from reading or overwriting the production data. Production keys are unchanged.
 */
export function storageKey(name: string, namespace: string | undefined = import.meta.env.VITE_STORAGE_NAMESPACE): string {
  return namespace ? `schreibtisch@${namespace}:${name}` : `schreibtisch:${name}`;
}

const CURRENT_KEY = storageKey('current-layout');
const THEME_KEY = storageKey('theme');
const PRESETS_KEY = storageKey('presets');
const SAVED_KEY = storageKey('saved-layouts');
const ONBOARDED_KEY = storageKey('onboarded');

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

/** Saved layouts, each validated (and migrated) on load; invalid entries are skipped. */
export function loadSavedLayouts(): SavedLayout[] {
  try {
    const raw = storage()?.getItem(SAVED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry: unknown) => {
      if (typeof entry !== 'object' || entry === null) return [];
      const { layout, savedAt } = entry as { layout?: unknown; savedAt?: unknown };
      const r = migrateLayout(layout);
      if (!r.ok) {
        console.warn('Ignoring a saved layout:', r.errors);
        return [];
      }
      return [{ layout: r.layout, savedAt: typeof savedAt === 'string' ? savedAt : '' }];
    });
  } catch (e) {
    console.warn('Could not read saved layouts', e);
    return [];
  }
}

export function saveSavedLayouts(list: readonly SavedLayout[]): boolean {
  try {
    storage()?.setItem(SAVED_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    console.warn('Could not save layouts', e);
    return false;
  }
}

/** True if this browser has any Schreibtisch data at all (for this build's storage namespace). */
export function hasStoredData(): boolean {
  try {
    const s = storage();
    if (!s) return false;
    const prefix = storageKey('');
    for (let i = 0; i < s.length; i++) if (s.key(i)?.startsWith(prefix)) return true;
    return false;
  } catch {
    return false;
  }
}

/** Remember that the setup wizard has been shown, so it doesn't open by itself again. */
export function markOnboarded(): void {
  try {
    storage()?.setItem(ONBOARDED_KEY, '1');
  } catch {
    /* ignore */
  }
}
