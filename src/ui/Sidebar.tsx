import { CATEGORY_INFO } from '../model/categories';
import { QUICK_ADD } from '../model/defaults';
import { addObject, updateInstance } from '../store/ops';
import { useLayout, useStore } from '../store/store';
import { Icon } from './Icon';
import p from './panel.module.css';
import s from './Sidebar.module.css';

export function Sidebar() {
  const tab = useStore((st) => st.sidebarTab);
  const setTab = useStore((st) => st.setSidebarTab);
  return (
    <div className={s.sidebar}>
      <div className={s.tabs} role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'library'} className={tab === 'library' ? s.tabOn : s.tab} onClick={() => setTab('library')}>
          Library
        </button>
        <button type="button" role="tab" aria-selected={tab === 'scene'} className={tab === 'scene' ? s.tabOn : s.tab} onClick={() => setTab('scene')}>
          Scene
        </button>
      </div>
      <div className={s.body}>{tab === 'library' ? <Library /> : <SceneList />}</div>
    </div>
  );
}

function Library() {
  const apply = useStore((st) => st.apply);
  const select = useStore((st) => st.select);
  return (
    <div className={s.list}>
      <p className={p.note} style={{ padding: '0 4px' }}>
        Click to add to the middle of the desk. Sizes are approximate, so measure yours and edit them in the Inspector.
      </p>
      {QUICK_ADD.map((t) => (
        <button
          key={t.name}
          type="button"
          className={s.item}
          onClick={() => {
            let id = '';
            apply((l) => {
              const r = addObject(l, t);
              id = r.instanceId;
              return r.layout;
            });
            select({ kind: 'instance', id });
          }}
        >
          <span className={p.dot} style={{ background: CATEGORY_INFO[t.category].tint }} />
          <span className={s.itemText}>
            <span>{t.name}</span>
            <span className={`${s.sub} num`}>
              {t.size.w} × {t.size.d} × {t.size.h} mm
            </span>
          </span>
          <Icon name="plus" size={14} />
        </button>
      ))}
    </div>
  );
}

function SceneList() {
  const layout = useLayout();
  const selection = useStore((st) => st.selection);
  const select = useStore((st) => st.select);
  const apply = useStore((st) => st.apply);
  const setTab = useStore((st) => st.setSidebarTab);

  return (
    <div className={s.list}>
      <button
        type="button"
        className={`${s.item} ${selection?.kind === 'listener' ? s.itemSel : ''}`}
        onClick={() => select({ kind: 'listener' })}
      >
        <span className={p.dot} style={{ background: 'var(--listener)' }} />
        <span className={s.itemText}>
          <span>Listener</span>
          <span className={`${s.sub} num`}>{Math.round(layout.listener.distanceFromFrontEdge)} mm from desk edge</span>
        </span>
      </button>
      {layout.instances.length === 0 && (
        <div className={p.empty}>
          The desk is empty.{' '}
          <button type="button" className={s.link} onClick={() => setTab('library')}>
            Open the Library
          </button>{' '}
          to add monitors, speakers and more.
        </div>
      )}
      {layout.instances.map((inst) => {
        const def = layout.definitions[inst.definitionId];
        const sel = selection?.kind === 'instance' && selection.id === inst.id;
        return (
          <div key={inst.id} className={`${s.item} ${sel ? s.itemSel : ''} ${inst.visible ? '' : s.hidden}`} onClick={() => select({ kind: 'instance', id: inst.id })}>
            <span className={p.dot} style={{ background: def ? CATEGORY_INFO[def.category].tint : 'gray' }} />
            <span className={s.itemText}>
              <span>{inst.label}</span>
              {inst.role && <span className={s.sub}>{inst.role === 'speakerL' ? 'Speaker L' : 'Speaker R'}{inst.pairId ? ' · paired' : ''}</span>}
            </span>
            <button
              type="button"
              className={inst.locked ? p.iconButtonOn : p.iconButton}
              title={inst.locked ? 'Unlock' : 'Lock'}
              aria-label={inst.locked ? 'Unlock' : 'Lock'}
              onClick={(e) => {
                e.stopPropagation();
                apply((l) => updateInstance(l, inst.id, { locked: !inst.locked }));
              }}
            >
              <Icon name={inst.locked ? 'lock' : 'unlock'} size={14} />
            </button>
            <button
              type="button"
              className={p.iconButton}
              title={inst.visible ? 'Hide' : 'Show'}
              aria-label={inst.visible ? 'Hide' : 'Show'}
              onClick={(e) => {
                e.stopPropagation();
                apply((l) => updateInstance(l, inst.id, { visible: !inst.visible }));
              }}
            >
              <Icon name={inst.visible ? 'eye' : 'eyeOff'} size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
