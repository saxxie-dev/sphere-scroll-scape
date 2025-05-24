
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
  const facesRef = useRef<THREE.Group>(null);
  
  // Generate geodesic curve points between two points on sphere surface
  const generateGeodesicCurve = (point1: THREE.Vector3, point2: THREE.Vector3, segments = 20) => {
    const points: THREE.Vector3[] = [];
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      
      // Spherical linear interpolation (slerp) for great circle
      const angle = point1.angleTo(point2);
      const sinAngle = Math.sin(angle);
      
      if (sinAngle === 0) {
        // Points are identical or antipodal
        points.push(point1.clone());
        continue;
      }
      
      const a = Math.sin((1 - t) * angle) / sinAngle;
      const b = Math.sin(t * angle) / sinAngle;
      
      const interpolated = point1.clone().multiplyScalar(a).add(point2.clone().multiplyScalar(b));
      
      // Project back to sphere surface
      interpolated.normalize().multiplyScalar(radius);
      points.push(interpolated);
    }
    
    return points;
  };

  // Generate evenly distributed points using Fibonacci sphere algorithm
  const generateFibonacciSphere = (numPoints: number) => {
    const points: Point[] = [];
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    
    for (let i = 0; i < numPoints; i++) {
      // Use Fibonacci spiral for even distribution
      const theta = 2 * Math.PI * i / goldenRatio;
      const phi = Math.acos(1 - 2 * (i + 0.5) / numPoints);
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      
      points.push({
        position: new THREE.Vector3(x, y, z),
        neighbors: [],
        color: new THREE.Color().setHSL(i / numPoints, 0.7, 0.6)
      });
    }
    
    return points;
  };

  // Generate evenly distributed points and create network
  const network = useMemo(() => {
    const numPoints = 12;
    const points = generateFibonacciSphere(numPoints);
    
    // Create Voronoi-like connections with varied polygon shapes
    points.forEach((point, i) => {
      const distances = points
        .map((otherPoint, j) => ({
          index: j,
          distance: point.position.distanceTo(otherPoint.position)
        }))
        .filter(d => d.index !== i)
        .sort((a, b) => a.distance - b.distance);
      
      // Vary the number of connections (3-5) to create different polygon shapes
      const numConnections = 3 + Math.floor(Math.random() * 3); // 3, 4, or 5 connections
      point.neighbors = distances.slice(0, numConnections).map(d => d.index);
    });
    
    // Create geodesic curve segments for connections
    const lineGeometry = new THREE.BufferGeometry();
    const linePositions: number[] = [];
    const lineColors: number[] = [];
    
    // Create polygon faces
    const faceGeometries: { geometry: THREE.BufferGeometry; color: THREE.Color }[] = [];
    
    points.forEach((point, i) => {
      // Create polygon face for each point's neighborhood
      if (point.neighbors.length >= 3) {
        const faceVertices: number[] = [];
        const faceColors: number[] = [];
        
        // Sort neighbors by angle around the point to create proper polygon
        const neighborPositions = point.neighbors.map(ni => ({
          index: ni,
          position: points[ni].position.clone().sub(point.position).normalize()
        }));
        
        // Create triangulated face from center point to neighbors
        for (let j = 0; j < point.neighbors.length; j++) {
          const nextJ = (j + 1) % point.neighbors.length;
          const neighbor1 = points[point.neighbors[j]];
          const neighbor2 = points[point.neighbors[nextJ]];
          
          // Triangle: center -> neighbor1 -> neighbor2
          faceVertices.push(
            point.position.x, point.position.y, point.position.z,
            neighbor1.position.x, neighbor1.position.y, neighbor1.position.z,
            neighbor2.position.x, neighbor2.position.y, neighbor2.position.z
          );
          
          // Use point's color for the entire face
          for (let k = 0; k < 3; k++) {
            faceColors.push(point.color.r, point.color.g, point.color.b);
          }
        }
        
        const faceGeometry = new THREE.BufferGeometry();
        faceGeometry.setAttribute('position', new THREE.Float32BufferAttribute(faceVertices, 3));
        faceGeometry.setAttribute('color', new THREE.Float32BufferAttribute(faceColors, 3));
        faceGeometry.computeVertexNormals();
        
        faceGeometries.push({ geometry: faceGeometry, color: point.color });
      }
      
      // Create lines
      point.neighbors.forEach(neighborIndex => {
        // Avoid duplicate lines by only drawing from lower to higher index
        if (i < neighborIndex) {
          const neighbor = points[neighborIndex];
          
          // Generate geodesic curve between points
          const curvePoints = generateGeodesicCurve(point.position, neighbor.position, 15);
          
          // Add curve segments
          for (let j = 0; j < curvePoints.length - 1; j++) {
            const p1 = curvePoints[j];
            const p2 = curvePoints[j + 1];
            
            linePositions.push(
              p1.x, p1.y, p1.z,
              p2.x, p2.y, p2.z
            );
            
            // Use average color for the line with some variation along the curve
            const baseColor = new THREE.Color().addColors(point.color, neighbor.color).multiplyScalar(0.5);
            const variation = 0.1 * Math.sin(j * 0.5); // Subtle color variation along curve
            const curveColor = baseColor.clone().offsetHSL(0, 0, variation);
            
            lineColors.push(
              curveColor.r, curveColor.g, curveColor.b,
              curveColor.r, curveColor.g, curveColor.b
            );
          }
        }
      });
    });
    
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    lineGeometry.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
    
    return { points, lineGeometry, faceGeometries };
  }, [radius]);
  
  useFrame((state) => {
    // Gentle rotation sync with the sphere
    if (pointsRef.current && linesRef.current && facesRef.current) {
      pointsRef.current.rotation.y += 0.002;
      linesRef.current.rotation.y += 0.002;
      facesRef.current.rotation.y += 0.002;
    }
  });

  return (
    <>
      {/* Render polygon faces */}
      <group ref={facesRef}>
        {network.faceGeometries.map((face, index) => (
          <mesh key={index}>
            <bufferGeometry attach="geometry" {...face.geometry} />
            <meshStandardMaterial 
              attach="material" 
              vertexColors={true}
              transparent={true}
              opacity={0.6}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>
      
      {/* Render points */}
      <group ref={pointsRef}>
        {network.points.map((point, index) => (
          <mesh key={index} position={point.position}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial color={point.color} />
          </mesh>
        ))}
      </group>
      
      {/* Render connecting geodesic curves */}
      <group ref={linesRef}>
        <lineSegments>
          <bufferGeometry attach="geometry" {...network.lineGeometry} />
          <lineBasicMaterial attach="material" vertexColors={true} linewidth={4} />
        </lineSegments>
      </group>
    </>
  );
};

export default GeodesicNetwork;
