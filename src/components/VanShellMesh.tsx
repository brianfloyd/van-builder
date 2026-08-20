import { Grid } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { VanShell } from '../types';
import { computeEnvelope } from '../geometry';

/** Draws the raw metal shell interior, the wall-framing + insulation layer
 * eaten into it, and a floor grid at the buildable envelope's floor level. */
export default function VanShellMesh({ shell }: { shell: VanShell }) {
  const env = computeEnvelope(shell);

  const shellGeo = useMemo(
    () => new THREE.BoxGeometry(shell.interiorWidth, shell.interiorHeight, shell.interiorLength),
    [shell.interiorWidth, shell.interiorHeight, shell.interiorLength]
  );
  const envGeo = useMemo(
    () => new THREE.BoxGeometry(env.width, env.height, env.length),
    [env.width, env.height, env.length]
  );

  const shellCenter: [number, number, number] = [
    shell.interiorWidth / 2,
    shell.interiorHeight / 2,
    shell.interiorLength / 2,
  ];
  const envCenter: [number, number, number] = [
    (env.minX + env.maxX) / 2,
    (env.minY + env.maxY) / 2,
    (env.minZ + env.maxZ) / 2,
  ];

  return (
    <group>
      {/* Raw shell interior surface (what the sheet metal encloses) */}
      <lineSegments position={shellCenter}>
        <edgesGeometry args={[shellGeo]} />
        <lineBasicMaterial color="#5a6270" />
      </lineSegments>

      {/* Buildable envelope after insulation + wall framing / scaffold */}
      <lineSegments position={envCenter}>
        <edgesGeometry args={[envGeo]} />
        <lineBasicMaterial color="#4a919e" />
      </lineSegments>

      <Grid
        position={[(env.minX + env.maxX) / 2, env.minY + 0.01, (env.minZ + env.maxZ) / 2]}
        args={[env.width, env.length]}
        cellSize={6}
        cellThickness={0.5}
        cellColor="#2c313a"
        sectionSize={24}
        sectionThickness={1}
        sectionColor="#3a4048"
        fadeDistance={400}
        infiniteGrid={false}
      />
    </group>
  );
}
