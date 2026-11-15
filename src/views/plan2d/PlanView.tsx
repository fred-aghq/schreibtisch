import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { dimensionGuides } from '../../layout/guides';
import { obbAabb } from '../../geometry/obb';
import { findOverlaps } from '../../layout/overlap';
import { instanceObb, isBelowDesk, visibleItems } from '../../layout/scene';
import { snapInstance, snapListener } from '../../layout/snap';
import type { SnapLine } from '../../layout/snap';
import { niceLength } from '../../geometry/math';
import { formatMm } from '../../lib/format';
import type { Vec2 } from '../../geometry/vec';
import { pan, screenToWorld, worldToScreen } from '../../geometry/viewport';
import type { Viewport } from '../../geometry/viewport';
import type { Layout, ObjectDefinition, ObjectInstance } from '../../model/types';
import { moveInstance, setListener } from '../../model/ops';
import { useLayout, useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { DeskShape, GridLines, ListenerShape } from './shapes';
import styles from './PlanView.module.css';
import { updateViewport, usePlanViewport } from './usePlanViewport';

type Drag =
  | { kind: 'pan'; pointerId: number; lastX: number; lastY: number }
  | { kind: 'object'; pointerId: number; id: string; startWorld: Vec2; startPos: Vec2; moved: boolean }
  | { kind: 'listener'; pointerId: number; startWorld: Vec2; startPos: Vec2; moved: boolean };

const DRAG_THRESHOLD_PX = 3;
/** Snap distance in screen pixels (converted to mm at the current zoom). */
const SNAP_PX = 6;

interface ActiveSnap {
  lineX: SnapLine | null;
  lineZ: SnapLine | null;
}

export function PlanView() {
  const layout = useLayout();
  const selection = useStore((s) => s.selection);
  const { containerRef, svgRef, size, vp, spaceHeld, zoomBy } = usePlanViewport();
  const [drag, setDrag] = useState<Drag | null>(null);
  const [snap, setSnap] = useState<ActiveSnap>({ lineX: null, lineZ: null });

  const toWorld = useCallback(
    (e: { clientX: number; clientY: number }): Vec2 => {
      const rect = svgRef.current?.getBoundingClientRect();
      return screenToWorld(vp, { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) });
    },
    [vp, svgRef],
  );

  const startPan = (e: ReactPointerEvent) => {
    svgRef.current?.setPointerCapture(e.pointerId);
    setDrag({ kind: 'pan', pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY });
  };

  const onBackgroundPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button === 1 || e.button === 0) {
      if (e.button === 0 && !spaceHeld) useStore.getState().select(null);
      startPan(e);
    }
  };

  const onObjectPointerDown = (e: ReactPointerEvent, inst: ObjectInstance) => {
    if (e.button === 1 || spaceHeld) return; // let it bubble to the background → pan
    e.stopPropagation();
    if (e.button !== 0) return;
    const store = useStore.getState();
    store.select({ kind: 'instance', id: inst.id });
    if (inst.locked) return;
    svgRef.current?.setPointerCapture(e.pointerId);
    setDrag({
      kind: 'object',
      pointerId: e.pointerId,
      id: inst.id,
      startWorld: toWorld(e),
      startPos: { x: inst.position.x, z: inst.position.z },
      moved: false,
    });
  };

  const onListenerPointerDown = (e: ReactPointerEvent) => {
    if (e.button === 1 || spaceHeld) return;
    e.stopPropagation();
    if (e.button !== 0) return;
    useStore.getState().select({ kind: 'listener' });
    svgRef.current?.setPointerCapture(e.pointerId);
    setDrag({
      kind: 'listener',
      pointerId: e.pointerId,
      startWorld: toWorld(e),
      startPos: { x: layout.listener.x, z: layout.listener.distanceFromFrontEdge },
      moved: false,
    });
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const world = toWorld(e);
    const store = useStore.getState();
    store.setCursor(world);
    if (!drag || drag.pointerId !== e.pointerId) return;

    if (drag.kind === 'pan') {
      updateViewport((v) => pan(v, e.clientX - drag.lastX, e.clientY - drag.lastY));
      setDrag({ ...drag, lastX: e.clientX, lastY: e.clientY });
      return;
    }

    const dx = world.x - drag.startWorld.x;
    const dz = world.z - drag.startWorld.z;
    if (!drag.moved) {
      if (Math.hypot(dx, dz) * vp.scale < DRAG_THRESHOLD_PX) return;
      store.beginTx();
      setDrag({ ...drag, moved: true });
    }
    const layoutNow = store.history.present;
    const raw = { x: drag.startPos.x + dx, z: drag.startPos.z + dz };
    const threshold = SNAP_PX / vp.scale;
    if (drag.kind === 'object') {
      const r = snapInstance(layoutNow, drag.id, raw, threshold, e.altKey);
      setSnap({ lineX: r.lineX, lineZ: r.lineZ });
      store.apply((l) => moveInstance(l, drag.id, { position: { x: r.pos.x, z: r.pos.z } }));
    } else {
      const r = snapListener(layoutNow, raw, threshold, e.altKey);
      setSnap({ lineX: r.lineX, lineZ: r.lineZ });
      store.apply((l) => setListener(l, { x: r.pos.x, distanceFromFrontEdge: r.pos.z }));
    }
  };

  const endDrag = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (svgRef.current?.hasPointerCapture(e.pointerId)) svgRef.current.releasePointerCapture(e.pointerId);
    if (drag.kind !== 'pan' && drag.moved) useStore.getState().endTx();
    setDrag(null);
    setSnap({ lineX: null, lineZ: null });
  };

  // Escape cancels an in-progress drag.
  useEffect(() => {
    if (!drag || drag.kind === 'pan') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drag.moved) {
        e.stopPropagation();
        useStore.getState().cancelTx();
        setDrag(null);
        setSnap({ lineX: null, lineZ: null });
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [drag]);

  const selectedId = selection?.kind === 'instance' ? selection.id : null;
  const items = useMemo(() => sortedItems(layout), [layout]);
  const overlaps = useMemo(() => findOverlaps(layout), [layout]);
  const draggingId = drag?.kind === 'object' && drag.moved ? drag.id : null;
  const below = items.filter((it) => it.below);
  const above = items.filter((it) => !it.below);

  const cursorClass =
    drag?.kind === 'pan' ? styles.panning : spaceHeld ? styles.canPan : drag ? styles.dragging : '';

  return (
    <div ref={containerRef} className={styles.container}>
      <svg
        ref={svgRef}
        className={`${styles.svg} ${cursorClass}`}
        width={size?.w ?? 0}
        height={size?.h ?? 0}
        onPointerDown={onBackgroundPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => useStore.getState().setCursor(null)}
        onContextMenu={(e) => e.preventDefault()}
        role="application"
        aria-label="Top-down plan of the desk"
      >
        <g transform={`translate(${vp.offsetX} ${vp.offsetY}) scale(${vp.scale})`}>
          {below.map((it) => (
            <PlanObject key={it.inst.id} {...it} selected={it.inst.id === selectedId} overlapping={overlaps.has(it.inst.id)} onPointerDown={onObjectPointerDown} />
          ))}
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
          {above.map((it) => (
            <PlanObject key={it.inst.id} {...it} selected={it.inst.id === selectedId} overlapping={overlaps.has(it.inst.id)} onPointerDown={onObjectPointerDown} />
          ))}
          <ListenerShape layout={layout} selected={selection?.kind === 'listener'} onPointerDown={onListenerPointerDown} />
        </g>
        <ScreenLabels layout={layout} vp={vp} items={items} selectedId={selectedId} />
        <SnapGuides vp={vp} snap={snap} />
        {draggingId && <DimensionGuides layout={layout} vp={vp} id={draggingId} />}
      </svg>
      <ScaleBar scale={vp.scale} />
      <ZoomControls scale={vp.scale} onZoom={zoomBy} />
    </div>
  );
}

interface Item {
  inst: ObjectInstance;
  def: ObjectDefinition;
  below: boolean;
}

function sortedItems(layout: Layout): Item[] {
  const out = visibleItems(layout).map(({ inst, def }) => ({ inst, def, below: isBelowDesk(inst, def) }));
  // Higher objects draw on top.
  return out.sort((a, b) => a.inst.position.y + a.def.size.h - (b.inst.position.y + b.def.size.h));
}

function PlanObject({
  inst,
  def,
  below,
  selected,
  overlapping,
  onPointerDown,
}: Item & { selected: boolean; overlapping: boolean; onPointerDown: (e: ReactPointerEvent, inst: ObjectInstance) => void }) {
  const { w, d } = def.size;
  const stand = def.monitor?.support === 'stand' ? def.monitor.stand : undefined;
  const className = [styles.object, below ? styles.below : '', overlapping ? styles.overlap : '', selected ? styles.selected : '', inst.locked ? styles.locked : '']
    .filter(Boolean)
    .join(' ');
  return (
    <g
      className={className}
      transform={`translate(${inst.position.x} ${inst.position.z}) rotate(${-inst.rotation.yaw})`}
      onPointerDown={(e) => onPointerDown(e, inst)}
    >
      {stand && <rect className={styles.stand} x={-stand.w / 2} y={-stand.d / 2} width={stand.w} height={stand.d} rx={12} vectorEffect="non-scaling-stroke" />}
      {def.shape === 'cylinder' ? (
        <ellipse rx={w / 2} ry={d / 2} fill={def.colour} vectorEffect="non-scaling-stroke" />
      ) : (
        <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={Math.min(w, d) * 0.04} fill={def.colour} vectorEffect="non-scaling-stroke" />
      )}
      {/* Front edge marker (local +Z faces the user at yaw 0). */}
      <line className={styles.front} x1={-w / 2 + Math.min(w * 0.1, 20)} x2={w / 2 - Math.min(w * 0.1, 20)} y1={d / 2} y2={d / 2} vectorEffect="non-scaling-stroke" />
    </g>
  );
}

function ScreenLabels({ layout, vp, items, selectedId }: { layout: Layout; vp: Viewport; items: Item[]; selectedId: string | null }) {
  const { width, depth } = layout.desk;
  const topMid = worldToScreen(vp, { x: 0, z: -depth });
  const leftMid = worldToScreen(vp, { x: -width / 2, z: -depth / 2 });
  return (
    <g className={styles.labels} pointerEvents="none">
      <text x={topMid.x} y={topMid.y - 10} textAnchor="middle" className={`${styles.dim} num`}>
        {formatMm(width)}
      </text>
      <text
        x={leftMid.x - 10}
        y={leftMid.y}
        textAnchor="middle"
        transform={`rotate(-90 ${leftMid.x - 10} ${leftMid.y})`}
        className={`${styles.dim} num`}
      >
        {formatMm(depth)}
      </text>
      {items.map(({ inst, def }) => {
        const box = obbAabb(instanceObb(inst, def));
        const pxW = (box.maxX - box.minX) * vp.scale;
        const pxH = (box.maxZ - box.minZ) * vp.scale;
        const isSel = inst.id === selectedId;
        if (!isSel && (pxW < 46 || pxH < 16)) return null;
        const c = worldToScreen(vp, { x: inst.position.x, z: inst.position.z });
        return (
          <text key={inst.id} x={c.x} y={c.y + 4} textAnchor="middle" className={`${styles.objLabel} ${isSel ? styles.objLabelSel : ''}`}>
            {inst.label}
          </text>
        );
      })}
    </g>
  );
}

function SnapGuides({ vp, snap }: { vp: Viewport; snap: ActiveSnap }) {
  const lines: { key: string; a: { x: number; y: number }; b: { x: number; y: number } }[] = [];
  const pad = 60;
  if (snap.lineX) {
    const [z0, z1] = snap.lineX.span;
    lines.push({ key: 'x', a: worldToScreen(vp, { x: snap.lineX.value, z: z0 - pad }), b: worldToScreen(vp, { x: snap.lineX.value, z: z1 + pad }) });
  }
  if (snap.lineZ) {
    const [x0, x1] = snap.lineZ.span;
    lines.push({ key: 'z', a: worldToScreen(vp, { x: x0 - pad, z: snap.lineZ.value }), b: worldToScreen(vp, { x: x1 + pad, z: snap.lineZ.value }) });
  }
  return (
    <g pointerEvents="none">
      {lines.map((l) => (
        <line key={l.key} className={styles.snapLine} x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} />
      ))}
    </g>
  );
}

function DimensionGuides({ layout, vp, id }: { layout: Layout; vp: Viewport; id: string }) {
  const inst = layout.instances.find((i) => i.id === id);
  const def = inst ? layout.definitions[inst.definitionId] : undefined;
  if (!inst || !def) return null;
  const guides = dimensionGuides(obbAabb(instanceObb(inst, def)), layout.desk.width, layout.desk.depth);
  return (
    <g pointerEvents="none" className={styles.dims}>
      {guides.map((g) => {
        const a = worldToScreen(vp, g.a);
        const b = worldToScreen(vp, g.b);
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len < 4) return null;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const horizontal = Math.abs(b.x - a.x) > Math.abs(b.y - a.y);
        const tick = 5;
        const text = `${Math.round(Math.abs(g.value))}`;
        const tw = text.length * 6.6 + 10;
        return (
          <g key={g.id} className={g.id === 'centre' ? styles.dimCentre : g.value < 0 ? styles.dimNegative : ''}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            {horizontal ? (
              <>
                <line x1={a.x} y1={a.y - tick} x2={a.x} y2={a.y + tick} />
                <line x1={b.x} y1={b.y - tick} x2={b.x} y2={b.y + tick} />
              </>
            ) : (
              <>
                <line x1={a.x - tick} y1={a.y} x2={a.x + tick} y2={a.y} />
                <line x1={b.x - tick} y1={b.y} x2={b.x + tick} y2={b.y} />
              </>
            )}
            {len > 24 && (
              <>
                <rect x={mx - tw / 2} y={my - 9} width={tw} height={18} rx={9} />
                <text x={mx} y={my + 4} textAnchor="middle" className="num">
                  {g.value < 0 && g.id !== 'centre' ? '−' : ''}
                  {text}
                </text>
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}

function ScaleBar({ scale }: { scale: number }) {
  const mm = niceLength(140 / scale);
  const px = mm * scale;
  const label = mm >= 1000 ? `${mm / 1000} m` : `${mm} mm`;
  return (
    <div className={styles.scaleBar} aria-label={`Scale bar: ${label}`}>
      <div className={styles.scaleBarLine} style={{ width: px }} />
      <span className="num">{label}</span>
    </div>
  );
}

function ZoomControls({ scale, onZoom }: { scale: number; onZoom: (factor: number) => void }) {
  const { sendViewCommand } = useStore.getState();
  return (
    <div className={styles.zoomControls}>
      <button type="button" onClick={() => onZoom(1 / 1.25)} title="Zoom out" aria-label="Zoom out">
        <Icon name="minus" size={14} />
      </button>
      <span className={`${styles.zoomPct} num`}>{Math.round(scale * 100)}%</span>
      <button type="button" onClick={() => onZoom(1.25)} title="Zoom in" aria-label="Zoom in">
        <Icon name="plus" size={14} />
      </button>
      <span className={styles.sep} />
      <button type="button" onClick={() => sendViewCommand({ kind: 'fit' })} title="Zoom to fit (F)">
        <Icon name="fit" size={14} /> Fit
      </button>
      <button type="button" onClick={() => sendViewCommand({ kind: 'zoom', scale: 1 })} title="100 %: 1 mm = 1 CSS pixel">
        1:1
      </button>
    </div>
  );
}
