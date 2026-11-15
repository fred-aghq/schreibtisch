import { CATEGORY_INFO } from '../model/categories';
import type { Layout, ObjectDefinition, ObjectInstance } from '../model/types';
import { countInstancesOf, deleteInstance, duplicateInstance, setDesk, setListener, setSettings, updateDefinition, updateInstance } from '../store/ops';
import type { InstancePatch } from '../store/ops';
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
  const patch = (pt: InstancePatch) => apply((l) => updateInstance(l, inst.id, pt));
  const patchDef = (pt: Parameters<typeof updateDefinition>[2]) => apply((l) => updateDefinition(l, def.id, pt));
  const shared = countInstancesOf(layout, def.id);
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
        {shared > 1 && <p className={p.note}>Shared by {shared} objects: changes apply to all of them.</p>}
        <NumberField label="Width" hint="X" value={def.size.w} min={1} onCommit={(w) => patchDef({ size: { w }, approx: false })} />
        <NumberField label="Depth" hint="Z" value={def.size.d} min={1} onCommit={(d) => patchDef({ size: { d }, approx: false })} />
        <NumberField label="Height" hint="Y" value={def.size.h} min={1} onCommit={(h) => patchDef({ size: { h }, approx: false })} />
      </div>

      <div className={p.section}>
        <h3 className={p.sectionTitle}>Position</h3>
        <NumberField label="Left–right" hint="X" value={inst.position.x} disabled={locked} onCommit={(x) => patch({ position: { x } })} title="0 = desk centreline, + = right" />
        <NumberField label="Front–back" hint="Z" value={inst.position.z} disabled={locked} onCommit={(z) => patch({ position: { z } })} title="0 = desk front edge, − = toward the back" />
        <NumberField label="Elevation" hint="Y" value={inst.position.y} disabled={locked} onCommit={(y) => patch({ position: { y } })} title="0 = sitting on the desk, − = below the desk top" />
      </div>

      <div className={p.section}>
        <h3 className={p.sectionTitle}>Rotation</h3>
        <NumberField label="Yaw" unit="°" value={inst.rotation.yaw} disabled={locked} onCommit={(yaw) => patch({ rotation: { yaw } })} title="0 = facing you, + = turned toward your right" />
        <details className={p.details}>
          <summary>Advanced</summary>
          <NumberField label="Pitch (tilt)" unit="°" value={inst.rotation.pitch} min={-90} max={90} disabled={locked} onCommit={(pitch) => patch({ rotation: { pitch } })} title="+ = front tilted upward" />
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
        <div className={p.row} style={{ marginTop: 8 }}>
          <button
            type="button"
            className={p.button}
            title="Duplicate (Ctrl+D)"
            onClick={() => {
              let id = inst.id;
              apply((l) => {
                const r = duplicateInstance(l, inst.id);
                id = r.instanceId;
                return r.layout;
              });
              select({ kind: 'instance', id });
            }}
          >
            <Icon name="copy" size={14} /> Duplicate
          </button>
          <button
            type="button"
            className={p.dangerButton}
            title="Delete (Del)"
            disabled={locked}
            onClick={() => {
              apply((l) => deleteInstance(l, inst.id));
              select(null);
            }}
          >
            <Icon name="trash" size={14} /> Delete
          </button>
        </div>
      </div>
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
              apply((l) => ({ ...l, backWall: on ? { distanceBehindDesk: 50 } : null }));
            }}
          />
          There is a wall behind the desk
        </label>
        {layout.backWall && (
          <NumberField
            label="Gap to wall"
            value={layout.backWall.distanceBehindDesk}
            min={0}
            onCommit={(distanceBehindDesk) => apply((l) => ({ ...l, backWall: { distanceBehindDesk } }))}
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
