import { describe, expect, it } from 'vitest';
import { createDefaultLayout } from '../model/defaults';
import { migrateLayout } from '../model/migrate';
import { renameLayout, updateInstance } from '../model/ops';
import { isSaved, removeSaved, upsertSaved } from './savedLayouts';

describe('saved layouts', () => {
  it('saves, replaces by id (most recent first) and removes', () => {
    const a = createDefaultLayout('A');
    const b = createDefaultLayout('B');
    let list = upsertSaved([], a, '2026-01-01T00:00:00Z');
    list = upsertSaved(list, b, '2026-01-02T00:00:00Z');
    list = upsertSaved(list, renameLayout(a, 'A2'), '2026-01-03T00:00:00Z');
    expect(list.map((s) => s.layout.name)).toEqual(['A2', 'B']);
    expect(removeSaved(list, b.id).map((s) => s.layout.name)).toEqual(['A2']);
  });

  it('keeps a snapshot, not a live reference', () => {
    const a = createDefaultLayout();
    const list = upsertSaved([], a, 'now');
    expect(list[0]!.layout).not.toBe(a);
    expect(list[0]!.layout).toEqual(a);
  });

  it('knows whether the current layout matches its saved copy', () => {
    const a = createDefaultLayout();
    const list = upsertSaved([], a, 'now');
    expect(isSaved(list, a)).toBe(true);
    expect(isSaved(list, renameLayout(a, 'Changed'))).toBe(false);
    expect(isSaved([], a)).toBe(false);
    expect(isSaved(list, createDefaultLayout())).toBe(false);
  });

  it('treats a reloaded layout (keys reordered by validation) as unchanged', () => {
    const a = createDefaultLayout();
    const kb = a.instances[1]!;
    // An unlinked pair leaves pairId: undefined, which JSON drops.
    const edited = updateInstance(a, kb.id, { pairId: undefined, label: 'KB' });
    const list = upsertSaved([], edited, 'now');
    const reloaded = migrateLayout(JSON.parse(JSON.stringify(edited)));
    expect(reloaded.ok).toBe(true);
    if (reloaded.ok) expect(isSaved(list, reloaded.layout)).toBe(true);
  });
});
