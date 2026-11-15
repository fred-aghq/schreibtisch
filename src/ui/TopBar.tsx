import { createDefaultLayout } from '../model/defaults';
import { useLayout, useStore } from '../store/store';
import { Icon } from './Icon';
import s from './TopBar.module.css';

export function TopBar() {
  const layout = useLayout();
  const canUndo = useStore((st) => st.history.past.length > 0);
  const canRedo = useStore((st) => st.history.future.length > 0);
  const view = useStore((st) => st.view);
  const theme = useStore((st) => st.theme);
  const { apply, undo, redo, setView, toggleTheme, replaceLayout, requestFit } = useStore.getState();

  return (
    <header className={s.bar}>
      <div className={s.brand}>
        <span className={s.logo} aria-hidden="true" />
        <span className={s.app}>Schreibtisch</span>
        <span className={s.slash}>/</span>
        <input
          className={s.name}
          value={layout.name}
          aria-label="Layout name"
          onChange={(e) => {
            const name = e.currentTarget.value;
            apply((l) => ({ ...l, name }));
          }}
        />
      </div>

      <div className={s.segment} role="group" aria-label="View">
        <button type="button" className={view === '2d' ? s.segOn : s.seg} onClick={() => setView('2d')}>
          2D
        </button>
        <button type="button" className={view === '3d' ? s.segOn : s.seg} onClick={() => setView('3d')} title="Coming in milestone 2">
          3D
        </button>
      </div>

      <div className={s.actions}>
        <button type="button" className={s.icon} onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
          <Icon name="undo" />
        </button>
        <button type="button" className={s.icon} onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
          <Icon name="redo" />
        </button>
        <span className={s.sep} />
        <button
          type="button"
          className={s.text}
          title="Start again with the default layout"
          onClick={() => {
            if (window.confirm('Replace the current layout with a fresh default one? This cannot be undone.')) {
              replaceLayout(createDefaultLayout());
              requestFit();
            }
          }}
        >
          Reset
        </button>
        <button type="button" className={s.icon} onClick={toggleTheme} title={theme === 'dark' ? 'Light mode' : 'Dark mode'} aria-label="Toggle theme">
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </div>
    </header>
  );
}
