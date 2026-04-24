import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

// Constantes físicas simuladas
const MAX_MAST_HEIGHT = 5000; // 5000mm

const ForkliftAssembly = ({ distance }) => {
  const carriageRef = useRef();
  const beaconRef = useRef();

  useFrame((state) => {
    if (carriageRef.current) {
      // Clamp distance so it physically doesn't exceed the 2.5m tall mast
      const targetY = THREE.MathUtils.clamp(distance / 1000, 0, 2.5);
      carriageRef.current.position.y = THREE.MathUtils.lerp(carriageRef.current.position.y, targetY, 0.1);
    }
    if (beaconRef.current) {
      beaconRef.current.rotation.y = state.clock.elapsedTime * 10;
    }
  });

  const greenMat = <meshStandardMaterial color="#35c29f" metalness={0.3} roughness={0.2} />;
  const darkMat = <meshStandardMaterial color="#1f2326" metalness={0.5} roughness={0.5} />;
  const steelMat = <meshStandardMaterial color="#7a8288" metalness={0.9} roughness={0.2} />;
  const blackMat = <meshStandardMaterial color="#111111" roughness={0.9} />;
  const chassisMat = <meshStandardMaterial color="#16191a" metalness={0.6} roughness={0.4} />;
  
  return (
    <group position={[0, 0, 0]}>
      {/* --- CHASSIS --- */}
      <group position={[0, 0, 0]}>
        {/* Main Base */}
        <RoundedBox args={[1.0, 0.3, 1.8]} radius={0.05} position={[0, 0.35, -0.4]}>{chassisMat}</RoundedBox>
        {/* Lower Counterweight */}
        <RoundedBox args={[1.0, 0.35, 0.4]} radius={0.05} position={[0, 0.375, -1.4]}>{chassisMat}</RoundedBox>
        
        {/* Green Battery/Side Covers */}
        <RoundedBox args={[1.02, 0.35, 1.1]} radius={0.05} position={[0, 0.65, -0.6]}>{greenMat}</RoundedBox>
        {/* Green Counterweight Top */}
        <RoundedBox args={[1.02, 0.45, 0.5]} radius={0.1} position={[0, 0.75, -1.3]}>{greenMat}</RoundedBox>
        {/* Slanted front panel */}
        <mesh position={[0, 0.65, -0.05]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[1.02, 0.4, 0.3]} />
          {greenMat}
        </mesh>
        
        {/* Side steps */}
        <mesh position={[-0.45, 0.35, -0.2]}><boxGeometry args={[0.2, 0.05, 0.3]} />{blackMat}</mesh>
        <mesh position={[0.45, 0.35, -0.2]}><boxGeometry args={[0.2, 0.05, 0.3]} />{blackMat}</mesh>

        {/* Taillights */}
        <mesh position={[-0.4, 0.9, -1.56]}><boxGeometry args={[0.15, 0.05, 0.02]} /><meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.5} /></mesh>
        <mesh position={[0.4, 0.9, -1.56]}><boxGeometry args={[0.15, 0.05, 0.02]} /><meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.5} /></mesh>
      </group>

      {/* --- WHEELS --- */}
      <group>
        {/* Front Left */}
        <group position={[-0.65, 0.3, 0.3]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.3, 0.3, 0.25, 32]} />{blackMat}
          <mesh position={[0, 0.13, 0]}><cylinderGeometry args={[0.15, 0.15, 0.02, 32]} />{steelMat}</mesh>
        </group>
        {/* Front Right */}
        <group position={[0.65, 0.3, 0.3]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.3, 0.3, 0.25, 32]} />{blackMat}
          <mesh position={[0, -0.13, 0]}><cylinderGeometry args={[0.15, 0.15, 0.02, 32]} />{steelMat}</mesh>
        </group>
        {/* Rear Left */}
        <group position={[-0.45, 0.25, -1.35]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.25, 0.25, 0.2, 32]} />{blackMat}
          <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.12, 0.12, 0.02, 32]} />{steelMat}</mesh>
        </group>
        {/* Rear Right */}
        <group position={[0.45, 0.25, -1.35]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.25, 0.25, 0.2, 32]} />{blackMat}
          <mesh position={[0, -0.1, 0]}><cylinderGeometry args={[0.12, 0.12, 0.02, 32]} />{steelMat}</mesh>
        </group>
      </group>

      {/* --- CABIN --- */}
      <group>
        {/* Seat Base & Cushion */}
        <RoundedBox args={[0.4, 0.15, 0.4]} radius={0.05} position={[0, 0.9, -0.6]}>{blackMat}</RoundedBox>
        <RoundedBox args={[0.4, 0.45, 0.1]} radius={0.05} position={[0, 1.15, -0.75]} rotation={[-0.1, 0, 0]}>{blackMat}</RoundedBox>
        {/* Armrests */}
        <RoundedBox args={[0.08, 0.05, 0.3]} radius={0.02} position={[-0.25, 1.05, -0.6]}>{blackMat}</RoundedBox>
        <RoundedBox args={[0.12, 0.08, 0.35]} radius={0.02} position={[0.26, 1.05, -0.6]}>{blackMat}</RoundedBox>
        {/* Joysticks */}
        <mesh position={[0.23, 1.12, -0.55]}><cylinderGeometry args={[0.01, 0.01, 0.08]} />{steelMat}</mesh>
        <mesh position={[0.23, 1.16, -0.55]}><sphereGeometry args={[0.02]} />{blackMat}</mesh>
        <mesh position={[0.29, 1.12, -0.55]}><cylinderGeometry args={[0.01, 0.01, 0.08]} />{steelMat}</mesh>
        <mesh position={[0.29, 1.16, -0.55]}><sphereGeometry args={[0.02]} />{blackMat}</mesh>

        {/* Dashboard & Steering */}
        <mesh position={[0, 0.95, -0.1]} rotation={[-0.4, 0, 0]}>
          <boxGeometry args={[0.4, 0.3, 0.2]} />
          {chassisMat}
        </mesh>
        {/* Small Screen */}
        <mesh position={[0, 1.02, -0.01]} rotation={[-0.4, 0, 0]}>
          <planeGeometry args={[0.15, 0.1]} />
          <meshBasicMaterial color="#00ffcc" />
        </mesh>
        <mesh position={[0, 1.05, -0.15]} rotation={[-0.4, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.06, 0.3]} />
          {chassisMat}
        </mesh>
        <mesh position={[0, 1.18, -0.2]} rotation={[1.1, 0, 0]}>
          <torusGeometry args={[0.14, 0.025, 16, 32]} />
          {blackMat}
        </mesh>
        {/* Steering knob */}
        <mesh position={[-0.1, 1.22, -0.26]}><sphereGeometry args={[0.03]} />{blackMat}</mesh>
      </group>

      {/* --- OVERHEAD GUARD --- */}
      <group>
        {/* Pillars */}
        <mesh position={[-0.48, 1.4, 0.05]} rotation={[0.05, 0, 0]}><boxGeometry args={[0.06, 1.3, 0.08]} />{darkMat}</mesh>
        <mesh position={[0.48, 1.4, 0.05]} rotation={[0.05, 0, 0]}><boxGeometry args={[0.06, 1.3, 0.08]} />{darkMat}</mesh>
        <mesh position={[-0.48, 1.4, -1.05]} rotation={[-0.05, 0, 0]}><boxGeometry args={[0.08, 1.3, 0.1]} />{darkMat}</mesh>
        <mesh position={[0.48, 1.4, -1.05]} rotation={[-0.05, 0, 0]}><boxGeometry args={[0.08, 1.3, 0.1]} />{darkMat}</mesh>
        
        {/* Mirrors */}
        <mesh position={[-0.55, 1.6, 0.05]} rotation={[0, 0.5, 0]}><boxGeometry args={[0.02, 0.15, 0.08]} />{blackMat}</mesh>
        <mesh position={[0.55, 1.6, 0.05]} rotation={[0, -0.5, 0]}><boxGeometry args={[0.02, 0.15, 0.08]} />{blackMat}</mesh>

        {/* Roof Frame */}
        <mesh position={[-0.48, 2.05, -0.5]}><boxGeometry args={[0.06, 0.06, 1.3]} />{darkMat}</mesh>
        <mesh position={[0.48, 2.05, -0.5]}><boxGeometry args={[0.06, 0.06, 1.3]} />{darkMat}</mesh>
        <mesh position={[0, 2.05, 0.1]}><boxGeometry args={[1.0, 0.06, 0.06]} />{darkMat}</mesh>
        <mesh position={[0, 2.05, -1.1]}><boxGeometry args={[1.0, 0.06, 0.06]} />{darkMat}</mesh>
        
        {/* Roof Slats */}
        {[-0.9, -0.7, -0.5, -0.3, -0.1].map((z, i) => (
          <mesh key={`slat-${i}`} position={[0, 2.05, z]}>
            <boxGeometry args={[0.96, 0.02, 0.08]} />{darkMat}
          </mesh>
        ))}

        {/* Beacon Light */}
        <group position={[0, 2.15, -1.0]}>
          <mesh><cylinderGeometry args={[0.05, 0.05, 0.08]} />{chassisMat}</mesh>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.1]} />
            <meshStandardMaterial color="#ffaa00" emissive="#ffaa00" emissiveIntensity={2} transparent opacity={0.8} />
          </mesh>
          <group ref={beaconRef}>
            <pointLight distance={3} intensity={5} color="#ffaa00" position={[0.1, 0, 0]} />
          </group>
        </group>
      </group>

      {/* --- MAST SYSTEM --- */}
      <group position={[0, 0, 0.6]}>
        {/* Tilt Cylinders */}
        <mesh position={[-0.3, 0.4, -0.2]} rotation={[0.2, 0, 0]}><cylinderGeometry args={[0.04, 0.04, 0.4]} />{blackMat}</mesh>
        <mesh position={[-0.3, 0.4, -0.05]} rotation={[0.2, 0, 0]}><cylinderGeometry args={[0.02, 0.02, 0.3]} />{steelMat}</mesh>
        <mesh position={[0.3, 0.4, -0.2]} rotation={[0.2, 0, 0]}><cylinderGeometry args={[0.04, 0.04, 0.4]} />{blackMat}</mesh>
        <mesh position={[0.3, 0.4, -0.05]} rotation={[0.2, 0, 0]}><cylinderGeometry args={[0.02, 0.02, 0.3]} />{steelMat}</mesh>

        {/* Triplex Mast Rails */}
        {/* Outer */}
        <mesh position={[-0.35, 1.35, 0]}><boxGeometry args={[0.08, 2.5, 0.15]} />{darkMat}</mesh>
        <mesh position={[0.35, 1.35, 0]}><boxGeometry args={[0.08, 2.5, 0.15]} />{darkMat}</mesh>
        {/* Middle */}
        <mesh position={[-0.25, 1.35, 0.05]}><boxGeometry args={[0.06, 2.5, 0.1]} />{darkMat}</mesh>
        <mesh position={[0.25, 1.35, 0.05]}><boxGeometry args={[0.06, 2.5, 0.1]} />{darkMat}</mesh>
        {/* Inner */}
        <mesh position={[-0.15, 1.35, 0.1]}><boxGeometry args={[0.05, 2.5, 0.08]} />{darkMat}</mesh>
        <mesh position={[0.15, 1.35, 0.1]}><boxGeometry args={[0.05, 2.5, 0.08]} />{darkMat}</mesh>

        {/* Mast Crossbars */}
        <mesh position={[0, 2.5, 0]}><boxGeometry args={[0.7, 0.1, 0.1]} />{darkMat}</mesh>
        <mesh position={[0, 1.0, 0]}><boxGeometry args={[0.7, 0.1, 0.1]} />{darkMat}</mesh>
        <mesh position={[0, 0.2, 0]}><boxGeometry args={[0.7, 0.1, 0.1]} />{darkMat}</mesh>

        {/* Central Hydraulic Cylinders */}
        <mesh position={[-0.05, 1.3, -0.05]}><cylinderGeometry args={[0.03, 0.03, 2.4]} />{steelMat}</mesh>
        <mesh position={[0.05, 1.3, -0.05]}><cylinderGeometry args={[0.03, 0.03, 2.4]} />{steelMat}</mesh>
        {/* Chains (simulated with thin dark boxes) */}
        <mesh position={[-0.1, 1.3, -0.02]}><boxGeometry args={[0.02, 2.4, 0.01]} />{blackMat}</mesh>
        <mesh position={[0.1, 1.3, -0.02]}><boxGeometry args={[0.02, 2.4, 0.01]} />{blackMat}</mesh>

        {/* --- CARRIAGE (Animated) --- */}
        <group ref={carriageRef} position={[0, 0, 0.15]}>
          {/* Backrest Grill */}
          <group position={[0, 0.5, 0]}>
            <mesh position={[0, 0.4, 0]}><boxGeometry args={[0.9, 0.08, 0.05]} />{darkMat}</mesh>
            <mesh position={[0, -0.4, 0]}><boxGeometry args={[0.9, 0.08, 0.05]} />{darkMat}</mesh>
            <mesh position={[0, 0, 0]}><boxGeometry args={[0.9, 0.04, 0.05]} />{darkMat}</mesh>
            {[-0.4, -0.2, 0, 0.2, 0.4].map((x, i) => (
              <mesh key={`v-grill-${i}`} position={[x, 0, 0]}>
                <boxGeometry args={[0.05, 0.8, 0.05]} />{darkMat}
              </mesh>
            ))}
          </group>

          {/* Forks */}
          <group position={[-0.25, 0.05, 0.6]}>
            <RoundedBox args={[0.12, 0.04, 1.2]} radius={0.01} position={[0, 0, 0]}>{steelMat}</RoundedBox>
            <RoundedBox args={[0.12, 0.6, 0.05]} radius={0.01} position={[0, 0.3, -0.58]}>{steelMat}</RoundedBox>
          </group>
          <group position={[0.25, 0.05, 0.6]}>
            <RoundedBox args={[0.12, 0.04, 1.2]} radius={0.01} position={[0, 0, 0]}>{steelMat}</RoundedBox>
            <RoundedBox args={[0.12, 0.6, 0.05]} radius={0.01} position={[0, 0.3, -0.58]}>{steelMat}</RoundedBox>
          </group>
          
          {/* Pegatina Basler Target (Simulada) */}
          <mesh position={[0, 1.0, 0.03]}>
            <planeGeometry args={[0.15, 0.15]} />
            <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>
    </group>
  );
};

const DigitalTwin = ({ distance }) => {
  return (
    <div className="w-full h-full bg-gradient-to-b from-[#1d2930] to-[#0f171e]">
      <Canvas camera={{ position: [4, 3, 5], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        <Environment preset="warehouse" blur={0.8} />
        
        <ForkliftAssembly distance={distance} />
        
        {/* Suelo Industrial */}
        <Grid 
          infiniteGrid 
          fadeDistance={20} 
          sectionColor="#dd2876" 
          cellColor="#5d7a8a" 
          cellSize={0.5} 
          sectionSize={2.5} 
          position={[0, 0, 0]} 
        />
        
        <OrbitControls 
          target={[0, 2.5, 0]} 
          maxPolarAngle={Math.PI / 2 - 0.05} // Evitar ir por debajo del suelo
          minDistance={3}
          maxDistance={15}
          enableDamping
        />
      </Canvas>
    </div>
  );
};

export default DigitalTwin;
