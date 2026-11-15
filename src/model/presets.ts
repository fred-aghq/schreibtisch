import { monitorName, monitorSize } from '../geometry/monitor';
import type { MonitorParams } from '../geometry/monitor';
import { CATEGORY_INFO } from './categories';
import type { Category, MonitorExtras, ObjectDefinition, Shape, Size, SpeakerExtras } from './types';

/** Where a freshly added object goes vertically. */
export type Placement = 'desk' | 'floor' | 'mount';

export interface Preset {
  id: string;
  group: PresetGroup;
  name: string;
  category: Category;
  size: Size;
  shape?: Shape;
  colour?: string;
  speaker?: SpeakerExtras;
  monitor?: MonitorExtras;
  placement?: Placement;
  /** Default elevation when placement is 'mount' (mm above the desk top). */
  elevation?: number;
  /** Built-ins are approximate; user presets are the user's own measurements. */
  approx: boolean;
}

export const PRESET_GROUPS = ['Speakers', 'Lights', 'Peripherals', 'Computers', 'Audio', 'Accessories', 'My presets'] as const;
export type PresetGroup = (typeof PRESET_GROUPS)[number];

export const DEFAULT_STAND: Size = { w: 250, d: 200, h: 100 };
export const DEFAULT_MOUNT_ELEVATION = 150;

export const DEFAULT_MONITOR: MonitorParams & { support: 'stand' | 'mount' } = {
  diagonalIn: 27,
  aspect: '16:9',
  bezelMm: 8,
  panelDepth: 50,
  support: 'mount',
};

const speaker = (id: string, name: string, size: Size, acousticCentreHeight: number): Preset => ({
  id,
  group: 'Speakers',
  name,
  category: 'speaker',
  size,
  speaker: { acousticCentreHeight, rearPorted: true },
  approx: true,
});

export const BUILT_IN_PRESETS: readonly Preset[] = [
  speaker('spk-small', 'Speaker, small (5")', { w: 170, d: 230, h: 280 }, 215),
  speaker('spk-medium', 'Speaker, medium (7")', { w: 210, d: 290, h: 350 }, 275),
  speaker('spk-large', 'Speaker, large (8")', { w: 250, d: 330, h: 400 }, 320),

  { id: 'light-bar', group: 'Lights', name: 'Monitor light bar', category: 'light', size: { w: 450, d: 90, h: 30 }, placement: 'mount', elevation: 400, approx: true },
  { id: 'light-lamp', group: 'Lights', name: 'Desk lamp', category: 'light', size: { w: 180, d: 180, h: 450 }, shape: 'cylinder', approx: true },
  { id: 'light-key', group: 'Lights', name: 'Key light / LED panel', category: 'light', size: { w: 250, d: 40, h: 200 }, placement: 'mount', elevation: 350, approx: true },

  { id: 'kb-full', group: 'Peripherals', name: 'Keyboard, full size', category: 'keyboard', size: { w: 440, d: 135, h: 35 }, approx: true },
  { id: 'kb-tkl', group: 'Peripherals', name: 'Keyboard, TKL', category: 'keyboard', size: { w: 360, d: 135, h: 35 }, approx: true },
  { id: 'kb-75', group: 'Peripherals', name: 'Keyboard, 75%', category: 'keyboard', size: { w: 315, d: 130, h: 35 }, approx: true },
  { id: 'kb-60', group: 'Peripherals', name: 'Keyboard, 60%', category: 'keyboard', size: { w: 295, d: 105, h: 35 }, approx: true },
  { id: 'mouse', group: 'Peripherals', name: 'Mouse', category: 'mouse', size: { w: 65, d: 120, h: 40 }, approx: true },
  { id: 'mat', group: 'Peripherals', name: 'Desk mat', category: 'mat', size: { w: 900, d: 400, h: 3 }, approx: true },

  { id: 'laptop-14', group: 'Computers', name: 'Laptop 14"', category: 'laptop', size: { w: 312, d: 221, h: 16 }, approx: true },
  { id: 'laptop-16', group: 'Computers', name: 'Laptop 16"', category: 'laptop', size: { w: 356, d: 248, h: 17 }, approx: true },
  { id: 'pc-tower', group: 'Computers', name: 'PC tower (on floor)', category: 'pc', size: { w: 210, d: 450, h: 470 }, placement: 'floor', approx: true },

  { id: 'audio-if', group: 'Audio', name: 'Audio interface', category: 'audio-interface', size: { w: 190, d: 110, h: 50 }, approx: true },
  { id: 'mic-clamp', group: 'Audio', name: 'Mic arm clamp', category: 'other', size: { w: 60, d: 80, h: 120 }, approx: true },
  { id: 'hp-stand', group: 'Audio', name: 'Headphone stand', category: 'other', size: { w: 120, d: 120, h: 260 }, shape: 'cylinder', approx: true },

  { id: 'box', group: 'Accessories', name: 'Custom box', category: 'other', size: { w: 200, d: 200, h: 100 }, approx: false },
];

/** Build a monitor preset from generator parameters. */
export function monitorPreset(p: MonitorParams & { support: 'stand' | 'mount'; stand?: Size }): Preset {
  const stand = p.support === 'stand' ? (p.stand ?? DEFAULT_STAND) : undefined;
  return {
    id: 'monitor-generated',
    group: 'My presets',
    name: monitorName(p),
    category: 'monitor',
    size: monitorSize(p),
    monitor: { diagonalIn: p.diagonalIn, aspect: p.aspect, bezelMm: p.bezelMm, support: p.support, ...(stand ? { stand } : {}) },
    placement: 'mount',
    elevation: stand ? stand.h : DEFAULT_MOUNT_ELEVATION,
    approx: true,
  };
}

/** A new layout definition from a preset. */
export function definitionFromPreset(preset: Preset, id: string): ObjectDefinition {
  return {
    id,
    name: preset.name,
    category: preset.category,
    size: { ...preset.size },
    colour: preset.colour ?? CATEGORY_INFO[preset.category].tint,
    shape: preset.shape ?? 'box',
    ...(preset.speaker ? { speaker: { ...preset.speaker } } : {}),
    ...(preset.monitor ? { monitor: structuredClone(preset.monitor) } : {}),
    ...(preset.approx ? { approx: true } : {}),
  };
}

/** Save a layout definition (with the current instance's elevation) as a user preset. */
export function presetFromDefinition(def: ObjectDefinition, id: string, elevation: number): Preset {
  return {
    id,
    group: 'My presets',
    name: def.name,
    category: def.category,
    size: { ...def.size },
    shape: def.shape,
    colour: def.colour,
    ...(def.speaker ? { speaker: { ...def.speaker } } : {}),
    ...(def.monitor ? { monitor: structuredClone(def.monitor) } : {}),
    ...(elevation !== 0 ? { placement: 'mount' as const, elevation } : {}),
    approx: false,
  };
}
