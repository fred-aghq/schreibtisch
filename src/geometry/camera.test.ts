import { describe, expect, it } from 'vitest';
import { createDefaultLayout } from '../model/defaults';
import { cameraPose, easeInOut, fitDistance, fitPose, presetDirection, sceneSphere, seatedPose } from './camera';
import { len3, sub3 } from './vec3';

describe('camera maths', () => {
  const layout = createDefaultLayout();

  it('fit distance: sphere exactly fills a 90° view', () => {
    expect(fitDistance(100, 90, 1, 1)).toBeCloseTo(100 / Math.sin(Math.PI / 4));
  });

  it('fit distance grows for narrow (portrait) aspects', () => {
    expect(fitDistance(100, 50, 0.5)).toBeGreaterThan(fitDistance(100, 50, 2));
  });

  it('scene sphere covers the desk and the listener', () => {
    const s = sceneSphere(layout);
    const corners = [
      { x: -800, y: 0, z: -800 },
      { x: 800, y: 0, z: 0 },
      { x: 0, y: 460, z: 600 },
    ];
    for (const c of corners) expect(len3(sub3(c, s.center))).toBeLessThanOrEqual(s.radius + 1e-6);
  });

  it('top view looks down with the back of the desk at the top of the screen', () => {
    const d = presetDirection('top');
    expect(d.y).toBeGreaterThan(0.999);
    expect(d.z).toBeGreaterThan(0);
  });

  it('presets place the camera on the expected side', () => {
    const front = cameraPose('front', layout, 50, 1.6);
    expect(front.position.z).toBeGreaterThan(front.target.z);
    const side = cameraPose('side', layout, 50, 1.6);
    expect(side.position.x).toBeGreaterThan(side.target.x);
    const iso = cameraPose('iso', layout, 50, 1.6);
    expect(iso.position.y).toBeGreaterThan(iso.target.y);
  });

  it('seated view is at the listener\'s eyes looking at the desk, slightly down', () => {
    const pose = seatedPose(layout);
    expect(pose.position).toEqual({ x: 0, y: 460, z: 600 });
    expect(pose.target.z).toBeLessThan(0);
    expect(pose.target.y).toBeLessThan(pose.position.y);
    expect(cameraPose('seated', layout, 50, 1)).toEqual(pose);
  });

  it('fit keeps the viewing direction', () => {
    const current = { position: { x: 0, y: 0, z: 100 }, target: { x: 0, y: 0, z: 0 } };
    const fitted = fitPose(current, layout, 50, 1.5);
    const dir = sub3(fitted.position, fitted.target);
    expect(dir.x).toBeCloseTo(0);
    expect(dir.y).toBeCloseTo(0);
    expect(dir.z).toBeGreaterThan(0);
  });

  it('easing is clamped and symmetric', () => {
    expect(easeInOut(-1)).toBe(0);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
    expect(easeInOut(2)).toBe(1);
  });
});
