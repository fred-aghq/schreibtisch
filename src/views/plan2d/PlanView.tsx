import { useMemo } from 'react';
import { findOverlaps } from '../../layout/overlap';
import { isBelowDesk, visibleItems } from '../../layout/scene';
import type { Layout } from '../../model/types';
import { useLayout, useStore } from '../../store/store';
import { DimensionGuides } from './DimensionGuides';
import { PlanObject } from './PlanObject';
import type { PlanItem } from './PlanObject';
import { ScaleBar } from './ScaleBar';
import { ScreenLabels } from './ScreenLabels';
import { DeskShape, GridLines, ListenerShape } from './shapes';
import { SnapGuides } from './SnapGuides';
import { TriangleOverlay } from './TriangleOverlay';
import { usePlanDrag } from './usePlanDrag';
import { usePlanViewport } from './usePlanViewport';
import { ZoomControls } from './ZoomControls';
import styles from './PlanView.module.css';

/** Visible objects, lowest first so higher objects draw on top. */
function sortedItems(layout: Layout): PlanItem[] {
  const out = visibleItems(layout).map(({ inst, def }) => ({ inst, def, below: isBelowDesk(inst, def) }));
  return out.sort((a, b) => a.inst.position.y + a.def.size.h - (b.inst.position.y + b.def.size.h));
}

/** The 2D top-down plan: an SVG in world units (mm) under a pan/zoom transform. */
export function PlanView() {
  const layout = useLayout();
  const selection = useStore((s) => s.selection);
  const { containerRef, svgRef, size, vp, spaceHeld, zoomBy } = usePlanViewport();
  const drag = usePlanDrag(svgRef, vp, spaceHeld);

  const selectedId = selection?.kind === 'instance' ? selection.id : null;
  const items = useMemo(() => sortedItems(layout), [layout]);
  const overlaps = useMemo(() => findOverlaps(layout), [layout]);
  const below = items.filter((it) => it.below);
  const above = items.filter((it) => !it.below);
  const renderObject = (it: PlanItem) => (
    <PlanObject key={it.inst.id} {...it} selected={it.inst.id === selectedId} overlapping={overlaps.has(it.inst.id)} onPointerDown={drag.onObjectPointerDown} />
  );

  const cursorClass = drag.mode === 'pan' ? styles.panning : spaceHeld ? styles.canPan : drag.mode === 'move' ? styles.dragging : '';

  return (
    <div ref={containerRef} className={styles.container}>
      <svg
        ref={svgRef}
        className={`${styles.svg} ${cursorClass}`}
        width={size?.w ?? 0}
        height={size?.h ?? 0}
        onPointerDown={drag.onBackgroundPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        onPointerCancel={drag.onPointerUp}
        onPointerLeave={() => useStore.getState().setCursor(null)}
        onContextMenu={(e) => e.preventDefault()}
        role="application"
        aria-label="Top-down plan of the desk"
      >
        <g transform={`translate(${vp.offsetX} ${vp.offsetY}) scale(${vp.scale})`}>
          {below.map(renderObject)}
          <DeskShape layout={layout} />
          {layout.settings.showGrid && <GridLines layout={layout} scale={vp.scale} />}
          {layout.backWall && (
            <line
              className={styles.wall}
              x1={-layout.desk.width / 2 - 200}
              x2={layout.desk.width / 2 + 200}
              y1={-layout.desk.depth - layout.backWall.distanceBehindDesk}
              y2={-layout.desk.depth - layout.backWall.distanceBehindDesk}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {above.map(renderObject)}
          <ListenerShape layout={layout} selected={selection?.kind === 'listener'} onPointerDown={drag.onListenerPointerDown} />
        </g>
        <ScreenLabels layout={layout} vp={vp} items={items} selectedId={selectedId} />
        {layout.settings.showTriangle && <TriangleOverlay layout={layout} vp={vp} />}
        <SnapGuides vp={vp} snap={drag.snap} />
        {drag.draggingId && <DimensionGuides layout={layout} vp={vp} id={drag.draggingId} />}
      </svg>
      <ScaleBar scale={vp.scale} />
      <ZoomControls scale={vp.scale} onZoom={zoomBy} />
    </div>
  );
}
