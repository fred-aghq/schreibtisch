import { niceLength } from '../../geometry/math';
import styles from './PlanView.module.css';

export function ScaleBar({ scale }: { scale: number }) {
  const mm = niceLength(140 / scale);
  const px = mm * scale;
  const label = mm >= 1000 ? `${mm / 1000} m` : `${mm} mm`;
  return (
    <div className={styles.scaleBar} aria-label={`Scale bar: ${label}`}>
      <div className={styles.scaleBarLine} style={{ width: px }} />
      <span className="num">{label}</span>
    </div>
  );
}
