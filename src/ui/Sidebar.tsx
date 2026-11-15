import { useMemo, useState } from 'react';
import { findOverlaps } from '../geometry/overlap';
import { CATEGORY_INFO } from '../model/categories';
import { deleteInstance, duplicateInstance, updateInstance } from '../model/ops';
import { useLayout, useStore } from '../store/store';
import { Icon } from './Icon';
import { Library } from './Library';
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

function SceneList() {
  const layout = useLayout();
  const selection = useStore((st) => st.selection);
  const select = useStore((st) => st.select);
  const apply = useStore((st) => st.apply);
  const setTab = useStore((st) => st.setSidebarTab);
  const [renaming, setRenaming] = useState<string | null>(null);
  const overlaps = useMemo(() => findOverlaps(layout), [layout]);

  return (
    <div className={s.list}>
      <button type="button" className={`${s.item} ${selection?.kind === 'listener' ? s.itemSel : ''}`} onClick={() => select({ kind: 'listener' })}>
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
        const subParts = [
          inst.role === 'speakerL' ? 'Speaker L' : inst.role === 'speakerR' ? 'Speaker R' : null,
          inst.pairId ? 'paired' : null,
        ].filter(Boolean);
        return (
          <div
            key={inst.id}
            className={`${s.item} ${sel ? s.itemSel : ''} ${inst.visible ? '' : s.hidden}`}
            onClick={() => select({ kind: 'instance', id: inst.id })}
            onDoubleClick={() => setRenaming(inst.id)}
          >
            <span className={p.dot} style={{ background: def ? CATEGORY_INFO[def.category].tint : 'gray' }} />
            <span className={s.itemText}>
              {renaming === inst.id ? (
                <input
                  className={s.renameInput}
                  defaultValue={inst.label}
                  aria-label="Rename"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    const label = e.currentTarget.value.trim();
                    if (label && label !== inst.label) apply((l) => updateInstance(l, inst.id, { label }));
                    setRenaming(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') {
                      e.stopPropagation();
                      setRenaming(null);
                    }
                  }}
                />
              ) : (
                <span title="Double-click to rename">{inst.label}</span>
              )}
              {(subParts.length > 0 || overlaps.has(inst.id)) && (
                <span className={s.sub}>
                  {subParts.join(' · ')}
                  {overlaps.has(inst.id) && <span className={s.warn}>{subParts.length ? ' · ' : ''}overlaps</span>}
                </span>
              )}
            </span>
            <span className={s.rowActions}>
              <button
                type="button"
                className={p.iconButton}
                title="Duplicate"
                aria-label={`Duplicate ${inst.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  let id = inst.id;
                  apply((l) => {
                    const r = duplicateInstance(l, inst.id);
                    id = r.instanceId;
                    return r.layout;
                  });
                  select({ kind: 'instance', id });
                }}
              >
                <Icon name="copy" size={14} />
              </button>
              <button
                type="button"
                className={p.iconButton}
                title="Delete"
                aria-label={`Delete ${inst.label}`}
                disabled={inst.locked}
                onClick={(e) => {
                  e.stopPropagation();
                  apply((l) => deleteInstance(l, inst.id));
                  if (sel) select(null);
                }}
              >
                <Icon name="trash" size={14} />
              </button>
            <button
                type="button"
                className={inst.locked ? p.iconButtonOn : p.iconButton}
                title={inst.locked ? 'Unlock' : 'Lock'}
                aria-label={inst.locked ? `Unlock ${inst.label}` : `Lock ${inst.label}`}
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
                aria-label={inst.visible ? `Hide ${inst.label}` : `Show ${inst.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  apply((l) => updateInstance(l, inst.id, { visible: !inst.visible }));
                }}
              >
                <Icon name={inst.visible ? 'eye' : 'eyeOff'} size={14} />
              </button>
            </span>
            {(inst.locked || !inst.visible) && (
              <span className={s.flags} aria-hidden="true">
                {inst.locked && <Icon name="lock" size={13} />}
                {!inst.visible && <Icon name="eyeOff" size={13} />}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
