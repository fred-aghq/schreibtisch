export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  /** Run any pending call immediately. */
  flush: () => void;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let t: ReturnType<typeof setTimeout> | undefined;
  let pending: A | null = null;
  const run = () => {
    if (t !== undefined) clearTimeout(t);
    t = undefined;
    if (pending) {
      const args = pending;
      pending = null;
      fn(...args);
    }
  };
  const d = (...args: A) => {
    pending = args;
    if (t !== undefined) clearTimeout(t);
    t = setTimeout(run, ms);
  };
  d.flush = run;
  return d;
}
