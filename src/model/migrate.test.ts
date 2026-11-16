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

describe('migrateLayout: schema details', () => {
  const raw = () => JSON.parse(JSON.stringify(createDefaultLayout()));
  const errorsOf = (input: unknown) => {
    const r = migrateLayout(input);
    return r.ok ? [] : r.errors;
  };

  it('validates settings', () => {
    const l = raw();
    l.settings.snapStep = 7;
    l.settings.showGrid = 'yes';
    l.settings.tolerances.angleWarn = -1;
    const errors = errorsOf(l);
    expect(errors).toContain('settings.snapStep: must be one of 1, 5, 10, 50');
    expect(errors).toContain('settings.showGrid: must be true or false');
    expect(errors.some((e) => e.startsWith('settings.tolerances.angleWarn:'))).toBe(true);
  });

  it('fills missing settings and keeps the ones present', () => {
    const l = raw();
    l.settings = { gridSpacing: 50 };
    const r = migrateLayout(l);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.layout.settings.gridSpacing).toBe(50);
      expect(r.layout.settings.mirrorPairs).toBe(true);
    }
  });

  it('validates monitor and speaker extras', () => {
    const l = raw();
    const monitor = Object.values(l.definitions as Record<string, { category: string; monitor?: unknown; speaker?: unknown }>).find((d) => d.category === 'monitor')!;
    monitor.monitor = { diagonalIn: 34, aspect: '4:3', support: 'shelf', stand: { w: 250, d: 0, h: 100 } };
    const speaker = Object.values(l.definitions as Record<string, { category: string; speaker?: unknown }>).find((d) => d.category === 'speaker')!;
    speaker.speaker = { acousticCentreHeight: 'high', rearPorted: true };
    const errors = errorsOf(l);
    expect(errors.some((e) => e.endsWith('.monitor.aspect: must be one of "16:9", "16:10", "21:9", "32:9"'))).toBe(true);
    expect(errors.some((e) => e.endsWith('.monitor.support: must be one of "stand", "mount"'))).toBe(true);
    expect(errors.some((e) => e.endsWith('.monitor.stand.d: must be a positive number'))).toBe(true);
    expect(errors.some((e) => e.endsWith('.speaker.acousticCentreHeight: must be a number'))).toBe(true);
  });

  it('accepts a monitor on a stand', () => {
    const l = raw();
    const monitor = Object.values(l.definitions as Record<string, { category: string; monitor?: unknown }>).find((d) => d.category === 'monitor')!;
    monitor.monitor = { diagonalIn: 34, aspect: '21:9', bezelMm: 8, support: 'stand', stand: { w: 250, d: 200, h: 100 } };
    expect(migrateLayout(l).ok).toBe(true);
  });

  it('reports missing fields and a definition stored under the wrong key', () => {
    const l = raw();
    delete l.listener.earHeightFromFloor;
    const [key, def] = Object.entries(l.definitions as Record<string, { id: string }>)[0]!;
    def.id = 'other';
    const errors = errorsOf(l);
    expect(errors).toContain('listener.earHeightFromFloor: missing');
    expect(errors).toContain(`definitions.${key}: id does not match its key`);
  });

  it('drops unknown fields', () => {
    const l = raw();
    l.extra = 'x';
    l.instances[0].sparkle = true;
    const r = migrateLayout(l);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect('extra' in r.layout).toBe(false);
      expect('sparkle' in r.layout.instances[0]!).toBe(false);
    }
  });
});
