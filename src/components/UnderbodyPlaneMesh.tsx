import { useMemo } from 'react';
import * as THREE from 'three';
import type { VanShell } from '../types';
import { computeUnderbodyEnvelope } from '../geometry';

const UNDERBODY_COLOR = '#9c6b4f';

/** The undercarriage layout plane, below the floor. Deliberately simple —
 * just a wireframe volume, no grid/decoration — since precise chassis/engine
 * geometry isn't modeled; it's a rough "here's roughly the usable space"
 * reference for tanks and other chassis-mounted gear. */
export default function UnderbodyPlaneMesh({ shell }: { shell: VanShell }) {
  const env = computeUnderbodyEnvelope(shell);
  const geo = useMemo(
    () => new THREE.BoxGeometry(env.width, Math.max(env.height, 0.01), env.length),
    [env.width, env.height, env.length]
  );
  const center: [number, number, number] = [(env.minX + env.maxX) / 2, (env.minY + env.maxY) / 2, (env.minZ + env.maxZ) / 2];

  return (
    <lineSegments position={center}>
      <edgesGeometry args={[geo]} />
      <lineBasicMaterial color={UNDERBODY_COLOR} transparent opacity={0.5} />
    </lineSegments>
  );
}
