
import { useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import GeodesicNetwork from './GeodesicNetwork';

const AnimatedSphere = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      // Gentle idle rotation when not being manipulated
      meshRef.current.rotation.y += 0.002;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <sphereGeometry args={[1.5, 64, 64]} />
      <meshStandardMaterial 
        color="#4f46e5"
        roughness={0.3}
        metalness={0.7}
        wireframe={false}
        transparent={true}
        opacity={0.7}
      />
    </mesh>
  );
};

const Scene = () => {
  return (
    <>
      {/* Ambient lighting */}
      <ambientLight intensity={0.4} />
      
      {/* Main directional light */}
      <directionalLight 
        position={[5, 5, 5]} 
        intensity={1}
        castShadow
      />
      
      {/* Additional point light for better illumination */}
      <pointLight 
        position={[-5, -5, 5]} 
        intensity={0.5}
        color="#ffffff"
      />
      
      {/* The animated sphere (now semi-transparent) */}
      <AnimatedSphere />
      
      {/* The geodesic network */}
      <GeodesicNetwork radius={1.5} />
      
      {/* Orbit controls with bounded zoom */}
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        enableRotate={true}
        minDistance={2}
        maxDistance={8}
        autoRotate={false}
        rotateSpeed={0.8}
        zoomSpeed={0.6}
        dampingFactor={0.05}
        enableDamping={true}
      />
    </>
  );
};

const InteractiveSphere = () => {
  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="absolute top-6 left-6 z-10 text-white">
        <h1 className="text-3xl font-bold mb-2">Interactive Sphere</h1>
        <p className="text-sm opacity-80">Click and drag to rotate • Scroll to zoom</p>
      </div>
      
      <Canvas
        camera={{ 
          position: [0, 0, 5], 
          fov: 75,
          near: 0.1,
          far: 1000
        }}
        shadows
        className="w-full h-full"
      >
        <Scene />
      </Canvas>
    </div>
  );
};

export default InteractiveSphere;
