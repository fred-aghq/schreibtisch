import { CATEGORIES, SCHEMA_VERSION } from './types';
import type { Layout } from './types';

/**
 * Structural validation of a (migrated) layout. Returns a list of friendly error strings;
 * empty means valid. Kept hand-written to avoid a schema-library dependency.
 */
export function validateLayout(value: unknown): string[] {
  const errors: string[] = [];
  const err = (path: string, msg: string): void => {
    errors.push(`${path}: ${msg}`);
  };

  if (!isObj(value)) return ['The file does not contain a layout object.'];
  if (value.schemaVersion !== SCHEMA_VERSION) err('schemaVersion', `expected ${SCHEMA_VERSION}`);
  if (typeof value.id !== 'string') err('id', 'missing');
  if (typeof value.name !== 'string') err('name', 'missing');

  const desk = value.desk;
  if (!isObj(desk)) err('desk', 'missing');
  else {
    for (const k of ['width', 'depth', 'thickness', 'heightFromFloor'] as const) positive(desk[k], `desk.${k}`, err);
    if (typeof desk.colour !== 'string') err('desk.colour', 'must be a colour string');
  }

  if (value.backWall !== null && value.backWall !== undefined) {
    if (!isObj(value.backWall) || !isNum(value.backWall.distanceBehindDesk)) err('backWall', 'invalid');
  }

  const listener = value.listener;
  if (!isObj(listener)) err('listener', 'missing');
  else for (const k of ['x', 'distanceFromFrontEdge', 'earHeightFromFloor'] as const) num(listener[k], `listener.${k}`, err);

  const defs = value.definitions;
  if (!isObj(defs)) err('definitions', 'missing');
  else {
    for (const [id, d] of Object.entries(defs)) {
      const p = `definition "${id}"`;
      if (!isObj(d)) {
        err(p, 'invalid');
        continue;
      }
      if (d.id !== id) err(p, 'id does not match its key');
      if (typeof d.name !== 'string') err(p, 'name missing');
      if (typeof d.category !== 'string' || !(CATEGORIES as readonly string[]).includes(d.category)) err(p, 'unknown category');
      if (d.shape !== 'box' && d.shape !== 'cylinder') err(p, 'shape must be box or cylinder');
      if (!isObj(d.size)) err(p, 'size missing');
      else for (const k of ['w', 'd', 'h'] as const) positive(d.size[k], `${p}.size.${k}`, err);
      if (d.speaker !== undefined) {
        if (!isObj(d.speaker) || !isNum(d.speaker.acousticCentreHeight) || typeof d.speaker.rearPorted !== 'boolean') err(p, 'speaker extras invalid');
      }
    }
  }

  if (!Array.isArray(value.instances)) err('instances', 'must be a list');
  else {
    value.instances.forEach((inst: unknown, i: number) => {
      const p = `instances[${i}]`;
      if (!isObj(inst)) {
        err(p, 'invalid');
        return;
      }
      if (typeof inst.id !== 'string') err(p, 'id missing');
      if (typeof inst.definitionId !== 'string') err(p, 'definitionId missing');
      else if (isObj(defs) && !(inst.definitionId in defs)) err(p, `refers to unknown definition "${inst.definitionId}"`);
      if (!isObj(inst.position)) err(p, 'position missing');
      else for (const k of ['x', 'y', 'z'] as const) num(inst.position[k], `${p}.position.${k}`, err);
      if (!isObj(inst.rotation)) err(p, 'rotation missing');
      else for (const k of ['yaw', 'pitch'] as const) num(inst.rotation[k], `${p}.rotation.${k}`, err);
      if (inst.role !== null && inst.role !== 'speakerL' && inst.role !== 'speakerR') err(p, 'role invalid');
    });
  }

  if (!isObj(value.settings)) err('settings', 'missing');
  return errors;
}

export function isLayout(value: unknown): value is Layout {
  return validateLayout(value).length === 0;
}

type Obj = Record<string, unknown>;
function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function num(v: unknown, path: string, err: (p: string, m: string) => void): void {
  if (!isNum(v)) err(path, 'must be a number');
}
function positive(v: unknown, path: string, err: (p: string, m: string) => void): void {
  if (!isNum(v) || v <= 0) err(path, 'must be a positive number');
}
