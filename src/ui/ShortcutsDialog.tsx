import { useStore } from '../store/store';
import s from './ShortcutsDialog.module.css';

const GROUPS: { title: string; rows: [string, string][] }[] = [
  {
    title: 'Editing',
    rows: [
      ['← → ↑ ↓', 'Nudge 1 mm (Shift: 10 mm)'],
      ['Q / E', 'Rotate 1° (Shift: 15°)'],
      ['Ctrl+D', 'Duplicate'],
      ['Del', 'Delete'],
      ['Ctrl+Z', 'Undo'],
      ['Ctrl+Shift+Z', 'Redo'],
      ['Ctrl+S', 'Save layout'],
      ['Esc', 'Deselect / cancel drag'],
    ],
  },
  {
    title: 'Dragging',
    rows: [
      ['Alt', 'Bypass snapping'],
      ['Shift (3D)', 'Move vertically'],
    ],
  },
  {
    title: 'View',
    rows: [
      ['F', 'Zoom to fit'],
      ['1 – 5', 'Top, Front, Side, Isometric, Seated'],
      ['Space+drag', 'Pan (2D)'],
      ['T', 'Speaker triangle'],
      ['?', 'This cheat sheet'],
    ],
  },
];

export function ShortcutsDialog() {
  const open = useStore((st) => st.showShortcuts);
  const setOpen = useStore((st) => st.setShowShortcuts);
  if (!open) return null;
  return (
    <div className={s.backdrop} onClick={() => setOpen(false)}>
      <div className={s.dialog} role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" onClick={(e) => e.stopPropagation()}>
        <header className={s.header}>
          <h2 id="shortcuts-title">Keyboard shortcuts</h2>
          <button type="button" className={s.close} onClick={() => setOpen(false)} aria-label="Close">
            ×
          </button>
        </header>
        <div className={s.grid}>
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h3>{g.title}</h3>
              <dl>
                {g.rows.map(([k, v]) => (
                  <div key={k} className={s.row}>
                    <dt>
                      <kbd>{k}</kbd>
                    </dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
