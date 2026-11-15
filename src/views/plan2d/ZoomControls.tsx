import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import styles from './PlanView.module.css';

export function ZoomControls({ scale, onZoom }: { scale: number; onZoom: (factor: number) => void }) {
  const { sendViewCommand } = useStore.getState();
  return (
    <div className={styles.zoomControls}>
      <button type="button" onClick={() => onZoom(1 / 1.25)} title="Zoom out" aria-label="Zoom out">
        <Icon name="minus" size={14} />
      </button>
      <span className={`${styles.zoomPct} num`}>{Math.round(scale * 100)}%</span>
      <button type="button" onClick={() => onZoom(1.25)} title="Zoom in" aria-label="Zoom in">
        <Icon name="plus" size={14} />
      </button>
      <span className={styles.sep} />
      <button type="button" onClick={() => sendViewCommand({ kind: 'fit' })} title="Zoom to fit (F)">
        <Icon name="fit" size={14} /> Fit
      </button>
      <button type="button" onClick={() => sendViewCommand({ kind: 'zoom', scale: 1 })} title="100 %: 1 mm = 1 CSS pixel">
        1:1
      </button>
    </div>
  );
}
