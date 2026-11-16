import { setListener } from '../model/ops';
import type { Layout } from '../model/types';
import { useStore } from '../store/store';
import { NumberField } from './NumberField';
import p from './panel.module.css';

export function ListenerFields({ layout }: { layout: Layout }) {
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

export function ListenerInspector({ layout }: { layout: Layout }) {
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
