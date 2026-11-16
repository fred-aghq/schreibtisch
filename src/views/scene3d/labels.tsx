import { useFrame, useThree } from '@react-three/fiber';
import type { RefObject } from 'react';
import { Vector3 } from 'three';
import type { Vec3 } from '../../geometry/vec';

export interface SceneLabel {
  id: string;
  text: string;
  position: Vec3;
  /** Optional colour hint, exposed as data-tone for CSS. */
  tone?: 'green' | 'amber' | 'red' | 'accent';
}

/** DOM labels rendered outside the canvas (React), positioned every frame by LabelProjector. */
export function LabelLayer({ labels, layerRef, className }: { labels: SceneLabel[]; layerRef: RefObject<HTMLDivElement | null>; className: string }) {
  return (
    <div ref={layerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {labels.map((l) => (
        <span
          key={l.id}
          className={className}
          data-tone={l.tone}
          data-x={l.position.x}
          data-y={l.position.y}
          data-z={l.position.z}
          style={{ position: 'absolute', left: 0, top: 0, visibility: 'hidden' }}
        >
          {l.text}
        </span>
      ))}
    </div>
  );
}

/** Lives inside the Canvas; projects each label's world point to screen space. */
export function LabelProjector({ layerRef }: { layerRef: RefObject<HTMLDivElement | null> }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const v = new Vector3();
  useFrame(() => {
    const layer = layerRef.current;
    if (!layer) return;
    for (const child of Array.from(layer.children)) {
      if (!(child instanceof HTMLElement)) continue;
      v.set(Number(child.dataset.x), Number(child.dataset.y), Number(child.dataset.z)).project(camera);
      const behind = v.z > 1 || v.z < -1;
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      child.style.visibility = behind ? 'hidden' : 'visible';
      child.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    }
  });
  return null;
}
