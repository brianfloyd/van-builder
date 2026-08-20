import { Grid } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { VanShell } from '../types';
import { computeRoofEnvelope } from '../geometry';

const ROOF_COLOR = '#06d6a0';

/** The roof layout plane — its own placement surface, rendered combined on
 * top of the van in the same scene. */
export default function RoofPlaneMesh({ shell }: { shell: VanShell }) {
  const env = computeRoofEnvelope(shell);
  const geo = useMemo(
    () => new THREE.BoxGeometry(env.width, Math.max(env.height, 0.01), env.length),
    [env.width, env.height, env.length]
  );
  const center: [number, number, number] = [(env.minX + env.maxX) / 2, (env.minY + env.maxY) / 2, (env.minZ + env.maxZ) / 2];

  return (
    <group>
      <lineSegments position={center}>
        <edgesGeometry args={[geo]} />
        <lineBasicMaterial color={ROOF_COLOR} transparent opacity={0.5} />
      </lineSegments>
      <Grid
        position={[center[0], env.minY + 0.01, center[2]]}
        args={[env.width, env.length]}
        cellSize={6}
        cellThickness={0.4}
        cellColor="#0a3d33"
        sectionSize={24}
        sectionThickness={0.8}
        sectionColor={ROOF_COLOR}
        fadeDistance={400}
        infiniteGrid={false}
      />
    </group>
  );
}
