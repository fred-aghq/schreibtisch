import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultLayout } from '../model/defaults';
import { loadCurrentLayout, loadUserPresets, storageKey } from './persistence';

describe('persistence', () => {
  let data: Map<string, string>;

  beforeEach(() => {
    data = new Map();
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps valid user presets and drops invalid ones', () => {
    data.set(
      'schreibtisch:presets',
      JSON.stringify([
        { id: 'a', name: 'Measured speaker', category: 'speaker', size: { w: 210, d: 293, h: 347 }, speaker: { acousticCentreHeight: 290, rearPorted: true }, approx: false, group: 'My presets' },
        { id: 'b', name: 'Broken', category: 'speaker', size: { w: -1, d: 2, h: 3 } },
        { id: 'c', name: 'Unknown category', category: 'spaceship', size: { w: 1, d: 2, h: 3 } },
        // Older entries without approx/group still load.
        { id: 'd', name: 'Old box', category: 'other', size: { w: 1, d: 2, h: 3 } },
        'nonsense',
      ]),
    );
    const presets = loadUserPresets();
    expect(presets.map((p) => p.id)).toEqual(['a', 'd']);
    expect(presets.every((p) => p.group === 'My presets')).toBe(true);
    expect(presets[1]!.approx).toBe(false);
  });

  it('returns no presets for unreadable data', () => {
    data.set('schreibtisch:presets', '{not json');
    expect(loadUserPresets()).toEqual([]);
  });

  it('ignores a saved layout that fails validation', () => {
    const l = JSON.parse(JSON.stringify(createDefaultLayout()));
    l.desk.depth = 'deep';
    data.set('schreibtisch:current-layout', JSON.stringify(l));
    expect(loadCurrentLayout()).toBeNull();
    data.set('schreibtisch:current-layout', JSON.stringify(createDefaultLayout()));
    expect(loadCurrentLayout()).not.toBeNull();
  });

  it('namespaces keys only when a storage namespace is set', () => {
    expect(storageKey('theme', undefined)).toBe('schreibtisch:theme');
    expect(storageKey('theme', '')).toBe('schreibtisch:theme');
    expect(storageKey('theme', 'pr-12')).toBe('schreibtisch@pr-12:theme');
  });
});
