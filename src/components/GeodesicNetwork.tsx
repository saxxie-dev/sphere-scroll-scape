
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Point {
  position: THREE.Vector3;
  neighbors: number[];
  color: THREE.Color;
}

const GeodesicNetwork = ({ radius = 1.5 }: { radius?: number }) => {
  const pointsRef = useRef<THREE.Group>(null);
  const linesRef = useRef<THREE.Group>(null);
  
  // Generate random points on sphere surface and create network
  const network = useMemo(() => {
    const numPoints = 12;
    const points: Point[] = [];
    
    // Generate random points on sphere surface
    for (let i = 0; i < numPoints; i++) {
      // Use spherical coordinates to get uniform distribution
      const theta = Math.random() * Math.PI * 2; // 0 to 2π
      const phi = Math.acos(1 - 2 * Math.random()); // 0 to π (uniform distribution)
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      
      points.push({
        position: new THREE.Vector3(x, y, z),
        neighbors: [],
        color: new THREE.Color().setHSL(Math.random(), 0.7, 0.6)
      });
    }
    
    // Find nearest neighbors for each point (connect to 3-4 closest points)
    points.forEach((point, i) => {
      const distances = points
        .map((otherPoint, j) => ({
          index: j,
          distance: point.position.distanceTo(otherPoint.position)
        }))
        .filter(d => d.index !== i)
        .sort((a, b) => a.distance - b.distance);
      
      // Connect to 3 nearest neighbors
      point.neighbors = distances.slice(0, 3).map(d => d.index);
    });
    
    // Create line segments for connections
    const lineGeometry = new THREE.BufferGeometry();
    const linePositions: number[] = [];
    const lineColors: number[] = [];
    
    points.forEach((point, i) => {
      point.neighbors.forEach(neighborIndex => {
        // Avoid duplicate lines by only drawing from lower to higher index
        if (i < neighborIndex) {
          const neighbor = points[neighborIndex];
          
          // Add line segment
          linePositions.push(
            point.position.x, point.position.y, point.position.z,
            neighbor.position.x, neighbor.position.y, neighbor.position.z
          );
          
          // Use average color for the line
          const avgColor = new THREE.Color().addColors(point.color, neighbor.color).multiplyScalar(0.5);
          lineColors.push(
            avgColor.r, avgColor.g, avgColor.b,
            avgColor.r, avgColor.g, avgColor.b
          );
        }
      });
    });
    
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    lineGeometry.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
    
    return { points, lineGeometry };
  }, [radius]);
  
  useFrame((state) => {
    // Gentle rotation sync with the sphere
    if (pointsRef.current && linesRef.current) {
      pointsRef.current.rotation.y += 0.002;
      linesRef.current.rotation.y += 0.002;
    }
  });

  return (
    <>
      {/* Render points */}
      <group ref={pointsRef}>
        {network.points.map((point, index) => (
          <mesh key={index} position={point.position}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshStandardMaterial color={point.color} />
          </mesh>
        ))}
      </group>
      
      {/* Render connecting lines */}
      <group ref={linesRef}>
        <lineSegments>
          <bufferGeometry attach="geometry" {...network.lineGeometry} />
          <lineBasicMaterial attach="material" vertexColors={true} linewidth={2} />
        </lineSegments>
      </group>
    </>
  );
};

export default GeodesicNetwork;
