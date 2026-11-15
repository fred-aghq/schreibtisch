import type { Vec3 } from '../geometry/vec';

export const CATEGORIES = [
  'monitor',
  'speaker',
  'light',
  'keyboard',
  'mouse',
  'mat',
  'laptop',
  'pc',
  'audio-interface',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export type Shape = 'box' | 'cylinder';

/** Sizes are in mm: w = Width (X), d = Depth (Z), h = Height (Y). */
export interface Size {
  w: number;
  d: number;
  h: number;
}

export interface SpeakerExtras {
  /** mm from the cabinet base to the tweeter / acoustic axis. */
  acousticCentreHeight: number;
  rearPorted: boolean;
}

export type AspectRatio = '16:9' | '16:10' | '21:9' | '32:9';

export interface MonitorExtras {
  diagonalIn?: number;
  aspect?: AspectRatio;
  bezelMm?: number;
  support: 'stand' | 'mount';
  /** Optional stand box (footprint and height in mm), used when support = 'stand'. */
  stand?: Size;
}

export interface ObjectDefinition {
  id: string;
  name: string;
  category: Category;
  size: Size;
  colour: string;
  shape: Shape;
  speaker?: SpeakerExtras;
  monitor?: MonitorExtras;
  /** Built-in defaults are approximate: "measure yours". */
  approx?: boolean;
}

export type SpeakerRole = 'speakerL' | 'speakerR';

export interface Rotation {
  /** Degrees about the vertical axis. 0 = front faces the user (+Z). */
  yaw: number;
  /** Degrees of tilt; positive tips the front upward. */
  pitch: number;
}

export interface ObjectInstance {
  id: string;
  definitionId: string;
  label: string;
  /** Bottom-centre of the footprint, mm. y = elevation above the desk top (0 = on the desk). */
  position: Vec3;
  rotation: Rotation;
  locked: boolean;
  visible: boolean;
  role: SpeakerRole | null;
  pairId?: string;
}

export interface Desk {
  width: number;
  depth: number;
  thickness: number;
  /** Floor to the desk's top surface, mm. */
  heightFromFloor: number;
  colour: string;
}

export interface BackWall {
  /** Gap between the desk's back edge and the wall, mm. */
  distanceBehindDesk: number;
}

export interface Listener {
  /** Left–right offset of the head centre from the desk centreline, mm. */
  x: number;
  /** Desk front edge → centre of the head, mm. */
  distanceFromFrontEdge: number;
  earHeightFromFloor: number;
}

export type GridStep = 1 | 5 | 10 | 50;

export interface Tolerances {
  angleGood: number;
  angleWarn: number;
  distGood: number;
  distWarn: number;
}

export interface Settings {
  gridSpacing: number;
  showGrid: boolean;
  snapEnabled: boolean;
  snapStep: GridStep;
  showFloor: boolean;
  showTriangle: boolean;
  showGuides: boolean;
  mirrorPairs: boolean;
  /** Aim point offset behind the head centre (+ = further from the desk), mm. */
  aimOffset: number;
  tolerances: Tolerances;
}

export const SCHEMA_VERSION = 1;

export interface Layout {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  name: string;
  desk: Desk;
  backWall: BackWall | null;
  listener: Listener;
  definitions: Record<string, ObjectDefinition>;
  instances: ObjectInstance[];
  settings: Settings;
}
