import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Dual complementary ambient depth meshes
function AmbientStudioMesh() {
  const warmRef = useRef<THREE.Mesh>(null!);
  const coolRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.25;
    if (warmRef.current) {
      warmRef.current.rotation.z = Math.sin(t) * 0.05;
      warmRef.current.position.y = 3 + Math.cos(t * 0.7) * 0.3;
    }
    if (coolRef.current) {
      coolRef.current.rotation.y = Math.cos(t * 0.8) * 0.06;
      coolRef.current.position.x = Math.sin(t * 0.6) * 0.5;
    }
  });

  return (
    <group position={[0, 2, -7]}>
      {/* Warm Copper Ambient Studio Glow */}
      <mesh ref={warmRef} position={[-2, 2, -2]}>
        <sphereGeometry args={[11, 32, 32]} />
        <meshBasicMaterial
          color="#F27A52"
          transparent
          opacity={0.065}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Complementary Electric Teal / Cyan Depth Glow */}
      <mesh ref={coolRef} position={[3, -1, -3]}>
        <sphereGeometry args={[10, 32, 32]} />
        <meshBasicMaterial
          color="#06B6D4"
          transparent
          opacity={0.055}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

export default function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 45 }}
      style={{ background: 'transparent', position: 'absolute', inset: 0, pointerEvents: 'none' }}
      gl={{ alpha: true, antialias: true }}
    >
      <ambientLight intensity={0.6} />
      <AmbientStudioMesh />
    </Canvas>
  );
}
