import type { GridStep } from '../model/types';
import { setSettings } from '../store/ops';
import { useLayout, useStore } from '../store/store';
import s from './StatusBar.module.css';

const STEPS: GridStep[] = [1, 5, 10, 50];

export function StatusBar() {
  const zoom = useStore((st) => st.zoom);
  const cursor = useStore((st) => st.cursor);
  const view = useStore((st) => st.view);
  const apply = useStore((st) => st.apply);
  const { settings } = useLayout();

  return (
    <footer className={s.bar}>
      {view === '2d' && <span className="num">Zoom {Math.round(zoom * 100)}%</span>}
      <span className="num" title="Left–right (X) and front–back (Z) under the cursor">
        {cursor ? (
          <>
            <span className={s.k}>L–R</span> {Math.round(cursor.x)} mm <span className={s.k}>F–B</span> {Math.round(cursor.z)} mm
          </>
        ) : (
          <span className={s.k}>Move over the plan to see positions</span>
        )}
      </span>
      <span className={s.spacer} />
      <label className={s.snap} title="Snapping (hold Alt while dragging to bypass)">
        <input
          type="checkbox"
          checked={settings.snapEnabled}
          onChange={(e) => {
            const snapEnabled = e.currentTarget.checked;
            apply((l) => setSettings(l, { snapEnabled }));
          }}
        />
        Snap
        <select
          value={settings.snapStep}
          disabled={!settings.snapEnabled}
          onChange={(e) => {
            const snapStep = Number(e.currentTarget.value) as GridStep;
            apply((l) => setSettings(l, { snapStep }));
          }}
        >
          {STEPS.map((st) => (
            <option key={st} value={st}>
              {st} mm
            </option>
          ))}
        </select>
      </label>
      <span className={s.k}>Alt = no snap · Space+drag = pan</span>
    </footer>
  );
}
