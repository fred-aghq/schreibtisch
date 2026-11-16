import type { ItemSpec, MonitorSpec, SetupSpec, SpeakerSpec } from '../../layout/arrange';
import { BUILT_IN_PRESETS, DEFAULT_MONITOR } from '../../model/presets';
import type { Preset } from '../../model/presets';
import type { Desk, Layout, Listener, Size } from '../../model/types';

/** Everything the setup wizard collects. Kept as plain data so Back never loses anything. */
export interface WizardDraft {
  name: string;
  desk: Desk;
  listener: Listener;
  monitors: MonitorSpec[];
  speakers: {
    enabled: boolean;
    /** A built-in speaker preset id, or 'custom' once the user enters their own sizes. */
    source: string;
    size: Size;
    acousticCentreHeight: number;
    rearPorted: boolean;
  };
  /** Checklist rows by preset id. */
  items: Record<string, { checked: boolean; quantity: number; size: Size }>;
}

export const DESK_PRESETS: readonly { label: string; width: number; depth: number }[] = [
  { label: '120 × 60', width: 1200, depth: 600 },
  { label: '140 × 70', width: 1400, depth: 700 },
  { label: '160 × 80', width: 1600, depth: 800 },
  { label: '180 × 80', width: 1800, depth: 800 },
];

export const SPEAKER_PRESETS = BUILT_IN_PRESETS.filter((p) => p.category === 'speaker');

/** Checklist presets: everything except speakers (they have their own section). */
export function checklistPresets(userPresets: readonly Preset[]): Preset[] {
  return [...BUILT_IN_PRESETS, ...userPresets].filter((p) => p.category !== 'speaker' && p.category !== 'monitor');
}

/** Ticked by default: the things nearly every desk has. */
const DEFAULT_CHECKED = new Set(['kb-tkl', 'mouse']);

export const DEFAULT_SPEAKER_ID = 'spk-medium';

export function speakerFromPreset(id: string): WizardDraft['speakers'] {
  const p = SPEAKER_PRESETS.find((s) => s.id === id) ?? SPEAKER_PRESETS[0];
  return {
    enabled: true,
    source: p?.id ?? 'custom',
    size: { ...(p?.size ?? { w: 210, d: 290, h: 350 }) },
    acousticCentreHeight: p?.speaker?.acousticCentreHeight ?? 280,
    rearPorted: p?.speaker?.rearPorted ?? true,
  };
}

/** Starting answers: the current desk and listener (so re-running keeps your measurements), and common items. */
export function initialDraft(layout: Layout, userPresets: readonly Preset[], firstRun: boolean): WizardDraft {
  const { width, depth, thickness, heightFromFloor, colour } = layout.desk;
  return {
    name: firstRun ? layout.name : 'New desk',
    desk: { width, depth, thickness, heightFromFloor, colour },
    listener: { ...layout.listener },
    monitors: [{ ...DEFAULT_MONITOR }],
    speakers: speakerFromPreset(DEFAULT_SPEAKER_ID),
    items: Object.fromEntries(checklistPresets(userPresets).map((p) => [p.id, { checked: DEFAULT_CHECKED.has(p.id), quantity: 1, size: { ...p.size } }])),
  };
}

/** The arrange spec for the wizard's answers. */
export function toSetupSpec(draft: WizardDraft, userPresets: readonly Preset[]): SetupSpec {
  const presets = checklistPresets(userPresets);
  const items: ItemSpec[] = presets.flatMap((p) => {
    const row = draft.items[p.id];
    if (!row?.checked || row.quantity < 1) return [];
    const edited = row.size.w !== p.size.w || row.size.d !== p.size.d || row.size.h !== p.size.h;
    return [{ preset: { ...p, size: { ...row.size }, approx: p.approx && !edited }, quantity: row.quantity }];
  });
  const s = draft.speakers;
  const builtIn = SPEAKER_PRESETS.find((p) => p.id === s.source);
  const speakers: SpeakerSpec | null = s.enabled
    ? { name: builtIn?.name ?? 'Speaker', size: { ...s.size }, acousticCentreHeight: s.acousticCentreHeight, rearPorted: s.rearPorted, approx: builtIn !== undefined }
    : null;
  return {
    name: draft.name.trim() || 'My desk',
    desk: { ...draft.desk },
    listener: { ...draft.listener },
    monitors: draft.monitors.map((m) => ({ ...m })),
    speakers,
    items,
  };
}
