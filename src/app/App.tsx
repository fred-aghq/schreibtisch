import { lazy, Suspense, useEffect } from 'react';
import { useStore } from '../store/store';
import { Inspector } from '../ui/Inspector';
import { ShortcutsDialog } from '../ui/ShortcutsDialog';
import { Sidebar } from '../ui/Sidebar';
import { StatusBar } from '../ui/StatusBar';
import { TopBar } from '../ui/TopBar';
import { PlanView } from '../views/plan2d/PlanView';
import styles from './App.module.css';
import { useShortcuts } from './useShortcuts';

// three.js is large; load it only when the 3D view is first opened.
const SceneView = lazy(() => import('../views/scene3d/SceneView'));

export function App() {
  const theme = useStore((s) => s.theme);
  const view = useStore((s) => s.view);
  useShortcuts();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className={styles.app}>
      <TopBar />
      <aside className={styles.left}>
        <Sidebar />
      </aside>
      <main className={styles.canvas}>
        {view === '2d' ? (
          <PlanView />
        ) : (
          <Suspense fallback={<div className={styles.placeholder}>Loading 3D view…</div>}>
            <SceneView />
          </Suspense>
        )}
      </main>
      <aside className={styles.right}>
        <Inspector />
      </aside>
      <StatusBar />
      <ShortcutsDialog />
    </div>
  );
}
