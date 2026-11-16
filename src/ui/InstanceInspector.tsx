import { useState } from 'react';
import { CATEGORY_INFO } from '../model/categories';
import { newId } from '../model/ids';
import { countInstancesOf, makeUnique, moveInstance, pairPartner, setSettings, setSpeakerRole, unlinkPair, updateDefinition, updateInstance } from '../model/ops';
import type { InstancePatch, PosePatch } from '../model/ops';
import { presetFromDefinition } from '../model/presets';
import type { Layout, ObjectDefinition, ObjectInstance } from '../model/types';
import { deleteObject, duplicateObject } from '../store/commands';
import { useStore } from '../store/store';
import { ColourField } from './ColourField';
import { Icon } from './Icon';
import { MonitorSection } from './MonitorSection';
import { NumberField } from './NumberField';
import p from './panel.module.css';
import { TextField } from './TextField';

export function InstanceInspector({ layout, inst, def }: { layout: Layout; inst: ObjectInstance; def: ObjectDefinition }) {
  const apply = useStore((s) => s.apply);
  const select = useStore((s) => s.select);
  const addUserPreset = useStore((s) => s.addUserPreset);
  const [savedName, setSavedName] = useState<string | null>(null);
  const patch = (pt: InstancePatch) => apply((l) => updateInstance(l, inst.id, pt));
  const move = (pt: PosePatch) => apply((l) => moveInstance(l, inst.id, pt));
  const patchDef = (pt: Parameters<typeof updateDefinition>[2]) => apply((l) => updateDefinition(l, def.id, pt));
  const shared = countInstancesOf(layout, def.id);
  const partner = pairPartner(layout, inst.id);
  const locked = inst.locked;

  return (
    <div className={p.panel}>
      <div className={p.section}>
        <TextField className={p.titleInput} value={inst.label} aria-label="Label" onCommit={(label) => patch({ label })} />
        <div className={p.row} style={{ marginTop: 6, flexWrap: 'wrap' }}>
          <span className={p.chip}>
            <span className={p.dot} style={{ background: CATEGORY_INFO[def.category].tint }} />
            {CATEGORY_INFO[def.category].label}
          </span>
          {def.approx && (
            <span className={p.approx} title="Built-in sizes are approximate. Measure your own and edit them.">
              approx: measure yours
            </span>
          )}
        </div>
      </div>

      <div className={p.section}>
        <h3 className={p.sectionTitle}>Size</h3>
        {shared > 1 && (
          <p className={p.note}>
            Shared by {shared} objects: changes apply to all of them.{' '}
            <button type="button" className={p.linkButton} onClick={() => apply((l) => makeUnique(l, inst.id))} title="Give this object its own copy of the definition">
              Make unique
            </button>
          </p>
        )}
        <NumberField label="Width" hint="X" value={def.size.w} min={1} onCommit={(w) => patchDef({ size: { w }, approx: false })} />
        <NumberField label="Depth" hint="Z" value={def.size.d} min={1} onCommit={(d) => patchDef({ size: { d }, approx: false })} />
        <NumberField label="Height" hint="Y" value={def.size.h} min={1} onCommit={(h) => patchDef({ size: { h }, approx: false })} />
      </div>

      {def.category === 'monitor' && <MonitorSection def={def} inst={inst} />}

      <div className={p.section}>
        <h3 className={p.sectionTitle}>Position</h3>
        <NumberField label="Left–right" hint="X" value={inst.position.x} disabled={locked} onCommit={(x) => move({ position: { x } })} title="0 = desk centreline, + = right" />
        <NumberField label="Front–back" hint="Z" value={inst.position.z} disabled={locked} onCommit={(z) => move({ position: { z } })} title="0 = desk front edge, − = toward the back" />
        <NumberField label="Elevation" hint="Y" value={inst.position.y} disabled={locked} onCommit={(y) => move({ position: { y } })} title="0 = sitting on the desk, − = below the desk top" />
      </div>

      <div className={p.section}>
        <h3 className={p.sectionTitle}>Rotation</h3>
        <NumberField label="Yaw" unit="°" value={inst.rotation.yaw} disabled={locked} onCommit={(yaw) => move({ rotation: { yaw } })} title="0 = facing you, + = turned toward your right" />
        <details className={p.details}>
          <summary>Advanced</summary>
          <NumberField label="Pitch (tilt)" unit="°" value={inst.rotation.pitch} min={-90} max={90} disabled={locked} onCommit={(pitch) => move({ rotation: { pitch } })} title="+ = front tilted upward" />
          {def.category !== 'speaker' && <RoleField inst={inst} />}
          <label className={p.selectField}>
            Shape
            <select className={p.select} value={def.shape} onChange={(e) => patchDef({ shape: e.currentTarget.value === 'cylinder' ? 'cylinder' : 'box' })}>
              <option value="box">Box</option>
              <option value="cylinder">Cylinder</option>
            </select>
          </label>
          <label className={p.selectField}>
            Colour
            <ColourField className={p.colourInput} value={def.colour} onInput={(colour) => patchDef({ colour })} />
          </label>
        </details>
      </div>

      {partner && (
        <div className={p.section}>
          <h3 className={p.sectionTitle}>Pair</h3>
          <p className={p.note}>
            Linked with <b>{partner.label}</b>. With mirroring on, moving or rotating either one mirrors the other across the listener&apos;s centreline.
          </p>
          <label className={p.checkbox}>
            <input type="checkbox" checked={layout.settings.mirrorPairs} onChange={(e) => {
              const mirrorPairs = e.currentTarget.checked;
              apply((l) => setSettings(l, { mirrorPairs }));
            }} />
            Mirror pairs
          </label>
          <div className={p.row}>
            <button type="button" className={p.button} onClick={() => select({ kind: 'instance', id: partner.id })}>
              Select partner
            </button>
            <button type="button" className={p.button} onClick={() => apply((l) => unlinkPair(l, inst.id))}>
              Unlink
            </button>
          </div>
        </div>
      )}

      {def.category === 'speaker' && (
        <div className={p.section}>
          <h3 className={p.sectionTitle}>Speaker</h3>
          <NumberField
            label="Acoustic centre"
            value={def.speaker?.acousticCentreHeight ?? def.size.h * 0.8}
            min={0}
            title="Height of the tweeter / acoustic axis above the cabinet base"
            onCommit={(acousticCentreHeight) => patchDef({ speaker: { rearPorted: def.speaker?.rearPorted ?? false, acousticCentreHeight } })}
          />
          <label className={p.checkbox}>
            <input
              type="checkbox"
              checked={def.speaker?.rearPorted ?? false}
              onChange={(e) =>
                patchDef({ speaker: { acousticCentreHeight: def.speaker?.acousticCentreHeight ?? def.size.h * 0.8, rearPorted: e.currentTarget.checked } })
              }
            />
            Rear-ported
          </label>
          <RoleField inst={inst} />
        </div>
      )}

      <div className={p.section}>
        <label className={p.checkbox}>
          <input type="checkbox" checked={inst.locked} onChange={(e) => patch({ locked: e.currentTarget.checked })} />
          Locked
        </label>
        <label className={p.checkbox}>
          <input type="checkbox" checked={inst.visible} onChange={(e) => patch({ visible: e.currentTarget.checked })} />
          Visible
        </label>
        <div className={p.row} style={{ marginTop: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={p.button}
            title="Duplicate (Ctrl+D)"
            onClick={() => duplicateObject(inst.id)}
          >
            <Icon name="copy" size={14} /> Duplicate
          </button>
          <button
            type="button"
            className={p.button}
            title="Keep this item (with its size) in the Library under My presets"
            onClick={() => {
              addUserPreset(presetFromDefinition(def, newId('preset'), inst.position.y));
              setSavedName(def.name);
            }}
          >
            Save as preset
          </button>
          <button
            type="button"
            className={p.dangerButton}
            title="Delete (Del)"
            disabled={locked}
            onClick={() => deleteObject(inst.id)}
          >
            <Icon name="trash" size={14} /> Delete
          </button>
        </div>
        {savedName && <p className={p.note}>Saved “{savedName}” to Library → My presets.</p>}
      </div>
    </div>
  );
}

/** Which corner of the speaker triangle this object is (any object can be chosen). */
function RoleField({ inst }: { inst: ObjectInstance }) {
  const apply = useStore((s) => s.apply);
  return (
    <label className={p.selectField} title="The speaker triangle uses the objects marked Left and Right. Choosing one here takes it from any other object.">
      Speaker role
      <select
        className={p.select}
        value={inst.role ?? ''}
        onChange={(e) => {
          const v = e.currentTarget.value;
          const role = v === 'speakerL' || v === 'speakerR' ? v : null;
          apply((l) => setSpeakerRole(l, inst.id, role));
        }}
      >
        <option value="">None</option>
        <option value="speakerL">Left</option>
        <option value="speakerR">Right</option>
      </select>
    </label>
  );
}
