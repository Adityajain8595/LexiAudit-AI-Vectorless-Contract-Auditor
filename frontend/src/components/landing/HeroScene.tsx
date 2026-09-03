import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ── Ultra-Sleek Luxury Studio Ambient Glow & Depth Mesh ───────────────────────
function AmbientStudioMesh() {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    // Very slow, luxurious ambient pulsation
    const t = state.clock.elapsedTime * 0.2;
    meshRef.current.rotation.z = Math.sin(t) * 0.04;
  });

  return (
    <group position={[0, 4, -8]}>
      {/* Top Center Warm Ambient Studio Glow Orb */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[12, 32, 32]} />
        <meshBasicMaterial
          color="#F27A52"
          transparent
          opacity={0.06}
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
      style={{ background: 'transparent', position: 'absolute', inset: 0 }}
      gl={{ alpha: true, antialias: true }}
    >
      <ambientLight intensity={0.5} />
      <AmbientStudioMesh />
    </Canvas>
  );
}
