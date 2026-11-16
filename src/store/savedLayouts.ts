import { canonicalJson } from '../lib/canonical';
import type { Layout } from '../model/types';

/** A layout the user saved by name, kept in this browser. */
export interface SavedLayout {
  layout: Layout;
  /** ISO timestamp of the last save. */
  savedAt: string;
}

/** Save `layout` (replacing any earlier save of the same layout id), most recent first. */
export function upsertSaved(list: readonly SavedLayout[], layout: Layout, savedAt: string): SavedLayout[] {
  return [{ layout: structuredClone(layout), savedAt }, ...list.filter((s) => s.layout.id !== layout.id)];
}

export function removeSaved(list: readonly SavedLayout[], id: string): SavedLayout[] {
  return list.filter((s) => s.layout.id !== id);
}

/** True when `layout` has a saved copy with exactly the same content. */
export function isSaved(list: readonly SavedLayout[], layout: Layout): boolean {
  const entry = list.find((s) => s.layout.id === layout.id);
  return entry !== undefined && canonicalJson(entry.layout) === canonicalJson(layout);
}
