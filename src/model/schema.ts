import { z } from 'zod';
import { PRESET_GROUPS } from './presets';
import type { Preset } from './presets';
import { CATEGORIES, SCHEMA_VERSION } from './types';
import type {
  BackWall,
  Desk,
  Layout,
  Listener,
  MonitorExtras,
  ObjectDefinition,
  ObjectInstance,
  Settings,
  Size,
  SpeakerExtras,
  Tolerances,
} from './types';

/**
 * Runtime schemas for saved and imported data. Each is typed as `z.ZodType<T>` against the model
 * type, so if the schema and the TypeScript types drift apart it's a compile error.
 */

const num = z.number();
const positive = z.number().positive();
const vec3 = z.object({ x: num, y: num, z: num });

export const SizeSchema: z.ZodType<Size> = z.object({ w: positive, d: positive, h: positive });

export const SpeakerExtrasSchema: z.ZodType<SpeakerExtras> = z.object({
  acousticCentreHeight: num,
  rearPorted: z.boolean(),
});

export const MonitorExtrasSchema: z.ZodType<MonitorExtras> = z.object({
  diagonalIn: positive.optional(),
  aspect: z.enum(['16:9', '16:10', '21:9', '32:9']).optional(),
  bezelMm: z.number().nonnegative().optional(),
  support: z.enum(['stand', 'mount']),
  stand: SizeSchema.optional(),
});

export const DefinitionSchema: z.ZodType<ObjectDefinition> = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(CATEGORIES),
  size: SizeSchema,
  colour: z.string(),
  shape: z.enum(['box', 'cylinder']),
  speaker: SpeakerExtrasSchema.optional(),
  monitor: MonitorExtrasSchema.optional(),
  approx: z.boolean().optional(),
});

export const InstanceSchema: z.ZodType<ObjectInstance> = z.object({
  id: z.string(),
  definitionId: z.string(),
  label: z.string(),
  position: vec3,
  rotation: z.object({ yaw: num, pitch: num }),
  locked: z.boolean(),
  visible: z.boolean(),
  role: z.enum(['speakerL', 'speakerR']).nullable(),
  pairId: z.string().optional(),
});

export const DeskSchema: z.ZodType<Desk> = z.object({
  width: positive,
  depth: positive,
  thickness: positive,
  heightFromFloor: positive,
  colour: z.string(),
});

export const BackWallSchema: z.ZodType<BackWall> = z.object({ distanceBehindDesk: num });

export const ListenerSchema: z.ZodType<Listener> = z.object({
  x: num,
  distanceFromFrontEdge: num,
  earHeightFromFloor: num,
});

export const TolerancesSchema: z.ZodType<Tolerances> = z.object({
  angleGood: z.number().nonnegative(),
  angleWarn: z.number().nonnegative(),
  distGood: z.number().nonnegative(),
  distWarn: z.number().nonnegative(),
});

export const SettingsSchema: z.ZodType<Settings> = z.object({
  gridSpacing: positive,
  showGrid: z.boolean(),
  snapEnabled: z.boolean(),
  snapStep: z.literal([1, 5, 10, 50]),
  showFloor: z.boolean(),
  showTriangle: z.boolean(),
  showGuides: z.boolean(),
  mirrorPairs: z.boolean(),
  aimOffset: num,
  tolerances: TolerancesSchema,
});

export const LayoutSchema: z.ZodType<Layout> = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string(),
  name: z.string(),
  desk: DeskSchema,
  backWall: BackWallSchema.nullable(),
  listener: ListenerSchema,
  definitions: z.record(z.string(), DefinitionSchema),
  instances: z.array(InstanceSchema),
  settings: SettingsSchema,
});

export const PresetSchema: z.ZodType<Preset> = z.object({
  id: z.string(),
  group: z.enum(PRESET_GROUPS),
  name: z.string(),
  category: z.enum(CATEGORIES),
  size: SizeSchema,
  shape: z.enum(['box', 'cylinder']).optional(),
  colour: z.string().optional(),
  speaker: SpeakerExtrasSchema.optional(),
  monitor: MonitorExtrasSchema.optional(),
  placement: z.enum(['desk', 'floor', 'mount']).optional(),
  elevation: num.optional(),
  approx: z.boolean(),
});

/** Plain-language messages for schema issues (paths are added by `formatIssues`). */
function friendlyMessage(issue: z.core.$ZodRawIssue): string | undefined {
  switch (issue.code) {
    case 'invalid_type':
      if (issue.input === undefined) return 'missing';
      if (issue.expected === 'number') return 'must be a number';
      if (issue.expected === 'string') return 'must be text';
      if (issue.expected === 'boolean') return 'must be true or false';
      if (issue.expected === 'array') return 'must be a list';
      return 'invalid';
    case 'too_small':
      return issue.minimum === 0 && !issue.inclusive ? 'must be a positive number' : `must be at least ${String(issue.minimum)}`;
    case 'invalid_value':
      return `must be one of ${issue.values.map((v) => JSON.stringify(v)).join(', ')}`;
    default:
      return undefined;
  }
}

function formatPath(path: readonly PropertyKey[]): string {
  let out = '';
  for (const seg of path) {
    if (typeof seg === 'number') out += `[${seg}]`;
    else out += out ? `.${String(seg)}` : String(seg);
  }
  return out;
}

/** Validate against a schema, returning the value or friendly `path: message` errors. */
export function parseWith<T>(schema: z.ZodType<T>, value: unknown): { ok: true; value: T } | { ok: false; errors: string[] } {
  const r = schema.safeParse(value, { error: friendlyMessage });
  if (r.success) return { ok: true, value: r.data };
  return { ok: false, errors: r.error.issues.map((i) => (i.path.length ? `${formatPath(i.path)}: ${i.message}` : i.message)) };
}
