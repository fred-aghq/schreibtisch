import { describe, expect, it } from 'vitest';
import { arrangeLayout } from '../../layout/arrange';
import { createDefaultLayout } from '../../model/defaults';
import type { Preset } from '../../model/presets';
import { checklistPresets, initialDraft, speakerFromPreset, toSetupSpec } from './draft';

const myBox: Preset = { id: 'mine', group: 'My presets', name: 'My lamp', category: 'light', size: { w: 100, d: 100, h: 400 }, approx: false };

describe('wizard draft', () => {
  it('starts from the current desk and listener', () => {
    const l = createDefaultLayout();
    const desk = { ...l.desk, width: 1400 };
    const d = initialDraft({ ...l, desk, listener: { ...l.listener, distanceFromFrontEdge: 650 } }, [], false);
    expect(d.desk.width).toBe(1400);
    expect(d.listener.distanceFromFrontEdge).toBe(650);
    expect(d.name).toBe('New desk');
    expect(initialDraft(l, [], true).name).toBe(l.name);
  });

  it('offers built-in and saved items, ticking the common ones', () => {
    const d = initialDraft(createDefaultLayout(), [myBox], true);
    expect(checklistPresets([myBox]).some((p) => p.category === 'speaker')).toBe(false);
    expect(d.items['kb-tkl']!.checked).toBe(true);
    expect(d.items['mouse']!.checked).toBe(true);
    expect(d.items['mine']!.checked).toBe(false);
  });

  it('turns answers into a spec: checked items with their sizes and quantities', () => {
    const d = initialDraft(createDefaultLayout(), [myBox], true);
    d.items['mine'] = { checked: true, quantity: 2, size: { w: 120, d: 100, h: 400 } };
    d.items['mouse']!.checked = false;
    const spec = toSetupSpec(d, [myBox]);
    expect(spec.items.map((i) => [i.preset.id, i.quantity])).toEqual([
      ['kb-tkl', 1],
      ['mine', 2],
    ]);
    expect(spec.items[1]!.preset.size.w).toBe(120);
  });

  it('only marks items approximate while they keep the built-in size', () => {
    const d = initialDraft(createDefaultLayout(), [], true);
    expect(toSetupSpec(d, []).items[0]!.preset.approx).toBe(true);
    d.items['kb-tkl']!.size = { w: 355, d: 130, h: 30 };
    expect(toSetupSpec(d, []).items[0]!.preset.approx).toBe(false);
  });

  it('speakers: a preset is approximate, custom sizes are not, and they can be left out', () => {
    const d = initialDraft(createDefaultLayout(), [], true);
    expect(toSetupSpec(d, []).speakers).toMatchObject({ approx: true, name: 'Speaker, medium (7")' });
    d.speakers = { ...speakerFromPreset('spk-large'), source: 'custom', size: { w: 210, d: 293, h: 347 } };
    expect(toSetupSpec(d, []).speakers).toMatchObject({ approx: false, name: 'Speaker', size: { w: 210, d: 293, h: 347 } });
    d.speakers.enabled = false;
    expect(toSetupSpec(d, []).speakers).toBeNull();
  });

  it('the default answers arrange into a layout with no overlaps or notes', () => {
    const r = arrangeLayout(toSetupSpec(initialDraft(createDefaultLayout(), [], true), []));
    expect(r.notes).toEqual([]);
    expect(r.layout.instances.map((i) => i.label).sort()).toEqual(['Keyboard', 'Left speaker', 'Monitor', 'Mouse', 'Right speaker']);
  });
});
