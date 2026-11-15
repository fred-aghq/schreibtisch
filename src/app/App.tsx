import { useEffect } from 'react';
import { useStore } from '../store/store';
import { Inspector } from '../ui/Inspector';
import { Sidebar } from '../ui/Sidebar';
import { StatusBar } from '../ui/StatusBar';
import { TopBar } from '../ui/TopBar';
import { PlanView } from '../views/plan2d/PlanView';
import styles from './App.module.css';
import { useShortcuts } from './useShortcuts';

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
          <div className={styles.placeholder}>The 3D view arrives in milestone 2.</div>
        )}
      </main>
      <aside className={styles.right}>
        <Inspector />
      </aside>
      <StatusBar />
    </div>
  );
}
