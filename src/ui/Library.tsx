import { useState } from 'react';
import { CATEGORY_INFO } from '../model/categories';
import { ASPECT_RATIOS, BUILT_IN_PRESETS, DEFAULT_MONITOR, monitorPanelSize, monitorPreset, PRESET_GROUPS } from '../model/presets';
import type { Preset } from '../model/presets';
import type { AspectRatio } from '../model/types';
import { addPreset } from '../store/commands';
import { useStore } from '../store/store';
import { Icon } from './Icon';
import { NumberField } from './NumberField';
import p from './panel.module.css';
import s from './Sidebar.module.css';

const add = (preset: Preset, pair: boolean) => addPreset(preset, { pair });

export function Library() {
  const userPresets = useStore((st) => st.userPresets);
  const removeUserPreset = useStore((st) => st.removeUserPreset);
  const all = [...BUILT_IN_PRESETS, ...userPresets];

  return (
    <div className={s.list}>
      <MonitorGenerator />
      {PRESET_GROUPS.map((group) => {
        const presets = all.filter((pr) => pr.group === group);
        if (group === 'My presets' && presets.length === 0) {
          return (
            <section key={group} className={s.group}>
              <h3 className={s.groupTitle}>{group}</h3>
              <p className={s.groupNote}>Select an object and choose “Save as preset” in the Inspector to keep your own measured items here.</p>
            </section>
          );
        }
        const speakers = group === 'Speakers';
        return (
          <section key={group} className={s.group}>
            <h3 className={s.groupTitle}>{group}</h3>
            {speakers && <p className={s.groupNote}>Speakers are added as a linked left/right pair.</p>}
            {presets.map((pr) => (
              <div key={pr.id} className={s.item} onClick={() => add(pr, speakers || pr.category === 'speaker')} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') add(pr, speakers || pr.category === 'speaker'); }}>
                <span className={p.dot} style={{ background: pr.colour ?? CATEGORY_INFO[pr.category].tint }} />
                <span className={s.itemText}>
                  <span>{pr.name}</span>
                  <span className={`${s.sub} num`}>
                    {Math.round(pr.size.w)} × {Math.round(pr.size.d)} × {Math.round(pr.size.h)} mm{pr.approx ? ' · approx' : ''}
                  </span>
                </span>
                <button
                  type="button"
                  className={s.mini}
                  title={speakers || pr.category === 'speaker' ? 'Add just one' : 'Add as a mirrored L/R pair'}
                  onClick={(e) => {
                    e.stopPropagation();
                    add(pr, !(speakers || pr.category === 'speaker'));
                  }}
                >
                  {speakers || pr.category === 'speaker' ? '1×' : 'Pair'}
                </button>
                {group === 'My presets' && (
                  <button
                    type="button"
                    className={p.iconButton}
                    title="Remove preset"
                    aria-label={`Remove preset ${pr.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeUserPreset(pr.id);
                    }}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                )}
              </div>
            ))}
          </section>
        );
      })}
      <p className={s.groupNote}>Built-in sizes are approximate. Measure your own and edit them in the Inspector.</p>
    </div>
  );
}

function MonitorGenerator() {
  const [m, setM] = useState(DEFAULT_MONITOR);
  const size = monitorPanelSize(m);
  return (
    <section className={`${s.group} ${s.card}`}>
      <h3 className={s.groupTitle}>Monitor</h3>
      <NumberField label="Diagonal" unit="in" decimals={1} step={0.5} min={5} max={100} value={m.diagonalIn} onCommit={(diagonalIn) => setM({ ...m, diagonalIn })} />
      <label className={p.selectField}>
        Aspect
        <select className={p.select} value={m.aspect} onChange={(e) => setM({ ...m, aspect: e.currentTarget.value as AspectRatio })}>
          {ASPECT_RATIOS.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </label>
      <NumberField label="Bezel" value={m.bezelMm} min={0} onCommit={(bezelMm) => setM({ ...m, bezelMm })} />
      <NumberField label="Panel depth" value={m.panelDepth} min={1} onCommit={(panelDepth) => setM({ ...m, panelDepth })} />
      <label className={p.selectField}>
        Support
        <select className={p.select} value={m.support} onChange={(e) => setM({ ...m, support: e.currentTarget.value === 'stand' ? 'stand' : 'mount' })}>
          <option value="mount">Arm / mount</option>
          <option value="stand">Stand</option>
        </select>
      </label>
      <div className={s.genFooter}>
        <span className={`${s.sub} num`}>
          {Math.round(size.w)} × {Math.round(size.h)} mm
        </span>
        <button type="button" className={p.button} onClick={() => add(monitorPreset(m), false)}>
          <Icon name="plus" size={14} /> Add monitor
        </button>
      </div>
    </section>
  );
}
