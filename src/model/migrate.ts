import { DEFAULT_SETTINGS } from './defaults';
import { SCHEMA_VERSION } from './types';
import type { Layout } from './types';
import { LayoutSchema, parseWith } from './schema';

export type MigrationResult = { ok: true; layout: Layout } | { ok: false; errors: string[] };

type Raw = Record<string, unknown>;

/**
 * Ordered migrations: MIGRATIONS[n] upgrades a layout from version n to n + 1.
 * Version 0 means "pre-release / unversioned" data.
 */
const MIGRATIONS: Record<number, (raw: Raw) => Raw> = {
  0: (raw) => ({ ...raw, schemaVersion: 1 }),
};

/** Upgrade any known older layout to the current schema, fill defaults, then validate. */
export function migrateLayout(input: unknown): MigrationResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: ['The file does not contain a layout object.'] };
  }
  let raw: Raw = { ...(input as Raw) };
  let version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;
  if (version > SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [`This layout was saved by a newer version of Schreibtisch (schema ${version}). Please update the app.`],
    };
  }
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return { ok: false, errors: [`No migration from schema version ${version}.`] };
    raw = step(raw);
    version++;
  }
  raw = fillDefaults(raw);
  const parsed = parseWith(LayoutSchema, raw);
  // Reference checks run on the raw data too, so one import reports every problem at once.
  const errors = [...(parsed.ok ? [] : parsed.errors), ...referenceErrors(raw)];
  if (errors.length > 0 || !parsed.ok) return { ok: false, errors };
  return { ok: true, layout: parsed.value };
}

function isObj(v: unknown): v is Raw {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Every instance must point at an existing definition, and definitions are keyed by their id. */
function referenceErrors(raw: Raw): string[] {
  const errors: string[] = [];
  const defs = isObj(raw.definitions) ? raw.definitions : null;
  if (defs) {
    for (const [key, def] of Object.entries(defs)) {
      if (isObj(def) && typeof def.id === 'string' && def.id !== key) errors.push(`definitions.${key}: id does not match its key`);
    }
  }
  if (defs && Array.isArray(raw.instances)) {
    raw.instances.forEach((inst: unknown, i: number) => {
      if (isObj(inst) && typeof inst.definitionId === 'string' && !(inst.definitionId in defs)) {
        errors.push(`instances[${i}]: refers to unknown definition "${inst.definitionId}"`);
      }
    });
  }
  return errors;
}

/** Fill optional / later-added fields so older files keep working. */
function fillDefaults(raw: Raw): Raw {
  const settingsIn = isObj(raw.settings) ? raw.settings : {};
  const tolerancesIn = isObj(settingsIn.tolerances) ? settingsIn.tolerances : {};
  return {
    ...raw,
    backWall: raw.backWall ?? null,
    settings: {
      ...DEFAULT_SETTINGS,
      ...settingsIn,
      tolerances: { ...DEFAULT_SETTINGS.tolerances, ...tolerancesIn },
    },
    instances: Array.isArray(raw.instances)
      ? raw.instances.map((i: unknown) =>
          isObj(i) ? { locked: false, visible: true, role: null, rotation: { yaw: 0, pitch: 0 }, ...i } : i,
        )
      : raw.instances,
  };
}
