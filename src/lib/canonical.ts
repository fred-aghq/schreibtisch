/**
 * JSON with object keys sorted and undefined values dropped, so two values that mean the same
 * thing compare equal even if their keys were built in a different order.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return v;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v).sort()) {
      const x = (v as Record<string, unknown>)[k];
      if (x !== undefined) out[k] = x;
    }
    return out;
  });
}
