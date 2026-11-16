import type { Layout, ObjectDefinition, ObjectInstance } from '../model/types';
import { obbsOverlap } from '../geometry/obb';
import { instanceObb, visibleItems } from './scene';

/** Things like desk mats are meant to have objects on top of them. */
function isSurface(def: ObjectDefinition): boolean {
  return def.category === 'mat';
}

function verticalOverlap(a: ObjectInstance, ad: ObjectDefinition, b: ObjectInstance, bd: ObjectDefinition, eps = 0.5): boolean {
  const a0 = a.position.y;
  const a1 = a0 + ad.size.h;
  const b0 = b.position.y;
  const b1 = b0 + bd.size.h;
  return a1 > b0 + eps && b1 > a0 + eps;
}

/**
 * Ids of visible objects whose plan footprints intersect (oriented boxes) and whose height
 * ranges also overlap, so a speaker on a stand above a PC is not flagged. Mats never collide.
 */
export function findOverlaps(layout: Layout): Set<string> {
  const items = visibleItems(layout).filter((x) => !isSurface(x.def));
  const out = new Set<string>();
  items.forEach((a, i) => {
    for (const b of items.slice(i + 1)) {
      if (!verticalOverlap(a.inst, a.def, b.inst, b.def)) continue;
      if (obbsOverlap(instanceObb(a.inst, a.def), instanceObb(b.inst, b.def))) {
        out.add(a.inst.id);
        out.add(b.inst.id);
      }
    }
  });
  return out;
}
