import { describe, expect, it } from 'vitest';
import { createDefaultLayout } from './defaults';
import { migrateLayout } from './migrate';
import { SCHEMA_VERSION } from './types';

describe('migrateLayout', () => {
  it('accepts a current layout unchanged', () => {
    const l = createDefaultLayout();
    const r = migrateLayout(JSON.parse(JSON.stringify(l)));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.layout).toEqual(l);
  });

  it('upgrades unversioned data and fills defaults', () => {
    const l = createDefaultLayout();
    const raw = JSON.parse(JSON.stringify(l));
    delete raw.schemaVersion;
    delete raw.settings.tolerances;
    delete raw.backWall;
    delete raw.instances[0].locked;
    const r = migrateLayout(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.layout.schemaVersion).toBe(SCHEMA_VERSION);
      expect(r.layout.settings.tolerances.angleGood).toBe(2);
      expect(r.layout.backWall).toBeNull();
      expect(r.layout.instances[0]!.locked).toBe(false);
    }
  });

  it('rejects newer schemas with a friendly message', () => {
    const r = migrateLayout({ ...createDefaultLayout(), schemaVersion: 999 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/newer version/);
  });

  it('rejects garbage with readable errors', () => {
    expect(migrateLayout('hello').ok).toBe(false);
    const raw = JSON.parse(JSON.stringify(createDefaultLayout()));
    raw.desk.width = -5;
    raw.instances[0].definitionId = 'missing';
    const r = migrateLayout(raw);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.includes('desk.width'))).toBe(true);
      expect(r.errors.some((e) => e.includes('unknown definition'))).toBe(true);
    }
  });
});
