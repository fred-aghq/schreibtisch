export const MM_PER_INCH = 25.4;

/** An aspect ratio as [width, height], e.g. [16, 9]. */
export type Aspect = readonly [number, number];

/** Active-area width and height (mm) from a diagonal in inches and an aspect ratio. */
export function panelArea(diagonalIn: number, [a, b]: Aspect): { w: number; h: number } {
  const diag = diagonalIn * MM_PER_INCH;
  const k = diag / Math.hypot(a, b);
  return { w: a * k, h: b * k };
}

export interface PanelParams {
  diagonalIn: number;
  aspect: Aspect;
  bezelMm: number;
  /** Panel (housing) thickness, mm. */
  panelDepth: number;
}

/** Box size in mm: w = width, d = depth, h = height. */
export interface BoxSize {
  w: number;
  d: number;
  h: number;
}

/** Outer size of the panel including bezels. */
export function monitorSize(p: PanelParams): BoxSize {
  const { w, h } = panelArea(p.diagonalIn, p.aspect);
  return { w: w + 2 * p.bezelMm, d: p.panelDepth, h: h + 2 * p.bezelMm };
}
