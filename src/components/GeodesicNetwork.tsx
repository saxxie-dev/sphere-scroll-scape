
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
  const patchesRef = useRef<THREE.Group>(null);
  
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

  // Generate spherical patch geometry for a region bounded by geodesics
  const createSphericalPatch = (centerPoint: THREE.Vector3, neighborPoints: THREE.Vector3[], color: THREE.Color) => {
    const vertices: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    
    // Create a spherical patch by subdividing the surface
    const segments = 16;
    
    // Sort neighbors by angle around center to create proper ordering
    const sortedNeighbors = neighborPoints.map(pos => ({
      position: pos,
      angle: Math.atan2(
        pos.clone().cross(centerPoint).length(),
        pos.clone().dot(centerPoint)
      )
    })).sort((a, b) => a.angle - b.angle).map(item => item.position);
    
    // Create triangular patches from center to each pair of adjacent neighbors
    for (let i = 0; i < sortedNeighbors.length; i++) {
      const neighbor1 = sortedNeighbors[i];
      const neighbor2 = sortedNeighbors[(i + 1) % sortedNeighbors.length];
      
      // Subdivide the spherical triangle for smoother surface
      for (let u = 0; u < segments; u++) {
        for (let v = 0; v < segments - u; v++) {
          const u1 = u / segments;
          const v1 = v / segments;
          const w1 = 1 - u1 - v1;
          
          const u2 = (u + 1) / segments;
          const v2 = v / segments;
          const w2 = 1 - u2 - v2;
          
          const u3 = u / segments;
          const v3 = (v + 1) / segments;
          const w3 = 1 - u3 - v3;
          
          if (w1 >= 0 && w2 >= 0 && w3 >= 0) {
            // Barycentric interpolation on sphere surface
            const p1 = centerPoint.clone().multiplyScalar(w1)
              .add(neighbor1.clone().multiplyScalar(u1))
              .add(neighbor2.clone().multiplyScalar(v1))
              .normalize().multiplyScalar(radius);
              
            const p2 = centerPoint.clone().multiplyScalar(w2)
              .add(neighbor1.clone().multiplyScalar(u2))
              .add(neighbor2.clone().multiplyScalar(v2))
              .normalize().multiplyScalar(radius);
              
            const p3 = centerPoint.clone().multiplyScalar(w3)
              .add(neighbor1.clone().multiplyScalar(u3))
              .add(neighbor2.clone().multiplyScalar(v3))
              .normalize().multiplyScalar(radius);
            
            vertices.push(p1.x, p1.y, p1.z);
            vertices.push(p2.x, p2.y, p2.z);
            vertices.push(p3.x, p3.y, p3.z);
            
            // Add colors
            for (let k = 0; k < 3; k++) {
              colors.push(color.r, color.g, color.b);
            }
            
            // Add UV coordinates
            uvs.push(u1, v1, u2, v2, u3, v3);
          }
        }
      }
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();
    
    return geometry;
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
    
    // Create spherical surface patches
    const patchGeometries: { geometry: THREE.BufferGeometry; color: THREE.Color }[] = [];
    
    points.forEach((point, i) => {
      // Create spherical patch for each point's neighborhood
      if (point.neighbors.length >= 3) {
        const neighborPositions = point.neighbors.map(ni => points[ni].position);
        const patchGeometry = createSphericalPatch(point.position, neighborPositions, point.color);
        patchGeometries.push({ geometry: patchGeometry, color: point.color });
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
    
    return { points, lineGeometry, patchGeometries };
  }, [radius]);
  
  useFrame((state) => {
    // Gentle rotation sync with the sphere
    if (pointsRef.current && linesRef.current && patchesRef.current) {
      pointsRef.current.rotation.y += 0.002;
      linesRef.current.rotation.y += 0.002;
      patchesRef.current.rotation.y += 0.002;
    }
  });

  return (
    <>
      {/* Render spherical surface patches */}
      <group ref={patchesRef}>
        {network.patchGeometries.map((patch, index) => (
          <mesh key={index}>
            <bufferGeometry attach="geometry" {...patch.geometry} />
            <meshStandardMaterial 
              attach="material" 
              vertexColors={true}
              transparent={true}
              opacity={0.8}
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
