import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MeshDistortMaterial, Sphere, Float } from "@react-three/drei";

function Orb({ active }) {
  const meshRef = useRef(null);
  const materialRef = useRef(null);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.15;
      meshRef.current.rotation.x += delta * 0.05;
    }
    if (materialRef.current) {
      const target = active ? 0.55 : 0.35;
      materialRef.current.distort += (target - materialRef.current.distort) * delta * 2;
      const speedTarget = active ? 2.2 : 1;
      materialRef.current.speed += (speedTarget - materialRef.current.speed) * delta * 2;
    }
  });

  return (
    <Float speed={1.4} rotationIntensity={0.5} floatIntensity={0.8}>
      <Sphere ref={meshRef} args={[1, 96, 96]}>
        <MeshDistortMaterial
          ref={materialRef}
          color="#3B82F6"
          attach="material"
          distort={0.35}
          speed={1}
          roughness={0.15}
          metalness={0.1}
          emissive="#1D4ED8"
          emissiveIntensity={0.2}
        />
      </Sphere>
    </Float>
  );
}

export default function PresenceOrb({ active = false, className = "" }) {
  return (
    <div className={className} aria-hidden="true">
      <Canvas camera={{ position: [0, 0, 3.2], fov: 40 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 2, 3]} intensity={1.1} color="#ffffff" />
        <directionalLight position={[-2, -1, -2]} intensity={0.35} color="#93c5fd" />
        <Suspense fallback={null}>
          <Orb active={active} />
        </Suspense>
      </Canvas>
    </div>
  );
}
