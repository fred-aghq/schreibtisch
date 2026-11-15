let fallbackCounter = 0;

export function newId(prefix = ''): string {
  const c = globalThis.crypto;
  const id =
    c && typeof c.randomUUID === 'function'
      ? c.randomUUID()
      : `${Date.now().toString(36)}-${(fallbackCounter++).toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}_${id}` : id;
}
