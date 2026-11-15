import type { AspectRatio, Size } from '../model/types';

export const ASPECTS: Record<AspectRatio, [number, number]> = {
  '16:9': [16, 9],
  '16:10': [16, 10],
  '21:9': [21, 9],
  '32:9': [32, 9],
};

export const MM_PER_INCH = 25.4;

/** Active-area width and height (mm) from a diagonal in inches and an aspect ratio. */
export function panelArea(diagonalIn: number, aspect: AspectRatio): { w: number; h: number } {
  const [a, b] = ASPECTS[aspect];
  const diag = diagonalIn * MM_PER_INCH;
  const k = diag / Math.hypot(a, b);
  return { w: a * k, h: b * k };
}

export interface MonitorParams {
  diagonalIn: number;
  aspect: AspectRatio;
  bezelMm: number;
  /** Panel (housing) thickness, mm. */
  panelDepth: number;
}

/** Outer size of the panel including bezels. */
export function monitorSize(p: MonitorParams): Size {
  const { w, h } = panelArea(p.diagonalIn, p.aspect);
  return { w: w + 2 * p.bezelMm, d: p.panelDepth, h: h + 2 * p.bezelMm };
}

export function monitorName(p: Pick<MonitorParams, 'diagonalIn' | 'aspect'>): string {
  const d = Number.isInteger(p.diagonalIn) ? String(p.diagonalIn) : p.diagonalIn.toFixed(1);
  return `Monitor ${d}" ${p.aspect}`;
}
