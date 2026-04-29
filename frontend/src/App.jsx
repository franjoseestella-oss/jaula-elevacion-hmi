import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, Play, CheckCircle2, PowerOff } from 'lucide-react';
import Header from './components/Header';
import LeftPanel from './components/LeftPanel';
import DigitalTwin from './components/DigitalTwin';
import Sequencer from './components/Sequencer';
import Footer from './components/Footer';
import TelemetryHUD from './components/TelemetryHUD';
import ErpListModal from './components/ErpListModal';
import SettingsModal from './components/SettingsModal';
import OperatorLoginModal from './components/OperatorLoginModal';
import PlcModal from './components/PlcModal';
import LogViewer from './components/LogViewer';

const API_BASE = 'http://localhost:8001';

function App() {
  const [erpData, setErpData]           = useState(null);
  const [erpModalOpen, setErpModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [plcModalOpen, setPlcModalOpen] = useState(false);
  const [logsOpen, setLogsOpen]         = useState(false);
  const [telemetry, setTelemetry]       = useState({ distance: 0, timer: 0.0, state: 'IDLE' });
  const [networkStatus, setNetworkStatus] = useState({ opc: false, basler: false, db: false, erp: true });
  const [operario, setOperario]         = useState(null);
  const [isSimulation, setIsSimulation] = useState(true);
  const [palletState, setPalletState]   = useState('idle'); // idle | animating | picked_up
  const [simCarriageHeight, setSimCarriageHeight] = useState(0);
  const [step2Overlay, setStep2Overlay] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  
  // Ref para llamar funciones del Sequencer directamente (sin pasar por WebSocket)
  const sequencerRef = useRef(null);

  // ── Cycle Time: empieza al cargar secuencia, se reinicia al finalizar/abortar ──
  const [cycleTimer, setCycleTimer] = useState(0);
  const cycleStartRef = useRef(null);
  const cycleIntervalRef = useRef(null);

  const startCycleTimer = () => {
    cycleStartRef.current = Date.now();
    if (cycleIntervalRef.current) clearInterval(cycleIntervalRef.current);
    cycleIntervalRef.current = setInterval(() => {
      setCycleTimer(((Date.now() - cycleStartRef.current) / 1000));
    }, 100);
  };

  const resetCycleTimer = () => {
    if (cycleIntervalRef.current) clearInterval(cycleIntervalRef.current);
    cycleIntervalRef.current = null;
    cycleStartRef.current = null;
    setCycleTimer(0);
  };

  // Arrancar timer cuando se carga erpData, parar cuando se limpia
  useEffect(() => {
    if (erpData) {
      startCycleTimer();
    } else {
      resetCycleTimer();
    }
    return () => {
      if (!erpData && cycleIntervalRef.current) clearInterval(cycleIntervalRef.current);
    };
  }, [erpData]);


  // Cargar datos completos de un bastidor seleccionado (desde el modal o ErpSearch)
  const handleBastidorSelect = useCallback(async (bastidor) => {
    try {
      const res = await fetch(`${API_BASE}/erp/bastidor/${encodeURIComponent(bastidor)}`);
      if (res.ok) {
        const data = await res.json();
        setErpData(data);
      }
    } catch (err) {
      console.error('Error cargando bastidor:', err);
    }
  }, []);

  // Enviar comando al PLC para activar un bit de simulacion, esperar 800ms y desactivarlo
  const pulsePlc = async (varName) => {
    // Llamada directa al Sequencer (sin latencia de WebSocket)
    if (varName === 'Ob_Inciar_Secuencia' && sequencerRef.current?.onIniciarSecuencia) {
      sequencerRef.current.onIniciarSecuencia();
    }
    if (varName === 'Ob_Pegatina_Colocada' && sequencerRef.current?.onPegatina) {
      sequencerRef.current.onPegatina();
    }
    if (varName === 'Ob_Abortar_Secuancia' && sequencerRef.current?.onAbortar) {
      sequencerRef.current.onAbortar();
    }
    // También enviamos al backend por si hay PLC real
    try {
      await fetch('http://localhost:8001/plc/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [varName]: true })
      });
      setTimeout(async () => {
        await fetch('http://localhost:8001/plc/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [varName]: false })
        });
      }, 800);
    } catch (err) {
      console.error(`Error pulsando ${varName}:`, err);
    }
  };

  // ── Polling estado BD (cada 10 s) ──────────────────────────────────────────
  useEffect(() => {
    const checkDb = async () => {
      try {
        const res  = await fetch(`${API_BASE}/health/db`);
        const data = await res.json();
        setNetworkStatus(prev => ({ ...prev, db: data.connected === true }));
      } catch {
        setNetworkStatus(prev => ({ ...prev, db: false }));
      }
    };
    checkDb();                              // comprobación inmediata al arrancar
    const interval = setInterval(checkDb, 10_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8001/ws');
    ws.onopen = () => setNetworkStatus(prev => ({ ...prev, opc: true, basler: true }));
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'telemetry') {
        setTelemetry({ 
          distance: data.distance, 
          timer: data.timer, 
          state: data.state,
          plc: data.plc || {} 
        });
      }
    };
    ws.onclose = () => setNetworkStatus(prev => ({ ...prev, opc: false, basler: false }));
    return () => ws.close();
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-logisnext-darkslate text-white overflow-hidden font-primary">
      <Header
        status={networkStatus}
        onErpClick={() => setErpModalOpen(true)}
        onSettingsClick={() => setSettingsOpen(true)}
        onLogsClick={() => setLogsOpen(true)}
        onPlcClick={() => setPlcModalOpen(true)}
        operario={operario}
        canChangeOperator={!erpData}
        onOperatorClick={() => setOperario(null)}
      />

      <div className="flex-1 flex flex-row overflow-hidden">
        <LeftPanel data={erpData} onErpData={handleBastidorSelect} />

        <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden scanlines">
          {/* OVERLAY DATOS MULTILOAD (ETAPA 2) */}
          {step2Overlay && step2Overlay.active && (
            <div className={`absolute top-10 left-10 z-50 px-8 py-6 rounded-2xl border-4 backdrop-blur-md shadow-2xl transition-colors duration-300 ${
              step2Overlay.isOk 
                ? 'bg-green-600/90 border-green-500 shadow-[0_0_50px_rgba(34,197,94,0.6)]' 
                : 'bg-[#0a0f12]/90 border-[#2e404a] shadow-[0_0_30px_rgba(0,0,0,0.8)]'
            }`}>
              <div className="flex flex-col items-start gap-4">
                {step2Overlay.isOk ? <CheckCircle2 size={64} className="text-white drop-shadow-lg" /> : <AlertTriangle size={64} className="text-blue-400 drop-shadow-lg" />}
                <div className="flex flex-col gap-2">
                  <span className="text-3xl font-black tracking-widest text-white drop-shadow-md">
                    ALTURA ACTUAL: <span className={step2Overlay.isOk ? "text-white" : "text-blue-400"}>{step2Overlay.actual} mm</span>
                  </span>
                  <div className="flex gap-4 items-center">
                    <span className="text-lg font-bold tracking-widest text-gray-300">OBJETIVO:</span>
                    <span className="text-xl font-black text-gray-200 bg-black/30 px-3 py-1 rounded">
                      {step2Overlay.min} mm <span className="text-gray-400 mx-1">—</span> {step2Overlay.max} mm
                    </span>
                  </div>
                  {step2Overlay.isOk && (
                    <span className="text-xl font-black tracking-widest text-green-200 mt-2 border-t border-green-500/50 pt-2">
                      CARRETILLA EN POSICIÓN. PUEDE COLOCAR PEGATINA.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* BANNER GIGANTE DE SEGURIDAD */}
          {erpData && (currentStep === 3 || currentStep === 4) && (!telemetry.plc?.Ob_Dtec_Valla_1_trabajo_LH || !telemetry.plc?.Ob_Dtec_Valla_2_trabajo_RH) && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 z-50 bg-red-600/90 border-4 border-red-500 text-white px-8 py-4 rounded-xl shadow-[0_0_50px_rgba(220,38,38,0.8)] flex items-center gap-6 backdrop-blur-md">
              <AlertTriangle size={56} className="text-white drop-shadow-lg" />
              <div className="flex flex-col">
                <span className="text-4xl font-black tracking-[0.2em] drop-shadow-md">VALLAS NO EN POSICIÓN</span>
                <span className="text-sm font-bold tracking-widest text-red-100 drop-shadow">PELIGRO: LA JAULA NO ES SEGURA</span>
              </div>
            </div>
          )}

          <TelemetryHUD telemetry={telemetry} cycleTimer={cycleTimer} />
          <DigitalTwin 
            distance={telemetry.distance} 
            plcState={telemetry.plc} 
            palletState={palletState} 
            onPalletAnimComplete={() => setPalletState('picked_up')} 
            showStickers={telemetry.plc?.Ob_Pegatina_Colocada || currentStep > 1}
            zoomToStickers={currentStep === 1 && step2Overlay?.isOk && !telemetry.plc?.Ob_Pegatina_Colocada}
          />



          {/* Slider flotante para el movimiento del carro (Solo Simulación) */}
          {isSimulation && (
            <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 bg-[#0a0f12]/80 backdrop-blur-md p-4 rounded-full border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.15)] z-20">
              <span className="text-blue-400 text-xs font-black uppercase tracking-widest bg-blue-500/10 px-2 py-1 rounded">8.7m</span>
              <input 
                type="range" 
                min="0" 
                max="8700" 
                step="10"
                value={simCarriageHeight}
                onChange={async (e) => {
                  const val = parseFloat(e.target.value);
                  setSimCarriageHeight(val);
                  
                  // Lógica física simulada: Si no hay pallet en horquillas, el láser Wenglor principal lee el suelo (0). 
                  // Si hay pallet, lee la distancia al pallet (altura del carro + grosor del pallet).
                  const isPickedUp = palletState === 'picked_up' || (palletState === 'animating' && window.__animPhase !== 'idle');
                  const laserValue = isPickedUp ? val + 185 : 0;
                  
                  // Guardamos variable virtual para que el DigitalTwin renderice bien el carro en simulación
                  if (typeof window !== 'undefined') {
                    window.__simCarriageHeight = val;
                  }

                  try {
                    await fetch('http://localhost:8001/plc/write', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ OW_Altura_Elevacion: laserValue })
                    });
                  } catch (err) { console.error("Error escribiendo altura PLC", err); }
                }}
                className="w-2 h-64 appearance-none bg-[#1d2930] rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(59,130,246,0.8)] cursor-pointer"
                style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' }}
              />
              <span className="text-blue-400 text-xs font-black uppercase tracking-widest bg-blue-500/10 px-2 py-1 rounded">0m</span>
            </div>
          )}

          {/* Botonera de pulsadores simulada (Solo Simulación) */}
          {isSimulation && (
            <div className="absolute left-6 bottom-6 flex gap-3 bg-[#0a0f12]/90 backdrop-blur-md p-4 rounded-xl border border-gray-800 shadow-2xl z-20">
              <div className="flex flex-col items-center">
                <button
                  onClick={() => pulsePlc('Ob_Inciar_Secuencia')}
                  className="w-14 h-14 rounded-full bg-gradient-to-b from-green-500 to-green-700 active:from-green-700 active:to-green-900 border-4 border-[#1d2930] shadow-[0_4px_10px_rgba(34,197,94,0.3)] flex items-center justify-center transition-all active:scale-95 active:shadow-inner"
                >
                  <Play size={20} className="text-white ml-1" />
                </button>
                <span className="mt-2 text-[9px] font-black uppercase text-gray-400 tracking-wider">Iniciar<br/>Secuencia</span>
              </div>
              
              <div className="flex flex-col items-center">
                <button
                  onClick={() => pulsePlc('Ob_Pegatina_Colocada')}
                  className="w-14 h-14 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 active:from-blue-700 active:to-blue-900 border-4 border-[#1d2930] shadow-[0_4px_10px_rgba(59,130,246,0.3)] flex items-center justify-center transition-all active:scale-95 active:shadow-inner"
                >
                  <CheckCircle2 size={24} className="text-white" />
                </button>
                <span className="mt-2 text-[9px] font-black uppercase text-gray-400 tracking-wider text-center">Pegatina<br/>Colocada</span>
              </div>

              <div className="flex flex-col items-center">
                <button
                  onClick={() => pulsePlc('Ob_Abortar_Secuancia')}
                  className="w-14 h-14 rounded-full bg-gradient-to-b from-red-500 to-red-700 active:from-red-700 active:to-red-900 border-4 border-[#1d2930] shadow-[0_4px_10px_rgba(239,68,68,0.3)] flex items-center justify-center transition-all active:scale-95 active:shadow-inner"
                >
                  <PowerOff size={20} className="text-white" />
                </button>
                <span className="mt-2 text-[9px] font-black uppercase text-gray-400 tracking-wider">Abortar<br/>Secuencia</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="w-96 border-l border-[#2e404a] bg-[#0a0f12] flex flex-col z-30 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
          <Sequencer 
            erpData={erpData} 
            telemetry={telemetry}
            palletState={palletState}
            setPalletState={setPalletState}
            onStepChange={setCurrentStep}
            operario={operario}
            sequencerRef={sequencerRef}
            onErpData={setErpData} 
            onOpenErp={() => setErpModalOpen(true)} 
            plcState={telemetry?.plc}
            setStep2Overlay={setStep2Overlay}
            onSequenceEnd={resetCycleTimer}
          />
        </div>
      </div>

      <Footer />

      {/* Modal ERP — se abre al pulsar el LED "ERP" del header */}
      <ErpListModal
        open={erpModalOpen}
        onClose={() => setErpModalOpen(false)}
        onSelect={handleBastidorSelect}
      />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} telemetry={telemetry} />
      
      <PlcModal 
        open={plcModalOpen} 
        onClose={() => setPlcModalOpen(false)} 
        telemetry={telemetry} 
        isSimulation={isSimulation}
        setIsSimulation={setIsSimulation}
        pulsePlc={pulsePlc}
      />

      {/* Identificación de operario al inicio */}
      {!operario && <OperatorLoginModal onLogin={setOperario} />}
      
      <LogViewer isOpen={logsOpen} onClose={() => setLogsOpen(false)} />
    </div>
  );
}

export default App;
