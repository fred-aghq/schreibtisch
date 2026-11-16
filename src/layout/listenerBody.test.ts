import { describe, expect, it } from 'vitest';
import { createDefaultLayout } from '../model/defaults';
import { LISTENER_BODY, listenerFigure } from './listenerBody';
import { floorY, listenerAabb, listenerHead } from './scene';

describe('listener body', () => {
  const layout = createDefaultLayout(); // desk 740 high, ears 1200 from the floor, 600 from the edge

  it('puts the seat 470 mm above the floor, behind the head', () => {
    const f = listenerFigure(listenerHead(layout), floorY(layout));
    expect(f.seat.center).toEqual({ x: 0, y: -740 + 470, z: 600 + 130 });
    expect(f.pedestal.height).toBe(470);
    expect(f.pedestal.center.y).toBe(-740 + 235);
  });

  it('fills the gap between the seat and the head with the torso', () => {
    const f = listenerFigure(listenerHead(layout), floorY(layout));
    const bottom = f.torso.center.y - f.torso.size.h / 2;
    const top = f.torso.center.y + f.torso.size.h / 2;
    expect(bottom).toBe(f.seat.center.y + 40);
    expect(top).toBe(f.head.y - LISTENER_BODY.headRadius - 40);
  });

  it('keeps a minimum torso for very low ear heights', () => {
    const low = { ...layout, listener: { ...layout.listener, earHeightFromFloor: 500 } };
    expect(listenerFigure(listenerHead(low), floorY(low)).torso.size.h).toBe(50);
  });

  it('uses the same chair width in plan bounds', () => {
    const b = listenerAabb(layout);
    expect(b.maxX - b.minX).toBe(LISTENER_BODY.chairWidth);
  });
});
