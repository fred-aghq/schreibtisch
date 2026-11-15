/** Units helpers. 1 world unit = 1 mm everywhere. */

export const DEG = Math.PI / 180;

export function degToRad(deg: number): number {
  return deg * DEG;
}

export function radToDeg(rad: number): number {
  return rad / DEG;
}

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

/** Normalise an angle in degrees to the range (-180, 180]. */
export function normalizeDeg(deg: number): number {
  let a = deg % 360;
  if (a <= -180) a += 360;
  if (a > 180) a -= 360;
  return Object.is(a, -0) ? 0 : a;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Snap a value to the nearest multiple of `step` (step <= 0 means no snapping). */
export function snapTo(v: number, step: number): number {
  if (!(step > 0)) return v;
  const r = Math.round(v / step) * step;
  return Object.is(r, -0) ? 0 : r;
}

/** Choose a "nice" length (1, 2, 5 × 10^n) close to but not above `max`. */
export function niceLength(max: number): number {
  if (!(max > 0)) return 0;
  const exp = Math.floor(Math.log10(max));
  const base = 10 ** exp;
  for (const m of [5, 2, 1]) {
    if (m * base <= max) return m * base;
  }
  return base;
}
