import { setBackWall, setDesk, setSettings } from '../model/ops';
import type { Layout } from '../model/types';
import { useStore } from '../store/store';
import { ColourField } from './ColourField';
import { ListenerFields } from './ListenerInspector';
import { NumberField } from './NumberField';
import p from './panel.module.css';

export function LayoutInspector({ layout }: { layout: Layout }) {
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
          <ColourField className={p.colourInput} value={desk.colour} onInput={(colour) => apply((l) => setDesk(l, { colour }))} />
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
