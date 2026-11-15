import { DEFAULT_SETTINGS } from './defaults';
import { SCHEMA_VERSION } from './types';
import type { Layout } from './types';
import { validateLayout } from './validate';

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
  const errors = validateLayout(raw);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, layout: raw as unknown as Layout };
}

/** Fill optional / later-added fields so older files keep working. */
function fillDefaults(raw: Raw): Raw {
  const settingsIn = typeof raw.settings === 'object' && raw.settings !== null ? (raw.settings as Raw) : {};
  const tolerancesIn =
    typeof settingsIn.tolerances === 'object' && settingsIn.tolerances !== null ? (settingsIn.tolerances as Raw) : {};
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
          typeof i === 'object' && i !== null
            ? { locked: false, visible: true, role: null, rotation: { yaw: 0, pitch: 0 }, ...(i as Raw) }
            : i,
        )
      : raw.instances,
  };
}
