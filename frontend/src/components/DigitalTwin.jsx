import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
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
const WenglorLaser = React.forwardRef(({ position, beamLength }, ref) => {
  const beamRef = useRef();
  const dotRef = useRef();

  React.useImperativeHandle(ref, () => ({
    setLength: (len) => {
      if (beamRef.current) {
        beamRef.current.scale.y = len / beamLength;
        beamRef.current.position.y = -len / 2;
      }
      if (dotRef.current) {
        dotRef.current.position.y = -len + 0.01;
      }
    }
  }));

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
      <mesh ref={beamRef} position={[0, -beamLength / 2, 0]}>
        <cylinderGeometry args={[0.005, 0.005, beamLength]} />
        <meshBasicMaterial color="#ff0000" transparent opacity={0.6} />
      </mesh>

      {/* Punto de impacto láser (Suelo u objeto) */}
      <mesh ref={dotRef} position={[0, -beamLength + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.04, 16]} />
        <meshBasicMaterial color="#ff0000" />
      </mesh>
    </group>
  );
});

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

// ── COMPONENTE PALET DE MADERA ──
const WoodenPallet = ({ position }) => {
  const woodMat = <meshStandardMaterial color="#8b5a2b" roughness={0.9} />;
  return (
    <group position={position}>
      {/* Tablas superiores (simuladas con un bloque plano por simplicidad o varias tablas) */}
      <mesh position={[0, 0.06, 0]}><boxGeometry args={[1.6, 0.03, 1.0]} />{woodMat}</mesh>
      
      {/* Tacos (bloques) */}
      <mesh position={[-0.75, 0, -0.4]}><boxGeometry args={[0.1, 0.09, 0.1]} />{woodMat}</mesh>
      <mesh position={[0, 0, -0.4]}><boxGeometry args={[0.1, 0.09, 0.1]} />{woodMat}</mesh>
      <mesh position={[0.75, 0, -0.4]}><boxGeometry args={[0.1, 0.09, 0.1]} />{woodMat}</mesh>
      
      <mesh position={[-0.75, 0, 0]}><boxGeometry args={[0.1, 0.09, 0.1]} />{woodMat}</mesh>
      <mesh position={[0, 0, 0]}><boxGeometry args={[0.1, 0.09, 0.1]} />{woodMat}</mesh>
      <mesh position={[0.75, 0, 0]}><boxGeometry args={[0.1, 0.09, 0.1]} />{woodMat}</mesh>

      <mesh position={[-0.75, 0, 0.4]}><boxGeometry args={[0.1, 0.09, 0.1]} />{woodMat}</mesh>
      <mesh position={[0, 0, 0.4]}><boxGeometry args={[0.1, 0.09, 0.1]} />{woodMat}</mesh>
      <mesh position={[0.75, 0, 0.4]}><boxGeometry args={[0.1, 0.09, 0.1]} />{woodMat}</mesh>

      {/* Tablas inferiores */}
      <mesh position={[-0.75, -0.06, 0]}><boxGeometry args={[0.1, 0.03, 1.0]} />{woodMat}</mesh>
      <mesh position={[0, -0.06, 0]}><boxGeometry args={[0.1, 0.03, 1.0]} />{woodMat}</mesh>
      <mesh position={[0.75, -0.06, 0]}><boxGeometry args={[0.1, 0.03, 1.0]} />{woodMat}</mesh>
    </group>
  );
};



// ── COMPONENTE PALET DE LA PILA (PESO DE PRUEBA) ──
const StackPallet = ({ position, weight }) => {
  return (
    <group position={position}>
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
};

const CageAssembly = ({ plcState, currentStep, erpData }) => {
  const gateRef = useRef();
  const frontGateRef = useRef();
  const laser1Ref = useRef();

  const plcRef = useRef(plcState);
  useEffect(() => {
    plcRef.current = plcState;
  }, [plcState]);

  const laser2Ref = useRef();

  useFrame((state, delta) => {
    // Determine target height based on plcState
    // Leer el estado de los detectores de trabajo y reposo (Valla 1 = Adelante, Valla 2 = Atras)
    const isDownFront = plcRef.current?.Ob_Trabajo_Cilindro_Valla_1 === true;
    const isUpFront = plcRef.current?.Ob_Reposo_Cilindro_Valla_1 === true;
    
    const isDownRear = plcRef.current?.Ob_Trabajo_Cilindro_Valla_2 === true;
    const isUpRear = plcRef.current?.Ob_Reposo_Cilindro_Valla_1 === true;

    const commandDown = plcRef.current?.Ib_EV_VALLA_TRABAJO === true;
    const commandUp = plcRef.current?.Ib_EV_VALLA_REPOSO === true;
    
    // La posición original de la valla trasera (Valla 2) en reposo es Y=4.0 (abajo/trabajo) o 7.1 (reposo)
    // La valla frontal (Valla 1) no debe bajar tanto para no chocar con los pallets (Y=5.4 trabajo) o 7.1 (reposo)
    let targetFrontY = 7.1;
    if (isDownFront) {
      targetFrontY = 5.4;
    } else if (isUpFront) {
      targetFrontY = 7.1;
    } else if (commandDown) {
      targetFrontY = 5.4;
    } else if (commandUp) {
      targetFrontY = 7.1;
    }

    let targetRearY = 7.1;
    if (isDownRear) {
      targetRearY = 4.0;
    } else if (isUpRear) {
      targetRearY = 7.1;
    } else if (commandDown) {
      targetRearY = 4.0;
    } else if (commandUp) {
      targetRearY = 7.1;
    }

    if (gateRef.current) {
      gateRef.current.position.y += (targetRearY - gateRef.current.position.y) * delta * 5;
    }
    if (frontGateRef.current) {
      frontGateRef.current.position.y += (targetFrontY - frontGateRef.current.position.y) * delta * 5;
    }
    
    // Animar láser 1 (Carretilla)
    if (laser1Ref.current && window.__carriageY !== undefined) {
      let targetY = 0; // Si no hay palet en horquillas, al suelo
      if (window.__hasPalletOnForks) {
        targetY = window.__carriageY + 0.185; 
      }
      laser1Ref.current.setLength(8.7 - targetY);
    }

    // Animar láser 2 (Torre de pesos)
    if (laser2Ref.current) {
      let targetY = 0; // Suelo por defecto si no hay nada
      // Altura del bloque superior de pesos (18 bloques de 0.22 de altura base)
      // Bloque 17 está en Y = 0.1 + 17*0.22 = 3.84, su parte superior es 3.84 + 0.1 = 3.94
      // Si hay palet de madera, su altura es Y = 4.06, tope = 4.195
      const hasWeights = true; // Por ahora los pesos son estáticos
      if (window.__hasPalletOnStack) {
        targetY = 4.14; // Superficie del palet de madera
      } else if (hasWeights) {
        targetY = 3.94; // Superficie del peso superior
      }
      laser2Ref.current.setLength(8.7 - targetY);
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
        <mesh position={[0, 8.55, 0.75]}><boxGeometry args={[2.7, 0.3, 0.3]} /><meshStandardMaterial color="#e0e0e0" metalness={0.3} roughness={0.6} /></mesh>
        <mesh position={[0, 8.55, 2.2]}><boxGeometry args={[2.7, 0.3, 0.3]} /><meshStandardMaterial color="#e0e0e0" metalness={0.3} roughness={0.6} /></mesh>
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
          
          if (plcState?.Ib_LUZ_ROJA) {
            ledColor = "#ff0000"; emissive = "#ff0000"; intensity = 5; lightActive = true;
          } else if (plcState?.Ib_LUZ_VERDE) {
            ledColor = "#00ff00"; emissive = "#00ff00"; intensity = 5; lightActive = true;
          } else if (plcState?.Ib_LUZ_AZUL) {
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
        {(() => {
          const showWhitePallets = currentStep === 3 || currentStep === 4;
          const targetWeight = erpData?.capac_interm_1 || 0;
          const pickedUpCount = (showWhitePallets && typeof window !== 'undefined' && window.__hasPalletOnForks) 
            ? Math.max(0, Math.floor(targetWeight / 250)) : 0;
          
          const remainingCount = Math.max(0, 18 - pickedUpCount);

          return Array.from({ length: remainingCount }).map((_, i) => {
            const weight = 4500 - (i * 250);
            return (
              <StackPallet key={`ground-${i}`} position={[0, 0.1 + i * 0.22, 0]} weight={weight} />
            );
          });
        })()}

        {/* Palet de madera adicional (solo si está 'idle' o en las primeras fases de 'animating') */}
        {(() => {
          const hasPallet = !window.__palletState || window.__palletState === 'idle' || (window.__palletState === 'animating' && (window.__palletPhase === 'raising_forks' || window.__palletPhase === 'moving_fwd'));
          if (typeof window !== 'undefined') window.__hasPalletOnStack = hasPallet;
          
          const showWhitePallets = currentStep === 3 || currentStep === 4;
          const targetWeight = erpData?.capac_interm_1 || 0;
          const pickedUpCount = (showWhitePallets && window.__hasPalletOnForks) ? Math.max(0, Math.floor(targetWeight / 250)) : 0;
          const remainingCount = Math.max(0, 18 - pickedUpCount);

          return hasPallet && (
            <WoodenPallet position={[0, 0.1 + remainingCount * 0.22, 0]} />
          );
        })()}
      </group>

      {/* ── VALLA NEUMÁTICA (Z=-0.5) ── */}
      <group ref={gateRef} position={[0, 4, -0.5]}>
        {/* Marco exterior (Acortado por abajo, antes bajaba a -1.5, ahora a -0.5) */}
        <StripedBar args={[2.0, 0.1, 0.05]} position={[0, 1.5, 0]} isVertical={false} />
        <StripedBar args={[2.0, 0.1, 0.05]} position={[0, -0.5, 0]} isVertical={false} />
        <StripedBar args={[0.1, 2.0, 0.05]} position={[-0.95, 0.5, 0]} isVertical={true} />
        <StripedBar args={[0.1, 2.0, 0.05]} position={[0.95, 0.5, 0]} isVertical={true} />
        
        {/* Rejilla interior (Fila inferior eliminada) */}
        <StripedBar args={[1.8, 0.05, 0.05]} position={[0, 0.5, 0]} isVertical={false} />
        <StripedBar args={[0.05, 2.0, 0.05]} position={[-0.3, 0.5, 0]} isVertical={true} />
        <StripedBar args={[0.05, 2.0, 0.05]} position={[0.3, 0.5, 0]} isVertical={true} />
        
        {/* Vástagos móviles (más largos y anclados más arriba para compensar el recorte) */}
        <mesh position={[-1.0, -2.1, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 3.2]} />
          <meshStandardMaterial color="#7a8288" />
        </mesh>
        <mesh position={[1.0, -2.1, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 3.2]} />
          <meshStandardMaterial color="#7a8288" />
        </mesh>
      </group>

      {/* ── VALLA NEUMÁTICA FRONTAL (Z=1.3, delante de los pallets) ── */}
      <group ref={frontGateRef} position={[0, 4, 1.3]}>
        {/* Marco exterior (Acortado igual que la trasera) */}
        <StripedBar args={[2.0, 0.1, 0.05]} position={[0, 1.5, 0]} isVertical={false} />
        <StripedBar args={[2.0, 0.1, 0.05]} position={[0, -0.5, 0]} isVertical={false} />
        <StripedBar args={[0.1, 2.0, 0.05]} position={[-0.95, 0.5, 0]} isVertical={true} />
        <StripedBar args={[0.1, 2.0, 0.05]} position={[0.95, 0.5, 0]} isVertical={true} />
        
        {/* Rejilla interior */}
        <StripedBar args={[1.8, 0.05, 0.05]} position={[0, 0.5, 0]} isVertical={false} />
        <StripedBar args={[0.05, 2.0, 0.05]} position={[-0.3, 0.5, 0]} isVertical={true} />
        <StripedBar args={[0.05, 2.0, 0.05]} position={[0.3, 0.5, 0]} isVertical={true} />
        
        {/* Vástagos móviles (apuntan hacia abajo) */}
        <mesh position={[-1.0, -2.1, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 3.2]} />
          <meshStandardMaterial color="#7a8288" />
        </mesh>
        <mesh position={[1.0, -2.1, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 3.2]} />
          <meshStandardMaterial color="#7a8288" />
        </mesh>
      </group>

      {/* ── CILINDROS NEUMÁTICOS FIJOS (VALLA TRASERA Z=-0.5) ── */}
      {/* Montados sobre el suelo/lateral interior, empujando la valla hacia arriba */}
      <mesh position={[-1.0, 1.75, -0.5]}>
        <cylinderGeometry args={[0.06, 0.06, 3.5]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      <mesh position={[1.0, 1.75, -0.5]}>
        <cylinderGeometry args={[0.06, 0.06, 3.5]} />
        <meshStandardMaterial color="#444" />
      </mesh>

      {/* ── CILINDROS NEUMÁTICOS FIJOS (VALLA FRONTAL Z=1.3) ── */}
      <mesh position={[-1.0, 1.75, 1.3]}>
        <cylinderGeometry args={[0.06, 0.06, 3.5]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      <mesh position={[1.0, 1.75, 1.3]}>
        <cylinderGeometry args={[0.06, 0.06, 3.5]} />
        <meshStandardMaterial color="#444" />
      </mesh>

      {/* ── SENSORES LÁSER WENGLOR ── */}
      {/* Láser 1: Apuntando al centro del palet de madera (dinámico) */}
      <WenglorLaser ref={laser1Ref} position={[0, 8.7, 0.75]} beamLength={8.0} />
      {/* Láser 2: Apuntando al centro de la torre de palets base (Z = 2.2) */}
      <WenglorLaser ref={laser2Ref} position={[0, 8.7, 2.2]} beamLength={8.7 - 4.14} />

    </group>
  );
};

const arrowShape = new THREE.Shape();
arrowShape.moveTo(-0.04, -0.02);
arrowShape.lineTo(0.01, -0.02);
arrowShape.lineTo(0.01, -0.04);
arrowShape.lineTo(0.05, 0); // punta
arrowShape.lineTo(0.01, 0.04);
arrowShape.lineTo(0.01, 0.02);
arrowShape.lineTo(-0.04, 0.02);
arrowShape.lineTo(-0.04, -0.02);

const Sticker2D = ({ pointsRight }) => (
  <group scale={[1.5, 1.5, 1.5]}>
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[0.1, 0.1]} />
      <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
    </mesh>
    <group rotation={[0, 0, pointsRight ? 0 : Math.PI]}>
      <mesh position={[0, 0, 0.001]}>
        <shapeGeometry args={[arrowShape]} />
        <meshBasicMaterial color="#ff0000" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, -0.001]}>
        <shapeGeometry args={[arrowShape]} />
        <meshBasicMaterial color="#ff0000" side={THREE.DoubleSide} />
      </mesh>
    </group>
  </group>
);

const ForkliftAssembly = ({ currentStep, erpData, distance, palletState, onPalletAnimComplete, showStickers, zoomToStickers }) => {
  const forkliftRef = useRef();
  const carriageRef = useRef();
  const middleMastRef = useRef();
  const innerMastRef = useRef();
  const beaconRef = useRef();
  
  const animState = useRef({ phase: 'idle', t: 0 });
  const pendingSticker1 = useRef();
  const pendingSticker2 = useRef();

  useFrame((state) => {
    // Parpadeo de las pegatinas cuando están pendientes de colocación (animación)
    const isVisible = Math.sin(state.clock.elapsedTime * 8) > 0;
    if (pendingSticker1.current) pendingSticker1.current.visible = isVisible;
    if (pendingSticker2.current) pendingSticker2.current.visible = isVisible;
  });

  // Sincronizar estados globales para la renderización condicional (un pequeño hack para evitar pasarlo por todo el árbol sin context)
  if (typeof window !== 'undefined') {
    window.__palletState = palletState;
  }

  useEffect(() => {
    if (palletState === 'animating') {
      animState.current = { phase: 'raising_forks', t: 0 };
    } else if (palletState === 'idle') {
      animState.current = { phase: 'idle', t: 0 };
    }
  }, [palletState]);

  useFrame((state, delta) => {
    if (typeof window !== 'undefined') {
      window.__palletPhase = animState.current.phase;
    }

    if (palletState === 'animating' && forkliftRef.current && carriageRef.current) {
      animState.current.t += delta;
      const { phase, t } = animState.current;
      
      // 1) Subir horquillas antes de avanzar (t: 0s a 1.5s)
      if (phase === 'raising_forks') {
        carriageRef.current.position.y = THREE.MathUtils.lerp(carriageRef.current.position.y, 4.01, delta * 4);
        if (t >= 1.5) { animState.current = { phase: 'moving_fwd', t: 0 }; }
      }
      // 2) Avanzar hacia el palet con horquillas elevadas (t: 0s a 1.5s)
      else if (phase === 'moving_fwd') {
        forkliftRef.current.position.z = THREE.MathUtils.lerp(-0.6, 0.85, t / 1.5);
        if (t >= 1.5) { animState.current = { phase: 'grabbing', t: 0 }; }
      }
      // 3) Agarrar (elevar un poco las horquillas y cambiar parent) (t: 0s a 0.5s)
      else if (phase === 'grabbing') {
        carriageRef.current.position.y = THREE.MathUtils.lerp(carriageRef.current.position.y, 4.10, delta * 4);
        if (t >= 0.5) { animState.current = { phase: 'moving_back', t: 0 }; }
      }
      // 4) Retroceder al origen (-0.6) con el palet (t: 0s a 1.5s)
      else if (phase === 'moving_back') {
        forkliftRef.current.position.z = THREE.MathUtils.lerp(0.85, -0.6, t / 1.5);
        if (t >= 1.5) { animState.current = { phase: 'lowering_forks', t: 0 }; }
      }
      // 5) Bajar horquillas a posición de transporte (t: 0s a 1.5s)
      else if (phase === 'lowering_forks') {
        carriageRef.current.position.y = THREE.MathUtils.lerp(carriageRef.current.position.y, 0.5, delta * 4);
        if (t >= 1.5) { 
          animState.current = { phase: 'done', t: 0 };
          if (onPalletAnimComplete) onPalletAnimComplete();
        }
      }
    } else if (carriageRef.current) {
      // Normal PLC operation
      const targetY = THREE.MathUtils.clamp(distance / 1000, 0, 5.0); // Ampliado a 5.0m
      carriageRef.current.position.y = THREE.MathUtils.lerp(carriageRef.current.position.y, targetY, 0.1);
      
      if (forkliftRef.current) {
        forkliftRef.current.position.z = THREE.MathUtils.lerp(forkliftRef.current.position.z, -0.6, 0.1);
      }
    }
    
    // Guardar altura global del carro para que el láser 1 la pueda leer
    if (carriageRef.current && typeof window !== 'undefined') {
      window.__carriageY = carriageRef.current.position.y;
    }
    
    // Animar las pistas del mástil basadas en la altura actual del carro
    if (carriageRef.current) {
      const currentY = carriageRef.current.position.y;
      const maxFreeLift = 1.5; // Cota superior (1.5m)
      
      if (currentY > maxFreeLift) {
        const extraLift = currentY - maxFreeLift;
        if (middleMastRef.current) middleMastRef.current.position.y = extraLift / 2;
        if (innerMastRef.current) innerMastRef.current.position.y = extraLift;
      } else {
        if (middleMastRef.current) middleMastRef.current.position.y = 0;
        if (innerMastRef.current) innerMastRef.current.position.y = 0;
      }
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
    <group ref={forkliftRef} position={[0, 0, -0.6]}>
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

        {/* Outer Mast (Fijo al chasis) */}
        <mesh position={[-0.35, 1.35, 0]}><boxGeometry args={[0.08, 2.5, 0.15]} />{darkMat}</mesh>
        <mesh position={[0.35, 1.35, 0]}><boxGeometry args={[0.08, 2.5, 0.15]} />{darkMat}</mesh>
        <mesh position={[0, 1.0, 0]}><boxGeometry args={[0.7, 0.1, 0.1]} />{darkMat}</mesh>
        <mesh position={[0, 0.2, 0]}><boxGeometry args={[0.7, 0.1, 0.1]} />{darkMat}</mesh>
        
        {/* Base fija de los cilindros hidráulicos (simula la primera etapa telescópica) */}
        <mesh position={[-0.05, 1.3, -0.05]}><cylinderGeometry args={[0.045, 0.045, 2.5]} />{blackMat}</mesh>
        <mesh position={[0.05, 1.3, -0.05]}><cylinderGeometry args={[0.045, 0.045, 2.5]} />{blackMat}</mesh>

        {/* Middle Mast (Pista Intermedia) */}
        <group ref={middleMastRef}>
          <mesh position={[-0.25, 1.35, 0.05]}><boxGeometry args={[0.06, 2.5, 0.1]} />{darkMat}</mesh>
          <mesh position={[0.25, 1.35, 0.05]}><boxGeometry args={[0.06, 2.5, 0.1]} />{darkMat}</mesh>
          <mesh position={[0, 2.5, 0]}><boxGeometry args={[0.6, 0.1, 0.1]} />{darkMat}</mesh>
          {/* Segunda etapa telescópica de los cilindros */}
          <mesh position={[-0.05, 1.3, -0.05]}><cylinderGeometry args={[0.035, 0.035, 2.5]} />{steelMat}</mesh>
          <mesh position={[0.05, 1.3, -0.05]}><cylinderGeometry args={[0.035, 0.035, 2.5]} />{steelMat}</mesh>
        </group>

        {/* ── PEGATINAS: cara trasera del mástil, enfrentadas, fijas a Y=1.5m ── */}
        {/* Pegatina izquierda (rail exterior) — apunta hacia la derecha → */}
        {(showStickers || zoomToStickers) && (
          <group position={[-0.3, 1.5, -0.09]}>
            <group ref={!showStickers && zoomToStickers ? pendingSticker1 : null}>
              <Sticker2D pointsRight={true} />
            </group>
          </group>
        )}
        {/* Pegatina derecha (rail interior) — apunta hacia la izquierda ← */}
        {(showStickers || zoomToStickers) && (
          <group position={[-0.12, 1.5, -0.09]}>
            <group ref={!showStickers && zoomToStickers ? pendingSticker2 : null}>
              <Sticker2D pointsRight={false} />
            </group>
          </group>
        )}

        {/* Inner Mast (Pista Interior) */}
        <group ref={innerMastRef}>
          <mesh position={[-0.15, 1.35, 0.1]}><boxGeometry args={[0.05, 2.5, 0.08]} />{darkMat}</mesh>
          <mesh position={[0.15, 1.35, 0.1]}><boxGeometry args={[0.05, 2.5, 0.08]} />{darkMat}</mesh>
          {/* Barra transversal superior de la pista interior */}
          <mesh position={[0, 2.5, 0.1]}><boxGeometry args={[0.4, 0.1, 0.08]} />{darkMat}</mesh>
          
          {/* Tercera etapa de los cilindros (conectada al carro/pista interior) */}
          <mesh position={[-0.05, 1.3, -0.05]}><cylinderGeometry args={[0.025, 0.025, 2.5]} />{steelMat}</mesh>
          <mesh position={[0.05, 1.3, -0.05]}><cylinderGeometry args={[0.025, 0.025, 2.5]} />{steelMat}</mesh>
          {/* Cadenas de elevación */}
          <mesh position={[-0.1, 1.3, -0.02]}><boxGeometry args={[0.02, 2.5, 0.01]} />{blackMat}</mesh>
          <mesh position={[0.1, 1.3, -0.02]}><boxGeometry args={[0.02, 2.5, 0.01]} />{blackMat}</mesh>
        </group>

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

          {/* Palet de madera (Renderizado sobre las horquillas cuando está recogido o se está retrocediendo/bajando) */}
          {(() => {
            const isPickedUp = palletState === 'picked_up' || (palletState === 'animating' && animState.current.phase !== 'raising_forks' && animState.current.phase !== 'moving_fwd' && animState.current.phase !== 'idle');
            if (typeof window !== 'undefined') window.__hasPalletOnForks = isPickedUp;
            
            const showWhitePallets = currentStep === 3 || currentStep === 4;
            const targetWeight = erpData?.capac_interm_1 || 0;
            const whitePalletCount = showWhitePallets ? Math.max(0, Math.floor(targetWeight / 250)) : 0;
            
            return isPickedUp && (
              <group>
                {Array.from({ length: whitePalletCount }).map((_, i) => (
                  <StackPallet key={i} position={[0, 0.15 + (i * 0.22), 0.6]} weight={(whitePalletCount - i) * 250} />
                ))}
                <WoodenPallet position={[0, 0.05 + (whitePalletCount * 0.22), 0.6]} />
              </group>
            );
          })()}

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

const CameraAnimator = ({ zoomToStickers, zoomOutMultiload, currentStep }) => {
  const isAnimating = useRef(false);
  const targetState = useRef({ zoomToStickers, zoomOutMultiload });
  const { gl } = useThree();

  useEffect(() => {
    isAnimating.current = true;
    window.cancelCameraAnim = false;
    targetState.current = { zoomToStickers, zoomOutMultiload };
    const timeout = setTimeout(() => { isAnimating.current = false; }, 2000);
    return () => clearTimeout(timeout);
  }, [zoomToStickers, zoomOutMultiload, currentStep]);

  useEffect(() => {
    const handleInteract = () => { window.cancelCameraAnim = true; };
    const el = gl.domElement;
    el.addEventListener('pointerdown', handleInteract);
    el.addEventListener('wheel', handleInteract);
    return () => {
      el.removeEventListener('pointerdown', handleInteract);
      el.removeEventListener('wheel', handleInteract);
    };
  }, [gl]);

  useFrame((state, delta) => {
    // Siempre guardar la posición actual para la pestaña Debug en Ajustes
    if (state.controls) {
      window.__cameraPos = { x: state.camera.position.x, y: state.camera.position.y, z: state.camera.position.z };
      window.__cameraTarget = { x: state.controls.target.x, y: state.controls.target.y, z: state.controls.target.z };
    }

    if (window.cancelCameraAnim) isAnimating.current = false;
    if (!isAnimating.current) return;
    if (targetState.current.zoomToStickers && state.controls) {
      // Posición definida manualmente por el operador para encuadrar la pegatina en la etapa Multiload
      state.camera.position.lerp(new THREE.Vector3(0.887, 2.960, -6.594), delta * 2);
      state.controls.target.lerp(new THREE.Vector3(2.415, 2.101, 1.459), delta * 2);
    } else if (targetState.current.zoomOutMultiload && state.controls) {
      // Alejar la cámara para ver la jaula y la carretilla (vista general para etapas 2 a 4)
      state.camera.position.lerp(new THREE.Vector3(9.986, 3.642, 0.957), delta * 2);
      state.controls.target.lerp(new THREE.Vector3(-0.153, 3.121, 3.331), delta * 2);
    }
  });
  return null;
};

const DigitalTwin = ({ currentStep, distance, plcState, palletState, erpData, onPalletAnimComplete, showStickers, zoomToStickers, zoomOutMultiload }) => {
  return (
    <div className="w-full h-full bg-gradient-to-b from-[#1d2930] to-[#0f171e]">
      <Canvas camera={{ position: [4, 3, 5], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        <Environment preset="warehouse" blur={0.8} />
        
        <CageAssembly plcState={plcState} currentStep={currentStep} erpData={erpData} />
        <ForkliftAssembly distance={distance} palletState={palletState} erpData={erpData} currentStep={currentStep} onPalletAnimComplete={onPalletAnimComplete} showStickers={showStickers} zoomToStickers={zoomToStickers} />
        <CameraAnimator zoomToStickers={zoomToStickers} zoomOutMultiload={zoomOutMultiload} currentStep={currentStep} />
        
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
          makeDefault
          target={[0, 2.5, 0]} 
          maxPolarAngle={Math.PI / 2 - 0.05} // Evitar ir por debajo del suelo
          minDistance={3}
          maxDistance={15}
          enableDamping
          onStart={() => { window.cancelCameraAnim = true; }}
        />
      </Canvas>
    </div>
  );
};

export default DigitalTwin;
