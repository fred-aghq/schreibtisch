import { obbAabb, obbsOverlap } from '../geometry/obb';
import { rotatePlan, yawFromDir } from '../geometry/transform';
import type { Vec2 } from '../geometry/vec';
import { createDefaultLayout, makeInstance } from '../model/defaults';
import { newId } from '../model/ids';
import { DEFAULT_MOUNT_ELEVATION, definitionFromPreset, monitorPreset } from '../model/presets';
import type { MonitorParams, Preset } from '../model/presets';
import type { Desk, Layout, Listener, ObjectDefinition, ObjectInstance, Size } from '../model/types';
import { findOverlaps } from './overlap';
import { instanceObb } from './scene';
import { placeSpeakerPair } from './triangleFixes';

/**
 * Auto-arrange: build a sensible starting layout from the setup wizard's answers. Pure; the
 * result reports anything worth telling the user (speakers off the desk, overlaps).
 */

export interface MonitorSpec extends MonitorParams {
  support: 'stand' | 'mount';
}

export interface SpeakerSpec {
  name: string;
  size: Size;
  acousticCentreHeight: number;
  rearPorted: boolean;
  /** True for a size preset, false for the user's own measurements. */
  approx: boolean;
}

export interface ItemSpec {
  /** A library preset, possibly with the user's own size. */
  preset: Preset;
  quantity: number;
}

export interface SetupSpec {
  name: string;
  desk: Desk;
  listener: Listener;
  /** The first monitor is the main one. */
  monitors: MonitorSpec[];
  speakers: SpeakerSpec | null;
  items: ItemSpec[];
}

export interface ArrangeResult {
  layout: Layout;
  /** Plain-language notes for the wizard's last message. */
  notes: string[];
}

/** Gap between neighbouring monitors' edges. */
const MONITOR_GAP = 10;
/** Speakers keep at least this much room beside the monitors. */
const SPEAKER_MARGIN = 60;
/** The speaker triangle's side is chosen within this range (mm). */
export const SPEAKER_SIDE_RANGE = { min: 900, max: 1400, noMonitors: 1000 } as const;
/** Keyboard front edge to desk front edge. */
const KEYBOARD_FROM_EDGE = 100;
/** Grid step when searching for a free spot. */
const SLOT_STEP = 20;

interface Draft {
  layout: Layout;
  notes: string[];
}

function addObject(d: Draft, preset: Preset, partial: Partial<ObjectInstance>): { inst: ObjectInstance; def: ObjectDefinition } {
  const def = definitionFromPreset(preset, newId('def'));
  const inst = makeInstance(def, partial);
  d.layout = { ...d.layout, definitions: { ...d.layout.definitions, [def.id]: def }, instances: [...d.layout.instances, inst] };
  return { inst, def };
}

function listenerPlan(l: Layout): Vec2 {
  return { x: l.listener.x, z: l.listener.distanceFromFrontEdge };
}

/** True if a footprint at `inst` would collide (in plan and height) with anything already placed. */
function collides(layout: Layout, inst: ObjectInstance, def: ObjectDefinition): boolean {
  if (def.category === 'mat') return false;
  const box = instanceObb(inst, def);
  return layout.instances.some((o) => {
    const od = layout.definitions[o.definitionId];
    if (!od || od.category === 'mat' || o.id === inst.id) return false;
    const vertical = inst.position.y + def.size.h > o.position.y + 0.5 && o.position.y + od.size.h > inst.position.y + 0.5;
    return vertical && obbsOverlap(box, instanceObb(o, od));
  });
}

/**
 * The free spot on the desk nearest `preferred` where the object fits entirely on the desk and
 * touches nothing; `preferred` itself if there is none.
 */
function freeSpot(layout: Layout, preset: Preset, preferred: Vec2, y: number): Vec2 {
  const { width: W, depth: D } = layout.desk;
  const { w, d } = preset.size;
  const probeDef = definitionFromPreset(preset, 'probe');
  const candidates: Vec2[] = [];
  for (let x = -W / 2 + w / 2; x <= W / 2 - w / 2 + 1e-6; x += SLOT_STEP) {
    for (let z = -D + d / 2; z <= -d / 2 + 1e-6; z += SLOT_STEP) candidates.push({ x, z });
  }
  candidates.sort((a, b) => Math.hypot(a.x - preferred.x, a.z - preferred.z) - Math.hypot(b.x - preferred.x, b.z - preferred.z));
  for (const c of candidates) {
    const probe = makeInstance(probeDef, { id: 'probe', position: { x: c.x, y, z: c.z } });
    if (!collides(layout, probe, probeDef)) return c;
  }
  return preferred;
}

function placeMonitors(d: Draft, specs: readonly MonitorSpec[]): ObjectInstance[] {
  const D = d.layout.desk.depth;
  const head = listenerPlan(d.layout);
  const placed: { inst: ObjectInstance; w: number }[] = [];
  let right: { inst: ObjectInstance; w: number } | null = null;
  let left: { inst: ObjectInstance; w: number } | null = null;
  specs.forEach((spec, i) => {
    const preset = monitorPreset(spec);
    const w = preset.size.w;
    const depth = Math.max(preset.size.d, spec.support === 'stand' ? (preset.monitor?.stand?.d ?? 0) : 0);
    const y = preset.elevation ?? DEFAULT_MOUNT_ELEVATION;
    const label = specs.length === 1 ? 'Monitor' : i === 0 ? 'Monitor 1 (main)' : `Monitor ${i + 1}`;
    let pos: Vec2;
    let yaw: number;
    const neighbour = i === 0 ? null : i % 2 === 1 ? right : left;
    if (!neighbour) {
      pos = { x: head.x, z: -D + 60 + depth / 2 };
      yaw = yawFromDir({ x: head.x - pos.x, z: head.z - pos.z });
    } else {
      // Hinge on the neighbour's outer front corner, then turn toward the listener (refined a few
      // times). Monitors further out turn further inward, so their back corners stay clear.
      const sign = i % 2 === 1 ? 1 : -1;
      const n = neighbour.inst;
      const nd = preset.size.d;
      const hinge = (() => {
        const r = rotatePlan({ x: (sign * neighbour.w) / 2, z: nd / 2 }, n.rotation.yaw);
        return { x: n.position.x + r.x, z: n.position.z + r.z };
      })();
      yaw = n.rotation.yaw;
      pos = hinge;
      for (let k = 0; k < 6; k++) {
        const r = rotatePlan({ x: sign * (w / 2 + MONITOR_GAP), z: -nd / 2 }, yaw);
        pos = { x: hinge.x + r.x, z: hinge.z + r.z };
        yaw = yawFromDir({ x: head.x - pos.x, z: head.z - pos.z });
      }
    }
    const { inst } = addObject(d, preset, { label, position: { x: pos.x, y, z: pos.z }, rotation: { yaw, pitch: 0 } });
    const entry = { inst, w };
    placed.push(entry);
    if (i === 0 || i % 2 === 1) right = entry;
    if (i === 0 || i % 2 === 0) left = entry;
  });
  return placed.map((p) => p.inst);
}

/** Plan x-range covered by the monitors, or null without monitors. */
function xSpan(layout: Layout, insts: readonly ObjectInstance[]): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const inst of insts) {
    const def = layout.definitions[inst.definitionId];
    if (!def) continue;
    const b = obbAabb(instanceObb(inst, def));
    min = Math.min(min, b.minX);
    max = Math.max(max, b.maxX);
  }
  return min <= max ? { min, max } : null;
}

function speakersClear(layout: Layout, span: { min: number; max: number }): boolean {
  return layout.instances.every((inst) => {
    const def = layout.definitions[inst.definitionId];
    if (!def || inst.role === null) return true;
    const b = obbAabb(instanceObb(inst, def));
    return inst.role === 'speakerL' ? b.maxX <= span.min - SPEAKER_MARGIN : b.minX >= span.max + SPEAKER_MARGIN;
  });
}

function placeSpeakers(d: Draft, spec: SpeakerSpec, monitors: readonly ObjectInstance[]): void {
  const preset: Preset = {
    id: 'wizard-speaker',
    group: 'Speakers',
    name: spec.name,
    category: 'speaker',
    size: spec.size,
    speaker: { acousticCentreHeight: spec.acousticCentreHeight, rearPorted: spec.rearPorted },
    approx: spec.approx,
  };
  const def = definitionFromPreset(preset, newId('def'));
  const pairId = newId('pair');
  const left = makeInstance(def, { label: 'Left speaker', role: 'speakerL', pairId });
  const right = makeInstance(def, { label: 'Right speaker', role: 'speakerR', pairId });
  const base: Layout = { ...d.layout, definitions: { ...d.layout.definitions, [def.id]: def }, instances: [...d.layout.instances, left, right] };

  const span = xSpan(base, monitors);
  let placed = placeSpeakerPair(base, SPEAKER_SIDE_RANGE.noMonitors);
  if (span) {
    let found = false;
    for (let s = SPEAKER_SIDE_RANGE.min; s <= SPEAKER_SIDE_RANGE.max; s += 10) {
      placed = placeSpeakerPair(base, s);
      if (speakersClear(placed, span)) {
        found = true;
        break;
      }
    }
    if (!found) {
      d.notes.push(
        'Even a 1.4 m triangle doesn’t clear all the monitors, so a speaker sits close to (or behind) a screen. Speakers on stands beside the desk, or moving the monitors, can help.',
      );
    }
  }
  d.layout = placed;

  // Off the desk is fine (stands, clamps), but say so.
  const { width: W, depth: D } = d.layout.desk;
  for (const inst of d.layout.instances.filter((i) => i.role !== null)) {
    const sd = d.layout.definitions[inst.definitionId];
    if (!sd) continue;
    const b = obbAabb(instanceObb(inst, sd));
    const past = [
      b.minX < -W / 2 ? `${Math.round(-W / 2 - b.minX)} mm past the left edge` : null,
      b.maxX > W / 2 ? `${Math.round(b.maxX - W / 2)} mm past the right edge` : null,
      b.maxZ > 0 ? `${Math.round(b.maxZ)} mm past the front edge` : null,
      b.minZ < -D ? `${Math.round(-D - b.minZ)} mm past the back edge` : null,
    ].filter((x): x is string => x !== null);
    if (past.length) d.notes.push(`The ${inst.label.toLowerCase()} is ${past.join(' and ')}, so it needs a stand or a clamp.`);
  }
}

function placeItems(d: Draft, items: readonly ItemSpec[], mainMonitor: ObjectInstance | undefined): void {
  const { width: W, depth: D, heightFromFloor } = d.layout.desk;
  const head = listenerPlan(d.layout);
  const count = (pred: (p: Preset) => boolean) => items.filter((i) => pred(i.preset) && i.quantity > 0);
  const mat = count((p) => p.category === 'mat')[0];
  const keyboard = count((p) => p.category === 'keyboard')[0];
  const mouse = count((p) => p.category === 'mouse')[0];
  const onMat = mat ? mat.preset.size.h : 0;

  // Keyboard centred on the listener at the front, the mouse to its right, the mat under both.
  const kbZ = -(keyboard?.preset.size.d ?? 130) / 2 - KEYBOARD_FROM_EDGE;
  const kbX = head.x;
  const kbHalf = keyboard ? keyboard.preset.size.w / 2 : 0;
  const mouseX = keyboard ? kbX + kbHalf + 100 + (mouse?.preset.size.w ?? 0) / 2 : head.x + 250;
  if (mat) {
    const groupL = keyboard ? kbX - kbHalf : mouseX;
    const groupR = mouse ? mouseX + mouse.preset.size.w / 2 : kbX + kbHalf;
    const z = Math.min(kbZ, -mat.preset.size.d / 2 - 20);
    addObject(d, mat.preset, { label: mat.preset.name, position: { x: (groupL + groupR) / 2, y: 0, z } });
  }
  if (keyboard) addObject(d, keyboard.preset, { label: 'Keyboard', position: { x: kbX, y: onMat, z: kbZ } });
  if (mouse) addObject(d, mouse.preset, { label: 'Mouse', position: { x: mouseX, y: onMat, z: kbZ } });

  const handled = new Set([mat, keyboard, mouse].filter(Boolean).map((i) => i?.preset));
  for (const item of items) {
    const p = item.preset;
    const extra = handled.has(p) ? item.quantity - 1 : item.quantity;
    for (let k = 0; k < extra; k++) {
      const label = item.quantity > 1 ? `${p.name} ${k + 1 + (handled.has(p) ? 1 : 0)}` : p.name;
      if (p.placement === 'floor') {
        addObject(d, p, { label, position: { x: W / 2 - p.size.w / 2 - 150 - k * (p.size.w + 60), y: -heightFromFloor, z: -D / 2 } });
        continue;
      }
      if (p.id === 'light-bar' && mainMonitor && k === 0) {
        const md = d.layout.definitions[mainMonitor.definitionId];
        const { x, y, z } = mainMonitor.position;
        addObject(d, p, { label, position: { x, y: y + (md?.size.h ?? 0) + 10, z }, rotation: { yaw: mainMonitor.rotation.yaw, pitch: 0 } });
        continue;
      }
      const y = p.placement === 'mount' ? (p.elevation ?? DEFAULT_MOUNT_ELEVATION) : 0;
      const preferred = preferredSpot(p, W, D, head);
      const at = freeSpot(d.layout, p, preferred, y);
      addObject(d, p, { label, position: { x: at.x, y, z: at.z } });
    }
  }
}

/** Where an item would ideally go; the nearest free spot to this is used. */
function preferredSpot(p: Preset, W: number, D: number, head: Vec2): Vec2 {
  switch (p.id) {
    case 'light-lamp':
      return { x: -W / 2, z: -D };
    case 'light-key':
      return { x: head.x - W / 4, z: -D };
    case 'mic-clamp':
      return { x: W / 2, z: -D };
    case 'hp-stand':
      return { x: W / 2, z: 0 };
    case 'audio-if':
      return { x: head.x + W / 4, z: -D / 2 };
    default:
      return p.category === 'laptop' ? { x: -W / 2, z: -D / 2 } : { x: head.x, z: -D / 2 };
  }
}

/** Build a starting layout from the setup answers. */
export function arrangeLayout(spec: SetupSpec): ArrangeResult {
  const base = createDefaultLayout(spec.name);
  const d: Draft = {
    layout: {
      ...base,
      desk: { ...spec.desk },
      listener: { ...spec.listener },
      definitions: {},
      instances: [],
      settings: { ...base.settings, showTriangle: true },
    },
    notes: [],
  };
  const monitors = placeMonitors(d, spec.monitors);
  if (spec.speakers) placeSpeakers(d, spec.speakers, monitors);
  placeItems(d, spec.items, monitors[0]);

  const overlaps = findOverlaps(d.layout);
  if (overlaps.size > 0) {
    const names = d.layout.instances.filter((i) => overlaps.has(i.id)).map((i) => i.label);
    d.notes.push(`Some things overlap (${names.join(', ')}); they're outlined in red. Drag them apart.`);
  }
  return { layout: d.layout, notes: d.notes };
}
