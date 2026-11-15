import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { obbAabb } from '../../geometry/obb';
import { instanceObb, isBelowDesk, layoutAabb } from '../../geometry/scene';
import { formatMm, niceLength, snapTo } from '../../geometry/units';
import type { Vec2 } from '../../geometry/vec';
import { classifyWheel, fitBounds, pan, screenToWorld, worldToScreen, zoomAt, zoomTo } from '../../geometry/viewport';
import type { Viewport } from '../../geometry/viewport';
import type { Layout, ObjectDefinition, ObjectInstance } from '../../model/types';
import { setListener, updateInstance } from '../../store/ops';
import { useLayout, useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { DeskShape, GridLines, ListenerShape } from './shapes';
import styles from './PlanView.module.css';

type Drag =
  | { kind: 'pan'; pointerId: number; lastX: number; lastY: number }
  | { kind: 'object'; pointerId: number; id: string; startWorld: Vec2; startPos: Vec2; moved: boolean }
  | { kind: 'listener'; pointerId: number; startWorld: Vec2; startPos: Vec2; moved: boolean };

const DRAG_THRESHOLD_PX = 3;

export function PlanView() {
  const layout = useLayout();
  const selection = useStore((s) => s.selection);
  const fitRequest = useStore((s) => s.fitRequest);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [vp, setVp] = useState<Viewport>({ scale: 0.5, offsetX: 0, offsetY: 0 });
  const [drag, setDrag] = useState<Drag | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const fittedFor = useRef<number | null>(null);
  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  // Track the canvas size.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Zoom to fit on first layout and whenever requested (F key / button).
  useEffect(() => {
    if (!size || size.w === 0 || fittedFor.current === fitRequest) return;
    fittedFor.current = fitRequest;
    setVp(fitBounds(layoutAabb(layoutRef.current), size.w, size.h, 48));
  }, [fitRequest, size]);

  // Absolute zoom requests (e.g. 100 %), centred on the canvas.
  const sizeRef = useRef(size);
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);
  useEffect(
    () =>
      useStore.subscribe((state) => {
        const target = state.zoomRequest;
        const sz = sizeRef.current;
        if (target === null || !sz) return;
        state.requestZoom(null);
        setVp((v) => zoomTo(v, { x: sz.w / 2, y: sz.h / 2 }, target));
      }),
    [],
  );

  useEffect(() => {
    useStore.getState().setZoom(vp.scale);
  }, [vp.scale]);

  // Wheel: zoom toward the cursor (mouse / pinch) or pan (trackpad scroll). Needs a non-passive listener.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const intent = classifyWheel(e);
      if (intent.kind === 'zoom') {
        setVp((v) => zoomAt(v, { x: e.clientX - rect.left, y: e.clientY - rect.top }, intent.factor));
      } else {
        setVp((v) => pan(v, intent.dx, intent.dy));
      }
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  // Space bar enables click-drag panning.
  useEffect(() => {
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping(e.target)) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    const blur = () => setSpaceHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  const toWorld = useCallback(
    (e: { clientX: number; clientY: number }): Vec2 => {
      const rect = svgRef.current?.getBoundingClientRect();
      return screenToWorld(vp, { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) });
    },
    [vp],
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
      setVp((v) => pan(v, e.clientX - drag.lastX, e.clientY - drag.lastY));
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
    const { snapEnabled, snapStep } = store.history.present.settings;
    const step = snapEnabled && !e.altKey ? snapStep : 0;
    const x = snapTo(drag.startPos.x + dx, step);
    const z = snapTo(drag.startPos.z + dz, step);
    if (drag.kind === 'object') {
      store.apply((l) => updateInstance(l, drag.id, { position: { x, z } }));
    } else {
      store.apply((l) => setListener(l, { x, distanceFromFrontEdge: z }));
    }
  };

  const endDrag = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (svgRef.current?.hasPointerCapture(e.pointerId)) svgRef.current.releasePointerCapture(e.pointerId);
    if (drag.kind !== 'pan' && drag.moved) useStore.getState().endTx();
    setDrag(null);
  };

  // Escape cancels an in-progress drag.
  useEffect(() => {
    if (!drag || drag.kind === 'pan') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drag.moved) {
        e.stopPropagation();
        useStore.getState().cancelTx();
        setDrag(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [drag]);

  const selectedId = selection?.kind === 'instance' ? selection.id : null;
  const items = useMemo(() => sortedItems(layout), [layout]);
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
            <PlanObject key={it.inst.id} {...it} selected={it.inst.id === selectedId} onPointerDown={onObjectPointerDown} />
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
            <PlanObject key={it.inst.id} {...it} selected={it.inst.id === selectedId} onPointerDown={onObjectPointerDown} />
          ))}
          <ListenerShape layout={layout} selected={selection?.kind === 'listener'} onPointerDown={onListenerPointerDown} />
        </g>
        <ScreenLabels layout={layout} vp={vp} items={items} selectedId={selectedId} />
      </svg>
      <ScaleBar scale={vp.scale} />
      <ZoomControls
        scale={vp.scale}
        onZoom={(f) => size && setVp((v) => zoomAt(v, { x: size.w / 2, y: size.h / 2 }, f))}
      />
    </div>
  );
}

interface Item {
  inst: ObjectInstance;
  def: ObjectDefinition;
  below: boolean;
}

function sortedItems(layout: Layout): Item[] {
  const out: Item[] = [];
  for (const inst of layout.instances) {
    const def = layout.definitions[inst.definitionId];
    if (!def || !inst.visible) continue;
    out.push({ inst, def, below: isBelowDesk(inst, def) });
  }
  // Higher objects draw on top.
  return out.sort((a, b) => a.inst.position.y + a.def.size.h - (b.inst.position.y + b.def.size.h));
}

function PlanObject({
  inst,
  def,
  below,
  selected,
  onPointerDown,
}: Item & { selected: boolean; onPointerDown: (e: ReactPointerEvent, inst: ObjectInstance) => void }) {
  const { w, d } = def.size;
  const className = [styles.object, below ? styles.below : '', selected ? styles.selected : '', inst.locked ? styles.locked : '']
    .filter(Boolean)
    .join(' ');
  return (
    <g
      className={className}
      transform={`translate(${inst.position.x} ${inst.position.z}) rotate(${-inst.rotation.yaw})`}
      onPointerDown={(e) => onPointerDown(e, inst)}
    >
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
  const { requestFit, requestZoom } = useStore.getState();
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
      <button type="button" onClick={requestFit} title="Zoom to fit (F)">
        <Icon name="fit" size={14} /> Fit
      </button>
      <button type="button" onClick={() => requestZoom(1)} title="100 %: 1 mm = 1 CSS pixel">
        1:1
      </button>
    </div>
  );
}
