export type WheelIntent = { kind: 'zoom'; factor: number } | { kind: 'pan'; dx: number; dy: number };

export interface WheelLike {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  metaKey: boolean;
}

/**
 * Distinguish a mouse wheel (zoom toward cursor) from a trackpad two-finger scroll (pan).
 * Pinch-to-zoom on trackpads arrives as a wheel event with ctrlKey set.
 */
export function classifyWheel(e: WheelLike): WheelIntent {
  const pixels = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
  const dx = e.deltaX * pixels;
  const dy = e.deltaY * pixels;
  if (e.ctrlKey || e.metaKey) {
    return { kind: 'zoom', factor: Math.exp(-dy * 0.01) };
  }
  const looksLikeMouseWheel =
    e.deltaMode !== 0 || (dx === 0 && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 50);
  if (looksLikeMouseWheel) {
    return { kind: 'zoom', factor: Math.exp(-Math.sign(dy) * Math.min(Math.abs(dy), 200) * 0.0015) };
  }
  return { kind: 'pan', dx: -dx, dy: -dy };
}
