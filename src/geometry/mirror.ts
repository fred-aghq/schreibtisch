import type { ObjectInstance } from '../model/types';
import { mirrorX, mirrorYaw } from './transform';

/** The pose of the partner when `source` is mirrored across the plane x = centreX. */
export function mirroredPose(source: Pick<ObjectInstance, 'position' | 'rotation'>, centreX: number): Pick<ObjectInstance, 'position' | 'rotation'> {
  return {
    position: { x: mirrorX(source.position.x, centreX), y: source.position.y, z: source.position.z },
    rotation: { yaw: mirrorYaw(source.rotation.yaw), pitch: source.rotation.pitch },
  };
}
