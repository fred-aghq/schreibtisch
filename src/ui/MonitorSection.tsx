import { MM_PER_INCH } from '../geometry/monitor';
import { moveInstance, regenerateMonitor } from '../model/ops';
import type { MonitorEdit } from '../model/ops';
import { ASPECT_RATIOS } from '../model/presets';
import type { AspectRatio, ObjectDefinition, ObjectInstance } from '../model/types';
import { useStore } from '../store/store';
import { NumberField } from './NumberField';
import p from './panel.module.css';

export function MonitorSection({ def, inst }: { def: ObjectDefinition; inst: ObjectInstance }) {
  const apply = useStore((s) => s.apply);
  const m = def.monitor;
  const bezelMm = m?.bezelMm ?? 8;
  const current: MonitorEdit = {
    diagonalIn: m?.diagonalIn ?? Math.round((Math.hypot(def.size.w - 2 * bezelMm, def.size.h - 2 * bezelMm) / MM_PER_INCH) * 10) / 10,
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
          {ASPECT_RATIOS.map((a) => (
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
