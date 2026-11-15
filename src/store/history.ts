/**
 * Snapshot-based undo history with transactions. Snapshots are immutable values, so
 * structural sharing keeps memory small. A transaction (e.g. a drag, or a one-click fix
 * touching several objects) produces exactly one undo step.
 */
export interface History<T> {
  present: T;
  past: T[];
  future: T[];
  /** State at the start of an open transaction, or null when none is open. */
  txBase: T | null;
}

export const HISTORY_LIMIT = 200;

export function createHistory<T>(present: T): History<T> {
  return { present, past: [], future: [], txBase: null };
}

/** Apply a change. Outside a transaction it becomes its own undo step. */
export function commit<T>(h: History<T>, next: T): History<T> {
  if (next === h.present) return h;
  if (h.txBase !== null) return { ...h, present: next };
  return { present: next, past: trim([...h.past, h.present]), future: [], txBase: null };
}

export function beginTx<T>(h: History<T>): History<T> {
  if (h.txBase !== null) return h;
  return { ...h, txBase: h.present };
}

export function endTx<T>(h: History<T>): History<T> {
  if (h.txBase === null) return h;
  if (h.txBase === h.present) return { ...h, txBase: null };
  return { present: h.present, past: trim([...h.past, h.txBase]), future: [], txBase: null };
}

export function cancelTx<T>(h: History<T>): History<T> {
  if (h.txBase === null) return h;
  return { ...h, present: h.txBase, txBase: null };
}

export function undo<T>(h: History<T>): History<T> {
  const settled = endTx(h);
  const prev = settled.past[settled.past.length - 1];
  if (prev === undefined) return settled;
  return { present: prev, past: settled.past.slice(0, -1), future: [settled.present, ...settled.future], txBase: null };
}

export function redo<T>(h: History<T>): History<T> {
  const settled = endTx(h);
  const [next, ...rest] = settled.future;
  if (next === undefined) return settled;
  return { present: next, past: trim([...settled.past, settled.present]), future: rest, txBase: null };
}

function trim<T>(past: T[]): T[] {
  return past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past;
}
