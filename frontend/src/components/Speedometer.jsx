import React, { useState, useEffect, useRef } from 'react';
import { Activity } from 'lucide-react';

const Speedometer = ({ telemetry, isSimulation, testHUDOverlay }) => {
  const cameraTestState = testHUDOverlay?.cameraTestState || 'standby';
  const distance = telemetry?.distance ?? 0;
  const prevHeightRef = useRef(distance);
  const prevTimeRef = useRef(performance.now());
  const [speed, setSpeed] = useState(0); // en m/s

  // Tiempos medidos y límites
  const testDist = testHUDOverlay?.testDist || 2.0; // en metros

  // Obtener los valores numéricos raw de los tiempos medidos (en centisegundos)
  const rawElev = testHUDOverlay?._rawElev; // numérico centisegundos
  const rawDesc = testHUDOverlay?._rawDesc; // numérico centisegundos

  // Calcular velocidades medias (AVG) en m/s
  // Si elev/desc está en centisegundos: tiempo en segundos = raw / 100
  // Velocidad media = testDist / (raw / 100) = (testDist * 100) / raw
  const avgElev = rawElev > 0 ? (testDist * 100) / rawElev : null;
  const avgDesc = rawDesc > 0 ? (testDist * 100) / rawDesc : null;

  // Resetear el historial y la velocidad al cambiar de estado de test
  useEffect(() => {
    if (cameraTestState === 'standby' || cameraTestState === 'esperando_1500') {
      setSpeed(0);
    }
  }, [cameraTestState]);

  // Calcular velocidad instantánea
  useEffect(() => {
    // Si no está corriendo el test de movimiento, la velocidad es 0
    const isMoving = ['ascenso', 'descenso'].includes(cameraTestState);
    if (!isMoving) {
      setSpeed(0);
      return;
    }

    const now = performance.now();
    const dt = (now - prevTimeRef.current) / 1000; // en segundos
    const currentHeight = distance; // en mm

    if (dt > 0.04) { // Evitar ruido por muestreo demasiado rápido (mínimo 40ms)
      const dh = currentHeight - prevHeightRef.current; // en mm
      const instantSpeed = (dh / dt) / 1000; // en m/s

      // Filtro básico para descartar picos imposibles (> 4 m/s)
      if (Math.abs(instantSpeed) < 4.0) {
        // Suavizado por media móvil exponencial (EMA)
        setSpeed(prev => {
          return prev * 0.65 + instantSpeed * 0.35;
        });
      }

      prevHeightRef.current = currentHeight;
      prevTimeRef.current = now;
    }
  }, [distance, cameraTestState]);

  // Si la prueba está terminada (ok/nok), mostramos las velocidades medias (avg)
  const isFinished = ['ok', 'nok'].includes(cameraTestState);

  // Parámetros para el arco del velocímetro
  const maxSpeed = 1.5; // escala máxima de 1.5 m/s
  const displaySpeed = Math.min(Math.max(Math.abs(speed), 0), maxSpeed);
  const percentage = displaySpeed / maxSpeed;

  const radius = 46;
  const strokeWidth = 7;
  const circumference = 2 * Math.PI * radius; // ~289.03
  const arcLength = circumference * (240 / 360); // ~192.68
  const strokeDashoffset = arcLength - (percentage * arcLength);

  // Dirección para mostrar en pantalla
  const getDirectionText = () => {
    if (cameraTestState === 'ascenso') return 'SUBIENDO';
    if (cameraTestState === 'descenso') return 'BAJANDO';
    if (cameraTestState === 'espera_arriba') return 'CIMA';
    if (cameraTestState === 'esperando_1500') return 'PREPARANDO';
    return 'STANDBY';
  };

  return (
    <div className="glass-panel p-5 rounded-2xl border border-[#2e404a] shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-[18rem] h-[24.5rem] backdrop-blur-xl flex flex-col items-center justify-between pointer-events-auto relative overflow-hidden group">
      {/* Accent Line */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-logisnext-magenta shadow-[0_0_10px_#dd2876]"></div>

      {/* Header */}
      <div className="w-full flex items-center justify-between border-b border-[#2e404a] pb-3 mb-2">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-logisnext-magenta animate-pulse" />
          <h3 className="text-white text-xs font-black uppercase tracking-widest">VELOCÍMETRO</h3>
        </div>
        <span className="text-[8px] bg-[#1d2930] px-2 py-0.5 rounded border border-[#2e404a] font-bold text-logisnext-slate tracking-widest">
          {getDirectionText()}
        </span>
      </div>

      {/* Gauge & Values */}
      <div className="relative flex items-center justify-center w-full flex-1">
        <svg width="170" height="170" viewBox="0 0 120 120" className="transform">
          <defs>
            <linearGradient id="gaugeGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#5d7a8a" />
              <stop offset="60%" stopColor="#dd2876" />
              <stop offset="100%" stopColor="#ff007f" />
            </linearGradient>
            <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#dd2876" stopOpacity="0.15" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Central Glow */}
          <circle cx="60" cy="60" r="40" fill="url(#glowGrad)" />

          {/* Background Arc */}
          <circle
            cx="60"
            cy="60"
            r="46"
            fill="transparent"
            stroke="#162026"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
            transform="rotate(150 60 60)"
          />

          {/* Active Arc (Speed) */}
          {!isFinished && (
            <circle
              cx="60"
              cy="60"
              r="46"
              fill="transparent"
              stroke="url(#gaugeGrad)"
              strokeWidth={strokeWidth}
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(150 60 60)"
              className="transition-all duration-100 ease-out"
            />
          )}

          {/* Outer Tickmarks for Elegant Aesthetic */}
          <circle
            cx="60"
            cy="60"
            r="53"
            fill="transparent"
            stroke="#2e404a"
            strokeWidth="1"
            strokeDasharray="1 6"
            transform="rotate(150 60 60)"
            className="opacity-40"
          />
        </svg>

        {/* Central Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center mt-2">
          {isFinished ? (
            /* Box in the center when finished showing AVG */
            <div className="flex flex-col items-center justify-center bg-[#0a0f12]/95 border border-[#2e404a] p-3 rounded-xl shadow-lg w-[8.5rem] animate-fade-in">
              <span className="text-[8px] font-black text-logisnext-slate tracking-widest uppercase mb-1">VEL. MEDIAS</span>
              
              {avgElev !== null && (
                <div className="flex justify-between items-center w-full py-0.5 border-b border-[#2e404a]/40">
                  <span className="text-[8px] font-mono text-blue-400 font-bold">AVG ↑:</span>
                  <span className="text-xs font-mono font-black text-white">{avgElev.toFixed(2)} <span className="text-[8px] text-logisnext-slate">m/s</span></span>
                </div>
              )}
              
              {avgDesc !== null && (
                <div className="flex justify-between items-center w-full py-0.5 mt-0.5">
                  <span className="text-[8px] font-mono text-purple-400 font-bold">AVG ↓:</span>
                  <span className="text-xs font-mono font-black text-white">{avgDesc.toFixed(2)} <span className="text-[8px] text-logisnext-slate">m/s</span></span>
                </div>
              )}
            </div>
          ) : (
            /* Real-time speed display */
            <div className="flex flex-col items-center">
              <span className="text-3xl font-black font-mono text-white tracking-tighter drop-shadow-md">
                {Math.abs(speed).toFixed(2)}
              </span>
              <span className="text-[9px] font-black text-logisnext-magenta tracking-widest uppercase -mt-0.5">M/S</span>
              
              {/* Extra telemetry detail inside the gauge */}
              <div className="mt-1 text-[8px] font-mono text-gray-500 bg-[#0a0f12]/50 px-2 py-0.5 rounded border border-[#2e404a]/30">
                {(Math.abs(speed) * 1000).toFixed(0)} mm/s
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer / Min-Max Limits info */}
      <div className="w-full bg-[#0a0f12]/50 p-2.5 rounded-xl border border-[#2e404a]/50 flex justify-around text-center mt-2">
        <div>
          <span className="text-[7px] text-logisnext-slate uppercase tracking-widest block">OBJETIVO ELEV</span>
          <span className="text-xs font-mono font-black text-gray-300">
            {testHUDOverlay?.minElev ? `${(testDist / parseFloat(testHUDOverlay.maxElev.replace('s', ''))).toFixed(2)} - ${(testDist / parseFloat(testHUDOverlay.minElev.replace('s', ''))).toFixed(2)}` : '—'} <span className="text-[7px] text-logisnext-slate">m/s</span>
          </span>
        </div>
        <div className="w-[1px] h-6 bg-[#2e404a]"></div>
        <div>
          <span className="text-[7px] text-logisnext-slate uppercase tracking-widest block">OBJETIVO DESC</span>
          <span className="text-xs font-mono font-black text-gray-300">
            {testHUDOverlay?.minDesc ? `${(testDist / parseFloat(testHUDOverlay.maxDesc.replace('s', ''))).toFixed(2)} - ${(testDist / parseFloat(testHUDOverlay.minDesc.replace('s', ''))).toFixed(2)}` : '—'} <span className="text-[7px] text-logisnext-slate">m/s</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default Speedometer;
