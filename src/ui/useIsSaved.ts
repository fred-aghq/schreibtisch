import { useMemo } from 'react';
import { isSaved } from '../store/savedLayouts';
import { useLayout, useStore } from '../store/store';

/** Whether the current layout matches its saved copy (recomputed only when either changes). */
export function useIsSaved(): boolean {
  const layout = useLayout();
  const saved = useStore((s) => s.savedLayouts);
  return useMemo(() => isSaved(saved, layout), [saved, layout]);
}
