import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';

// Constantes físicas simuladas
const MAX_MAST_HEIGHT = 5000; // 5000mm

// Componente auxiliar para crear barras con franjas amarillas y negras
const StripedBar = ({ args, position, rotation, isVertical }) => {
  const numStripes = 10;
  const length = isVertical ? args[1] : args[0];
  const thickness = isVertical ? args[0] : args[1];
  const depth = args[2];
  
  return (
    <group position={position} rotation={rotation || [0, 0, 0]}>
      <mesh>
        <boxGeometry args={args} />
        <meshStandardMaterial color="#ffcc00" roughness={0.8} />
      </mesh>
      {Array.from({ length: numStripes }).map((_, i) => {
        const offset = (i / numStripes) * length - length / 2 + (length / numStripes) / 2;
        const pos = isVertical ? [0, offset, 0] : [offset, 0, 0];
        const blackArgs = isVertical 
          ? [thickness * 1.05, length / numStripes / 2, depth * 1.05]
          : [length / numStripes / 2, thickness * 1.05, depth * 1.05];
        return (
          <mesh key={i} position={pos}>
            <boxGeometry args={blackArgs} />
            <meshStandardMaterial color="#111111" roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
};

// ── COMPONENTE LÁSER WENGLOR ──
const WenglorLaser = ({ position, beamLength }) => {
  return (
    <group position={position}>
      {/* Cuerpo principal (Azul Wenglor) */}
      <mesh position={[0, 0.075, 0]}>
        <boxGeometry args={[0.05, 0.15, 0.12]} />
        <meshStandardMaterial color="#1f618d" roughness={0.3} metalness={0.2} />
      </mesh>
      {/* Cara óptica (Negro brillante, apuntando hacia ABAJO) */}
      <mesh position={[0, -0.001, 0]}>
        <boxGeometry args={[0.04, 0.005, 0.10]} />
        <meshStandardMaterial color="#111" roughness={0.1} metalness={0.8} />
      </mesh>
      {/* Conector M12 (Plateado, en la parte superior) */}
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.02]} />
        <meshStandardMaterial color="#ccc" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Haz de luz Láser (Rojo) */}
      <mesh position={[0, -beamLength / 2, 0]}>
        <cylinderGeometry args={[0.005, 0.005, beamLength]} />
        <meshBasicMaterial color="#ff0000" transparent opacity={0.6} />
      </mesh>

      {/* Punto de impacto láser (Suelo u objeto) */}
      <mesh position={[0, -beamLength + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.04, 16]} />
        <meshBasicMaterial color="#ff0000" />
      </mesh>
    </group>
  );
};

// ── COMPONENTE CÁMARA BASLER ──
const BaslerCamera = ({ position, target }) => {
  const groupRef = useRef();

  useFrame(() => {
    if (groupRef.current) {
      // Hacer que la cámara mire hacia el target (la carretilla)
      groupRef.current.lookAt(new THREE.Vector3(...target));
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Cuerpo de la cámara (Gris metálico) */}
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[0.06, 0.06, 0.12]} />
        <meshStandardMaterial color="#b0b5b9" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Lente (Cilindro negro) */}
      <mesh position={[0, 0, 0.14]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.06]} />
        <meshStandardMaterial color="#111111" roughness={0.2} metalness={0.8} />
      </mesh>
      {/* Cristal de la lente */}
      <mesh position={[0, 0, 0.171]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.005]} />
        <meshStandardMaterial color="#44aaff" transparent opacity={0.6} metalness={1} roughness={0} />
      </mesh>
    </group>
  );
};

const CageAssembly = ({ plcState }) => {
  const gateRef = useRef();
  const frontGateRef = useRef();

  const plcRef = useRef(plcState);
  useEffect(() => {
    plcRef.current = plcState;
  }, [plcState]);

  useFrame((state, delta) => {
    // Determine target height based on plcState
    // Default up if nothing specified, or UP if Ob_Subir_Vallas
    // Leer el estado de los detectores en lugar de los comandos de salida
    // Así la animación funcionará tanto en simulación como con el PLC real
    const isDownRear = plcRef.current?.Ob_Dtec_Valla_1_trabajo_LH === true;
    const isUpRear = plcRef.current?.Ob_Dtec_Valla_1_Reposo_LH === true;
    
    const isDownFront = plcRef.current?.Ob_Dtec_Valla_2_trabajo_RH === true;
    const isUpFront = plcRef.current?.Ob_Dtec_Valla_2_Reposo_RH === true;
    
    // La posición original de la valla trasera (Valla 1) en reposo es Y=4.0
    // La valla frontal (Valla 2) no debe bajar tanto para no chocar con los pallets (Y=5.4)
    // Al subir, ambas se elevan a Y=8.7 (tope de la jaula) para despejar el camino
    const targetRearY = isDownRear ? 4.0 : (isUpRear ? 8.7 : 4.0);
    const targetFrontY = isDownFront ? 5.4 : (isUpFront ? 8.7 : 5.4);

    if (gateRef.current) {
      gateRef.current.position.y += (targetRearY - gateRef.current.position.y) * delta * 5;
    }
    if (frontGateRef.current) {
      frontGateRef.current.position.y += (targetFrontY - frontGateRef.current.position.y) * delta * 5;
    }
  });

  return (
    <group>
      {/* ── ESTRUCTURA BLANCA (JAULA) ── */}
      <group>
        {/* Pilares verticales */}
        <mesh position={[-1.2, 4.35, -0.5]}><boxGeometry args={[0.3, 8.7, 0.3]} /><meshStandardMaterial color="#e0e0e0" metalness={0.3} roughness={0.6} /></mesh>
        <mesh position={[1.2, 4.35, -0.5]}><boxGeometry args={[0.3, 8.7, 0.3]} /><meshStandardMaterial color="#e0e0e0" metalness={0.3} roughness={0.6} /></mesh>
        <mesh position={[-1.2, 4.35, 3.0]}><boxGeometry args={[0.3, 8.7, 0.3]} /><meshStandardMaterial color="#e0e0e0" metalness={0.3} roughness={0.6} /></mesh>
        <mesh position={[1.2, 4.35, 3.0]}><boxGeometry args={[0.3, 8.7, 0.3]} /><meshStandardMaterial color="#e0e0e0" metalness={0.3} roughness={0.6} /></mesh>

        {/* Vigas superiores */}
        <mesh position={[0, 8.55, -0.5]}><boxGeometry args={[2.7, 0.3, 0.3]} /><meshStandardMaterial color="#e0e0e0" metalness={0.3} roughness={0.6} /></mesh>
        <mesh position={[0, 8.55, 3.0]}><boxGeometry args={[2.7, 0.3, 0.3]} /><meshStandardMaterial color="#e0e0e0" metalness={0.3} roughness={0.6} /></mesh>
        <mesh position={[-1.2, 8.55, 1.25]}><boxGeometry args={[0.3, 0.3, 3.5]} /><meshStandardMaterial color="#e0e0e0" metalness={0.3} roughness={0.6} /></mesh>
        <mesh position={[1.2, 8.55, 1.25]}><boxGeometry args={[0.3, 0.3, 3.5]} /><meshStandardMaterial color="#e0e0e0" metalness={0.3} roughness={0.6} /></mesh>

        {/* Vigas medias laterales */}
        <mesh position={[-1.2, 4, 1.25]}><boxGeometry args={[0.15, 0.15, 3.5]} /><meshStandardMaterial color="#e0e0e0" metalness={0.3} roughness={0.6} /></mesh>
        <mesh position={[1.2, 4, 1.25]}><boxGeometry args={[0.15, 0.15, 3.5]} /><meshStandardMaterial color="#e0e0e0" metalness={0.3} roughness={0.6} /></mesh>
        
        {/* Tirantes diagonales */}
        <mesh position={[-1.2, 6.35, 1.25]} rotation={[0.6399, 0, 0]}><boxGeometry args={[0.1, 5.86, 0.1]} /><meshStandardMaterial color="#e0e0e0" metalness={0.3} roughness={0.6} /></mesh>
        <mesh position={[-1.2, 6.35, 1.25]} rotation={[-0.6399, 0, 0]}><boxGeometry args={[0.1, 5.86, 0.1]} /><meshStandardMaterial color="#e0e0e0" metalness={0.3} roughness={0.6} /></mesh>
        <mesh position={[1.2, 6.35, 1.25]} rotation={[0.6399, 0, 0]}><boxGeometry args={[0.1, 5.86, 0.1]} /><meshStandardMaterial color="#e0e0e0" metalness={0.3} roughness={0.6} /></mesh>
        <mesh position={[1.2, 6.35, 1.25]} rotation={[-0.6399, 0, 0]}><boxGeometry args={[0.1, 5.86, 0.1]} /><meshStandardMaterial color="#e0e0e0" metalness={0.3} roughness={0.6} /></mesh>

        {/* Base negra del suelo */}
        <mesh position={[0, 0.01, 1.25]} rotation={[-Math.PI/2, 0, 0]}>
          <planeGeometry args={[2.4, 4.5]} />
          <meshStandardMaterial color="#222222" />
        </mesh>

        {/* Tiras LED (Columnas Traseras Z=3.0, caras frontales Z=2.84) */}
        {(() => {
          let ledColor = "#111111"; // Apagado
          let emissive = "#000000";
          let intensity = 0;
          let lightActive = false;
          
          if (plcState?.Ob_LUZ_ROJA) {
            ledColor = "#ff0000"; emissive = "#ff0000"; intensity = 5; lightActive = true;
          } else if (plcState?.Ob_LUZ_VERDE) {
            ledColor = "#00ff00"; emissive = "#00ff00"; intensity = 5; lightActive = true;
          } else if (plcState?.Ob_LUZ_AZUL) {
            ledColor = "#0088ff"; emissive = "#0088ff"; intensity = 5; lightActive = true;
          }

          return (
            <>
              {/* Luces puntuales para iluminar el entorno cuando están encendidas */}
              {lightActive && (
                <>
                  <pointLight position={[-1.2, 2.0, 2.7]} color={emissive} intensity={2} distance={5} />
                  <pointLight position={[1.2, 2.0, 2.7]} color={emissive} intensity={2} distance={5} />
                </>
              )}

              {/* Tira LED Izquierda (Cara Frontal Trasera) */}
              <mesh position={[-1.2, 2.0, 2.84]}>
                <boxGeometry args={[0.15, 2.0, 0.02]} />
                <meshStandardMaterial color={ledColor} emissive={emissive} emissiveIntensity={intensity} />
              </mesh>
              {/* Tira LED Derecha (Cara Frontal Trasera) */}
              <mesh position={[1.2, 2.0, 2.84]}>
                <boxGeometry args={[0.15, 2.0, 0.02]} />
                <meshStandardMaterial color={ledColor} emissive={emissive} emissiveIntensity={intensity} />
              </mesh>
            </>
          );
        })()}
        
        {/* Cámara Basler (Pilar Izquierdo Trasero, Cara Frontal) apuntando al centro de la carretilla */}
        <BaslerCamera position={[-1.2, 3.2, 2.84]} target={[0, 1.0, 0]} />
      </group>

      {/* ── CARGAS (PESOS DE PRUEBA) EN EL FRENTE (Z=2.2) ── */}
      <group position={[0, 0, 2.2]}>
        {Array.from({ length: 18 }).map((_, i) => {
          const weight = 4500 - (i * 250);
          return (
            <group key={i} position={[0, 0.1 + i * 0.22, 0]}>
              {/* Estructura principal del peso */}
              <mesh><boxGeometry args={[1.6, 0.2, 1.0]} /><meshStandardMaterial color="#cccccc" metalness={0.2} roughness={0.8} /></mesh>
              
              {/* Huecos para las horquillas en la parte FRONTAL (-Z) */}
              <mesh position={[-0.35, 0, -0.51]}><boxGeometry args={[0.25, 0.1, 0.05]} /><meshBasicMaterial color="#111111" /></mesh>
              <mesh position={[0.35, 0, -0.51]}><boxGeometry args={[0.25, 0.1, 0.05]} /><meshBasicMaterial color="#111111" /></mesh>
              
              {/* Pegatina de texto Frontal (orientada hacia la carretilla) */}
              <mesh position={[0, 0, -0.505]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.3, 0.1]} /><meshBasicMaterial color="#ffffff" /></mesh>
              <Text position={[0, 0, -0.51]} rotation={[0, Math.PI, 0]} fontSize={0.07} color="#000000" fontWeight="bold" anchorX="center" anchorY="middle">
                {weight}
              </Text>

              {/* Pegatina de texto Lateral Izquierdo */}
              <mesh position={[-0.805, 0, 0]} rotation={[0, -Math.PI/2, 0]}><planeGeometry args={[0.3, 0.1]} /><meshBasicMaterial color="#ffffff" /></mesh>
              <Text position={[-0.81, 0, 0]} rotation={[0, -Math.PI/2, 0]} fontSize={0.07} color="#000000" fontWeight="bold" anchorX="center" anchorY="middle">
                {weight}
              </Text>

              {/* Pegatina de texto Lateral Derecho */}
              <mesh position={[0.805, 0, 0]} rotation={[0, Math.PI/2, 0]}><planeGeometry args={[0.3, 0.1]} /><meshBasicMaterial color="#ffffff" /></mesh>
              <Text position={[0.81, 0, 0]} rotation={[0, Math.PI/2, 0]} fontSize={0.07} color="#000000" fontWeight="bold" anchorX="center" anchorY="middle">
                {weight}
              </Text>
            </group>
          );
        })}
      </group>

      {/* ── VALLA NEUMÁTICA (Z=-0.5) ── */}
      <group ref={gateRef} position={[0, 4, -0.5]}>
        {/* Marco exterior */}
        <StripedBar args={[2.0, 0.1, 0.05]} position={[0, 1.5, 0]} isVertical={false} />
        <StripedBar args={[2.0, 0.1, 0.05]} position={[0, -1.5, 0]} isVertical={false} />
        <StripedBar args={[0.1, 3.0, 0.05]} position={[-0.95, 0, 0]} isVertical={true} />
        <StripedBar args={[0.1, 3.0, 0.05]} position={[0.95, 0, 0]} isVertical={true} />
        
        {/* Rejilla interior */}
        <StripedBar args={[1.8, 0.05, 0.05]} position={[0, 0.5, 0]} isVertical={false} />
        <StripedBar args={[1.8, 0.05, 0.05]} position={[0, -0.5, 0]} isVertical={false} />
        <StripedBar args={[0.05, 3.0, 0.05]} position={[-0.3, 0, 0]} isVertical={true} />
        <StripedBar args={[0.05, 3.0, 0.05]} position={[0.3, 0, 0]} isVertical={true} />
        
        {/* Vástagos móviles (unidos a la valla) */}
        <mesh position={[-0.6, 3.25, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 3.5]} />
          <meshStandardMaterial color="#7a8288" />
        </mesh>
        <mesh position={[0.6, 3.25, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 3.5]} />
          <meshStandardMaterial color="#7a8288" />
        </mesh>
      </group>

      {/* ── VALLA NEUMÁTICA FRONTAL (Z=1.3, delante de los pallets) ── */}
      <group ref={frontGateRef} position={[0, 4, 1.3]}>
        {/* Marco exterior */}
        <StripedBar args={[2.0, 0.1, 0.05]} position={[0, 1.5, 0]} isVertical={false} />
        <StripedBar args={[2.0, 0.1, 0.05]} position={[0, -1.5, 0]} isVertical={false} />
        <StripedBar args={[0.1, 3.0, 0.05]} position={[-0.95, 0, 0]} isVertical={true} />
        <StripedBar args={[0.1, 3.0, 0.05]} position={[0.95, 0, 0]} isVertical={true} />
        
        {/* Rejilla interior */}
        <StripedBar args={[1.8, 0.05, 0.05]} position={[0, 0.5, 0]} isVertical={false} />
        <StripedBar args={[1.8, 0.05, 0.05]} position={[0, -0.5, 0]} isVertical={false} />
        <StripedBar args={[0.05, 3.0, 0.05]} position={[-0.3, 0, 0]} isVertical={true} />
        <StripedBar args={[0.05, 3.0, 0.05]} position={[0.3, 0, 0]} isVertical={true} />
        
        {/* Vástagos móviles (unidos a la valla) */}
        <mesh position={[-0.6, 3.0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 3.0]} />
          <meshStandardMaterial color="#7a8288" />
        </mesh>
        <mesh position={[0.6, 3.0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 3.0]} />
          <meshStandardMaterial color="#7a8288" />
        </mesh>
      </group>

      {/* ── CILINDROS NEUMÁTICOS FIJOS (VALLA TRASERA Z=-0.5) ── */}
      <mesh position={[-0.6, 9.0, -0.5]}>
        <cylinderGeometry args={[0.06, 0.06, 3.0]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      <mesh position={[0.6, 9.0, -0.5]}>
        <cylinderGeometry args={[0.06, 0.06, 3.0]} />
        <meshStandardMaterial color="#444" />
      </mesh>

      {/* ── CILINDROS NEUMÁTICOS FIJOS (VALLA FRONTAL Z=1.3) ── */}
      <mesh position={[-0.6, 9.0, 1.3]}>
        <cylinderGeometry args={[0.06, 0.06, 3.0]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      <mesh position={[0.6, 9.0, 1.3]}>
        <cylinderGeometry args={[0.06, 0.06, 3.0]} />
        <meshStandardMaterial color="#444" />
      </mesh>

      {/* ── SENSORES LÁSER WENGLOR ── */}
      {/* Láser 1: Apuntando entre las horquillas de la carretilla */}
      <WenglorLaser position={[0, 8.7, 0.8]} beamLength={8.7} />
      {/* Láser 2: Apuntando al centro de la torre de pallets (altura del pallet superior Y=3.94) */}
      <WenglorLaser position={[0, 8.7, 2.0]} beamLength={8.7 - 3.94} />

    </group>
  );
};

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
  
  const renderWheel = (pos, isRear, isRight) => {
    const tireRadius = isRear ? 0.25 : 0.3;
    const tireWidth = isRear ? 0.2 : 0.25;
    const rimRadius = isRear ? 0.15 : 0.18;
    const zFlip = isRight ? -1 : 1; // Orientación hacia afuera
    const yOffset = (tireWidth * 0.4) * zFlip;
    
    return (
      <group position={pos} rotation={[0, 0, Math.PI / 2]}>
        {/* Tire Main */}
        <mesh><cylinderGeometry args={[tireRadius, tireRadius, tireWidth, 32]} />{blackMat}</mesh>
        
        {/* Tire Rounded Edges */}
        <mesh position={[0, tireWidth/2, 0]}><torusGeometry args={[tireRadius-0.02, 0.02, 16, 32]} rotation={[Math.PI/2, 0, 0]} />{blackMat}</mesh>
        <mesh position={[0, -tireWidth/2, 0]}><torusGeometry args={[tireRadius-0.02, 0.02, 16, 32]} rotation={[Math.PI/2, 0, 0]} />{blackMat}</mesh>
        
        {/* Outer Rim */}
        <mesh position={[0, yOffset, 0]}><cylinderGeometry args={[rimRadius, rimRadius, 0.06, 32]} />{steelMat}</mesh>
        
        {/* Inner Hub Depression */}
        <mesh position={[0, yOffset + (0.01 * zFlip), 0]}><cylinderGeometry args={[rimRadius * 0.7, rimRadius * 0.7, 0.08, 32]} />{darkMat}</mesh>
        
        {/* Central Axle Cap */}
        <mesh position={[0, yOffset + (0.04 * zFlip), 0]}><cylinderGeometry args={[0.04, 0.04, 0.05, 16]} />{chassisMat}</mesh>
        
        {/* Lug Nuts (Tuercas) */}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const angle = (i / 6) * Math.PI * 2;
          const radius = rimRadius * 0.45;
          return (
            <mesh key={i} position={[Math.cos(angle) * radius, yOffset + (0.03 * zFlip), Math.sin(angle) * radius]}>
              <cylinderGeometry args={[0.015, 0.015, 0.06, 6]} />{steelMat}
            </mesh>
          );
        })}
      </group>
    );
  };

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
        {renderWheel([-0.65, 0.3, 0.3], false, false)} {/* Front Left */}
        {renderWheel([0.65, 0.3, 0.3], false, true)}   {/* Front Right */}
        {renderWheel([-0.45, 0.25, -1.35], true, false)} {/* Rear Left */}
        {renderWheel([0.45, 0.25, -1.35], true, true)}   {/* Rear Right */}
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

const DigitalTwin = ({ distance, plcState }) => {
  return (
    <div className="w-full h-full bg-gradient-to-b from-[#1d2930] to-[#0f171e]">
      <Canvas camera={{ position: [4, 3, 5], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        <Environment preset="warehouse" blur={0.8} />
        
        <CageAssembly plcState={plcState} />
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
