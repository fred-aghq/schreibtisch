import { CATEGORY_INFO } from './categories';
import { newId } from './ids';
import type { Category, Desk, Layout, Listener, ObjectDefinition, ObjectInstance, Settings, Size } from './types';
import { SCHEMA_VERSION } from './types';

export const DEFAULT_DESK: Desk = {
  width: 1600,
  depth: 800,
  thickness: 25,
  heightFromFloor: 740,
  colour: '#c8a578',
};

export const DEFAULT_LISTENER: Listener = {
  x: 0,
  distanceFromFrontEdge: 600,
  earHeightFromFloor: 1200,
};

export const DEFAULT_SETTINGS: Settings = {
  gridSpacing: 100,
  showGrid: true,
  snapEnabled: true,
  snapStep: 5,
  showFloor: true,
  showTriangle: false,
  showGuides: true,
  mirrorPairs: true,
  aimOffset: 0,
  tolerances: { angleGood: 2, angleWarn: 5, distGood: 20, distWarn: 50 },
};

export function makeDefinition(
  category: Category,
  name: string,
  size: Size,
  extras: Partial<ObjectDefinition> = {},
): ObjectDefinition {
  return {
    id: newId('def'),
    name,
    category,
    size,
    colour: CATEGORY_INFO[category].tint,
    shape: 'box',
    ...extras,
  };
}

export function makeInstance(def: ObjectDefinition, partial: Partial<ObjectInstance> = {}): ObjectInstance {
  return {
    id: newId('obj'),
    definitionId: def.id,
    label: def.name,
    position: { x: 0, y: 0, z: -def.size.d / 2 },
    rotation: { yaw: 0, pitch: 0 },
    locked: false,
    visible: true,
    role: null,
    ...partial,
  };
}

/** Quick-add templates for milestone 1 (a full library arrives later). All approximate. */
export const QUICK_ADD: { category: Category; name: string; size: Size; extras?: Partial<ObjectDefinition> }[] = [
  { category: 'monitor', name: 'Monitor 27"', size: { w: 615, d: 50, h: 370 }, extras: { monitor: { diagonalIn: 27, aspect: '16:9', support: 'mount' } } },
  { category: 'speaker', name: 'Speaker (medium)', size: { w: 210, d: 290, h: 350 }, extras: { speaker: { acousticCentreHeight: 280, rearPorted: true } } },
  { category: 'keyboard', name: 'Keyboard (TKL)', size: { w: 360, d: 135, h: 35 } },
  { category: 'mouse', name: 'Mouse', size: { w: 65, d: 120, h: 40 } },
  { category: 'mat', name: 'Desk mat', size: { w: 900, d: 400, h: 3 } },
  { category: 'light', name: 'Monitor light bar', size: { w: 450, d: 90, h: 30 } },
  { category: 'laptop', name: 'Laptop 14"', size: { w: 312, d: 221, h: 16 } },
  { category: 'pc', name: 'PC tower', size: { w: 210, d: 450, h: 470 } },
  { category: 'audio-interface', name: 'Audio interface', size: { w: 190, d: 110, h: 50 } },
  { category: 'other', name: 'Box', size: { w: 200, d: 200, h: 100 } },
];

/** A fresh layout: desk + listener + a few generic objects to play with. */
export function createDefaultLayout(name = 'My desk'): Layout {
  const monitor = makeDefinition('monitor', 'Monitor 27"', { w: 615, d: 50, h: 370 }, {
    approx: true,
    monitor: { diagonalIn: 27, aspect: '16:9', support: 'mount' },
  });
  const keyboard = makeDefinition('keyboard', 'Keyboard (TKL)', { w: 360, d: 135, h: 35 }, { approx: true });
  const mouse = makeDefinition('mouse', 'Mouse', { w: 65, d: 120, h: 40 }, { approx: true });
  const speaker = makeDefinition('speaker', 'Speaker (medium)', { w: 210, d: 290, h: 350 }, {
    approx: true,
    speaker: { acousticCentreHeight: 280, rearPorted: true },
  });
  const pairId = newId('pair');
  const instances: ObjectInstance[] = [
    makeInstance(monitor, { label: 'Monitor', position: { x: 0, y: 120, z: -520 } }),
    makeInstance(keyboard, { label: 'Keyboard', position: { x: -40, y: 0, z: -180 } }),
    makeInstance(mouse, { label: 'Mouse', position: { x: 250, y: 0, z: -170 } }),
    makeInstance(speaker, { label: 'Left speaker', role: 'speakerL', pairId, position: { x: -600, y: 0, z: -560 }, rotation: { yaw: 20, pitch: 0 } }),
    makeInstance(speaker, { label: 'Right speaker', role: 'speakerR', pairId, position: { x: 600, y: 0, z: -560 }, rotation: { yaw: -20, pitch: 0 } }),
  ];
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId('layout'),
    name,
    desk: { ...DEFAULT_DESK },
    backWall: null,
    listener: { ...DEFAULT_LISTENER },
    definitions: Object.fromEntries([monitor, keyboard, mouse, speaker].map((d) => [d.id, d])),
    instances,
    settings: structuredClone(DEFAULT_SETTINGS),
  };
}
