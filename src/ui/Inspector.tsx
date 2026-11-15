import { useState } from 'react';
import { CATEGORY_INFO } from '../model/categories';
import { newId } from '../model/ids';
import { presetFromDefinition } from '../model/presets';
import type { AspectRatio, Layout, ObjectDefinition, ObjectInstance } from '../model/types';
import {
  countInstancesOf,
  makeUnique,
  moveInstance,
  pairPartner,
  regenerateMonitor,
  setBackWall,
  setDesk,
  setListener,
  setSettings,
  unlinkPair,
  updateDefinition,
  updateInstance,
} from '../model/ops';
import type { InstancePatch, MonitorEdit, PosePatch } from '../model/ops';
import { deleteObject, duplicateObject } from '../store/commands';
import { useLayout, useStore } from '../store/store';
import { Icon } from './Icon';
import { NumberField } from './NumberField';
import p from './panel.module.css';

export function Inspector() {
  const layout = useLayout();
  const selection = useStore((s) => s.selection);

  if (selection?.kind === 'instance') {
    const inst = layout.instances.find((i) => i.id === selection.id);
    const def = inst ? layout.definitions[inst.definitionId] : undefined;
    if (inst && def) return <InstanceInspector layout={layout} inst={inst} def={def} />;
  }
  if (selection?.kind === 'listener') return <ListenerInspector layout={layout} />;
  return <LayoutInspector layout={layout} />;
}

function InstanceInspector({ layout, inst, def }: { layout: Layout; inst: ObjectInstance; def: ObjectDefinition }) {
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
        <input
          className={p.titleInput}
          value={inst.label}
          aria-label="Label"
          onChange={(e) => patch({ label: e.currentTarget.value })}
        />
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
          <label className={p.selectField}>
            Shape
            <select className={p.select} value={def.shape} onChange={(e) => patchDef({ shape: e.currentTarget.value === 'cylinder' ? 'cylinder' : 'box' })}>
              <option value="box">Box</option>
              <option value="cylinder">Cylinder</option>
            </select>
          </label>
          <label className={p.selectField}>
            Colour
            <input className={p.colourInput} type="color" value={def.colour} onChange={(e) => patchDef({ colour: e.currentTarget.value })} />
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

const ASPECTS: AspectRatio[] = ['16:9', '16:10', '21:9', '32:9'];

function MonitorSection({ def, inst }: { def: ObjectDefinition; inst: ObjectInstance }) {
  const apply = useStore((s) => s.apply);
  const m = def.monitor;
  const bezelMm = m?.bezelMm ?? 8;
  const current: MonitorEdit = {
    diagonalIn: m?.diagonalIn ?? Math.round((Math.hypot(def.size.w - 2 * bezelMm, def.size.h - 2 * bezelMm) / 25.4) * 10) / 10,
    aspect: m?.aspect ?? '16:9',
    bezelMm,
    panelDepth: def.size.d,
    support: m?.support ?? 'mount',
    ...(m?.stand ? { stand: m.stand } : {}),
  };
  const regen = (pt: Partial<MonitorEdit>) => {
    const next = { ...current, ...pt };
    apply((l) => {
      let out = regenerateMonitor(l, def.id, next);
      // Lift the panel onto a newly added stand so the stand is visible.
      if (pt.support === 'stand' && inst.position.y <= 0) {
        const stand = out.definitions[def.id]?.monitor?.stand;
        if (stand) out = moveInstance(out, inst.id, { position: { y: stand.h } });
      }
      return out;
    });
  };
  const stand = m?.support === 'stand' ? m.stand : undefined;
  return (
    <div className={p.section}>
      <h3 className={p.sectionTitle}>Monitor</h3>
      <p className={p.note}>Changing these recomputes the panel size.</p>
      <NumberField label="Diagonal" unit="in" decimals={1} step={0.5} min={5} max={100} value={current.diagonalIn} onCommit={(diagonalIn) => regen({ diagonalIn })} />
      <label className={p.selectField}>
        Aspect
        <select className={p.select} value={current.aspect} onChange={(e) => regen({ aspect: e.currentTarget.value as AspectRatio })}>
          {ASPECTS.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </label>
      <NumberField label="Bezel" value={current.bezelMm} min={0} onCommit={(b) => regen({ bezelMm: b })} />
      <label className={p.selectField}>
        Support
        <select className={p.select} value={current.support} onChange={(e) => regen({ support: e.currentTarget.value === 'stand' ? 'stand' : 'mount' })}>
          <option value="mount">Arm / mount</option>
          <option value="stand">Stand</option>
        </select>
      </label>
      {stand && (
        <>
          <NumberField label="Stand base width" value={stand.w} min={10} onCommit={(w) => regen({ stand: { ...stand, w } })} />
          <NumberField label="Stand base depth" value={stand.d} min={10} onCommit={(d) => regen({ stand: { ...stand, d } })} />
        </>
      )}
    </div>
  );
}

function ListenerFields({ layout }: { layout: Layout }) {
  const apply = useStore((s) => s.apply);
  const l = layout.listener;
  return (
    <>
      <NumberField label="Left–right" hint="X" value={l.x} onCommit={(x) => apply((lay) => setListener(lay, { x }))} title="0 = desk centreline" />
      <NumberField
        label="Distance to ears"
        hint="Z"
        value={l.distanceFromFrontEdge}
        onCommit={(distanceFromFrontEdge) => apply((lay) => setListener(lay, { distanceFromFrontEdge }))}
        title="Sit normally; measure from the desk's front edge to roughly between your ears"
      />
      <NumberField
        label="Ear height"
        hint="from floor"
        value={l.earHeightFromFloor}
        min={0}
        onCommit={(earHeightFromFloor) => apply((lay) => setListener(lay, { earHeightFromFloor }))}
        title="Sit normally; measure from the floor to your ear canal"
      />
    </>
  );
}

function ListenerInspector({ layout }: { layout: Layout }) {
  return (
    <div className={p.panel}>
      <div className={p.section}>
        <h3 className={p.sectionTitle}>Listener</h3>
        <p className={p.note}>
          Sit normally and measure from the desk&apos;s front edge to roughly between your ears. This drives the speaker triangle, so it&apos;s worth measuring.
        </p>
        <ListenerFields layout={layout} />
      </div>
    </div>
  );
}

function LayoutInspector({ layout }: { layout: Layout }) {
  const apply = useStore((s) => s.apply);
  const { desk, settings } = layout;
  return (
    <div className={p.panel}>
      <div className={p.empty}>Select an object on the plan or in the Scene list to edit it. Drag the head marker to move the listener.</div>

      <div className={p.section}>
        <h3 className={p.sectionTitle}>Desk</h3>
        <NumberField label="Width" hint="X" value={desk.width} min={100} onCommit={(width) => apply((l) => setDesk(l, { width }))} />
        <NumberField label="Depth" hint="Z" value={desk.depth} min={100} onCommit={(depth) => apply((l) => setDesk(l, { depth }))} />
        <NumberField label="Thickness" value={desk.thickness} min={1} onCommit={(thickness) => apply((l) => setDesk(l, { thickness }))} />
        <NumberField
          label="Height from floor"
          value={desk.heightFromFloor}
          min={1}
          title="Floor to the top surface of the desk"
          onCommit={(heightFromFloor) => apply((l) => setDesk(l, { heightFromFloor }))}
        />
        <label className={p.selectField}>
          Colour
          <input className={p.colourInput} type="color" value={desk.colour} onChange={(e) => apply((l) => setDesk(l, { colour: e.currentTarget.value }))} />
        </label>
      </div>

      <div className={p.section}>
        <h3 className={p.sectionTitle}>Listener</h3>
        <ListenerFields layout={layout} />
      </div>

      <div className={p.section}>
        <h3 className={p.sectionTitle}>Back wall</h3>
        <label className={p.checkbox}>
          <input
            type="checkbox"
            checked={layout.backWall !== null}
            onChange={(e) => {
              const on = e.currentTarget.checked;
              apply((l) => setBackWall(l, on ? { distanceBehindDesk: 50 } : null));
            }}
          />
          There is a wall behind the desk
        </label>
        {layout.backWall && (
          <NumberField
            label="Gap to wall"
            value={layout.backWall.distanceBehindDesk}
            min={0}
            onCommit={(distanceBehindDesk) => apply((l) => setBackWall(l, { distanceBehindDesk }))}
          />
        )}
      </div>

      <div className={p.section}>
        <h3 className={p.sectionTitle}>Grid</h3>
        <label className={p.checkbox}>
          <input type="checkbox" checked={settings.showGrid} onChange={(e) => apply((l) => setSettings(l, { showGrid: e.currentTarget.checked }))} />
          Show grid
        </label>
        <NumberField label="Grid spacing" value={settings.gridSpacing} min={5} onCommit={(gridSpacing) => apply((l) => setSettings(l, { gridSpacing }))} />
      </div>
    </div>
  );
}
