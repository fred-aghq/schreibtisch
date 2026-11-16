import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { layoutAabb } from '../../layout/scene';
import { fitBounds, pan, zoomAt, zoomTo } from '../../geometry/viewport';
import { classifyWheel } from './wheel';
import type { Viewport } from '../../geometry/viewport';
import { isTypingTarget } from '../../lib/dom';
import { useStore } from '../../store/store';

export interface CanvasSize {
  w: number;
  h: number;
}

/** Used only until the first zoom-to-fit, when the canvas size is known. */
const INITIAL_VIEWPORT: Viewport = { scale: 0.5, offsetX: 0, offsetY: 0 };
/** Screen padding around the layout when zooming to fit. */
const FIT_PADDING_PX = 48;
/** Room kept free on the right for the speaker-triangle card (see TriangleCard.module.css). */
export const TRIANGLE_CARD_INSET_PX = 340;
/** Below this much free width, fitting ignores the card rather than squeezing the plan. */
const MIN_FIT_WIDTH_PX = 320;

function currentViewport(): Viewport {
  return useStore.getState().planViewport ?? INITIAL_VIEWPORT;
}

/** Update the plan viewport in the store from its current value. */
export function updateViewport(fn: (vp: Viewport) => Viewport): void {
  useStore.getState().setPlanViewport(fn(currentViewport()));
}

/**
 * The plan view's pan/zoom. The viewport lives in the store, so it survives switching 2D ↔ 3D.
 * This hook owns the canvas size, the fit / zoom view commands, the wheel and space-to-pan.
 */
export function usePlanViewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<CanvasSize | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const vp = useStore((s) => s.planViewport) ?? INITIAL_VIEWPORT;

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

  // Zoom to fit the first time (no stored viewport yet) and handle fit / zoom commands.
  useEffect(() => {
    if (!size || size.w === 0) return;
    const fit = () => {
      const layout = useStore.getState().history.present;
      const inset = layout.settings.showTriangle && size.w - TRIANGLE_CARD_INSET_PX >= MIN_FIT_WIDTH_PX ? TRIANGLE_CARD_INSET_PX : 0;
      return fitBounds(layoutAabb(layout), size.w - inset, size.h, FIT_PADDING_PX);
    };
    const handle = () => {
      const st = useStore.getState();
      const cmd = st.claimViewCommand('2d');
      if (cmd?.kind === 'fit' || (!cmd && !st.planViewport)) st.setPlanViewport(fit());
      else if (cmd?.kind === 'zoom') st.setPlanViewport(zoomTo(st.planViewport ?? fit(), { x: size.w / 2, y: size.h / 2 }, cmd.scale));
    };
    handle();
    return useStore.subscribe((s, prev) => {
      if (s.viewCommand !== prev.viewCommand || (s.planViewport === null && prev.planViewport !== null)) handle();
    });
  }, [size]);

  // Wheel: zoom toward the cursor (mouse / pinch) or pan (trackpad scroll). Needs a non-passive listener.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const intent = classifyWheel(e);
      if (intent.kind === 'zoom') {
        updateViewport((v) => zoomAt(v, { x: e.clientX - rect.left, y: e.clientY - rect.top }, intent.factor));
      } else {
        updateViewport((v) => pan(v, intent.dx, intent.dy));
      }
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  // Space bar enables click-drag panning.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTypingTarget(e.target) && !useStore.getState().wizard) {
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

  /** Zoom by `factor` about the centre of the canvas. */
  const zoomBy = useCallback(
    (factor: number) => {
      if (size) updateViewport((v) => zoomAt(v, { x: size.w / 2, y: size.h / 2 }, factor));
    },
    [size],
  );

  return { containerRef, svgRef, size, vp, spaceHeld, zoomBy };
}
