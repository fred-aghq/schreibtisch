/** Display formatting for measurements. */

/** Round to whole millimetres for display (avoids "-0"). */
export function roundMm(mm: number): number {
  const r = Math.round(mm);
  return Object.is(r, -0) ? 0 : r;
}

/** Format a millimetre value for display, e.g. "1 600 mm" style without locale surprises. */
export function formatMm(mm: number, withUnit = true): string {
  const s = String(roundMm(mm));
  return withUnit ? `${s} mm` : s;
}
