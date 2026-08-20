import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Group } from 'three';
import { TransformControls } from '@react-three/drei';
import type { ComponentDef, PlacedInstance } from '../types';
import { CATEGORY_COLORS } from '../types';
import { useStore, GRID_SNAP } from '../store';
import { computeEnvelope, clamp, rotatedDims, snap } from '../geometry';

interface Props {
  instance: PlacedInstance;
  def: ComponentDef;
  selected: boolean;
  violating: boolean;
}

export default function PlacedItemMesh({ instance, def, selected, violating }: Props) {
  const groupRef = useRef<Group>(null);
  const selectInstance = useStore((s) => s.selectInstance);
  const updateInstance = useStore((s) => s.updateInstance);
  const shell = useStore((s) => s.shell);

  const color = violating ? '#e05a4e' : def.color ?? CATEGORY_COLORS[def.category];
  const boxGeo = useMemo(
    () => new THREE.BoxGeometry(def.dims.w, def.dims.h, def.dims.d),
    [def.dims.w, def.dims.h, def.dims.d]
  );

  function handleDragEnd() {
    const g = groupRef.current;
    if (!g) return;
    const env = computeEnvelope(shell);
    const dims = rotatedDims(def.dims, instance.rotationY);
    const x = snap(clamp(g.position.x, env.minX + dims.w / 2, env.maxX - dims.w / 2), GRID_SNAP);
    const y = snap(clamp(g.position.y, env.minY, env.maxY - dims.h), GRID_SNAP);
    const z = snap(clamp(g.position.z, env.minZ + dims.d / 2, env.maxZ - dims.d / 2), GRID_SNAP);
    g.position.set(x, y, z);
    updateInstance(instance.id, { pos: { x, y, z } });
  }

  return (
    <>
      <group
        ref={groupRef}
        position={[instance.pos.x, instance.pos.y, instance.pos.z]}
        rotation={[0, (instance.rotationY * Math.PI) / 180, 0]}
        onClick={(e) => {
          e.stopPropagation();
          selectInstance(instance.id);
        }}
      >
        <mesh position={[0, def.dims.h / 2, 0]} geometry={boxGeo}>
          <meshStandardMaterial color={color} transparent opacity={selected ? 0.85 : 0.65} />
        </mesh>
        <lineSegments position={[0, def.dims.h / 2, 0]}>
          <edgesGeometry args={[boxGeo]} />
          <lineBasicMaterial color={selected ? '#ffffff' : '#000000'} transparent opacity={selected ? 1 : 0.35} />
        </lineSegments>
      </group>
      {selected && !instance.locked && (
        <TransformControls
          object={groupRef.current ?? undefined}
          mode="translate"
          translationSnap={GRID_SNAP}
          onMouseUp={handleDragEnd}
        />
      )}
    </>
  );
}
