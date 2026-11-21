import { useEffect, useRef, useState } from 'react';
import { useLayout, useStore } from '../store/store';
import { Icon } from './Icon';
import { useIsSaved } from './useIsSaved';
import s from './LayoutsMenu.module.css';

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Save button plus a menu of layouts saved in this browser. */
export function LayoutsMenu() {
  const layout = useLayout();
  const saved = useStore((st) => st.savedLayouts);
  const isSaved = useIsSaved();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && e.target instanceof Node && !root.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const save = () => setError(!useStore.getState().saveLayout());

  const openLayout = (id: string, name: string) => {
    const st = useStore.getState();
    if (id === layout.id && isSaved) {
      setOpen(false);
      return;
    }
    const warning = isSaved
      ? `Open “${name}”?`
      : `Open “${name}”? “${layout.name}” has unsaved changes, which will be lost. Save it first if you want to keep them.`;
    if (!window.confirm(warning)) return;
    st.openSavedLayout(id);
    st.sendViewCommand({ kind: 'fit' });
    setOpen(false);
  };

  return (
    <div className={s.root} ref={root}>
      <button type="button" className={s.save} onClick={save} disabled={isSaved} title={isSaved ? 'Saved in this browser' : 'Save this layout in this browser (Ctrl+S)'}>
        {isSaved ? 'Saved' : 'Save'}
        {!isSaved && <span className={s.dot} aria-label="unsaved changes" />}
      </button>
      <button type="button" className={s.menuButton} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="true">
        Layouts <span aria-hidden="true">▾</span>
      </button>
      {error && <span className={s.error}>Couldn’t save (browser storage full or blocked)</span>}
      {open && (
        <div className={s.menu} role="menu" aria-label="Saved layouts">
          {saved.length === 0 ? (
            <p className={s.empty}>No saved layouts yet. Save keeps a copy in this browser that you can come back to.</p>
          ) : (
            saved.map(({ layout: l, savedAt }) => (
              <div key={l.id} className={`${s.item} ${l.id === layout.id ? s.current : ''}`}>
                <button type="button" role="menuitem" className={s.open} onClick={() => openLayout(l.id, l.name)}>
                  <span className={s.name}>{l.name}</span>
                  <span className={s.meta}>
                    {l.id === layout.id ? (isSaved ? 'open now' : 'open now · unsaved changes') : when(savedAt)}
                  </span>
                </button>
                <button
                  type="button"
                  className={s.delete}
                  title="Delete this saved copy"
                  aria-label={`Delete saved layout ${l.name}`}
                  onClick={() => {
                    if (window.confirm(`Delete the saved layout “${l.name}”? This can’t be undone.`)) useStore.getState().deleteSavedLayout(l.id);
                  }}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))
          )}
          <p className={s.footnote}>Saved in this browser only.</p>
        </div>
      )}
    </div>
  );
}
