import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, Play, CheckCircle2, PowerOff, Camera, X } from 'lucide-react';
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
  const [isSimulation, setIsSimulation] = useState(() => {
    const saved = localStorage.getItem('isSimulation');
    return saved !== null ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('isSimulation', JSON.stringify(isSimulation));
  }, [isSimulation]);
  const [palletState, setPalletState]   = useState('idle'); // idle | animating | picked_up
  const [simCarriageHeight, setSimCarriageHeight] = useState(0);
  const [step2Overlay, setStep2Overlay] = useState(null);
  const [testHUDOverlay, setTestHUDOverlay] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);

  const [alarms, setAlarms] = useState([]);
  const [showAlarms, setShowAlarms] = useState(false);
  const [hasUnreadAlarms, setHasUnreadAlarms] = useState(false);
  
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

  // ── Auto-connect to PLC on startup if a saved config exists ──
  useEffect(() => {
    const savedConfigStr = localStorage.getItem('plcConfig');
    if (savedConfigStr) {
      try {
        const savedConfig = JSON.parse(savedConfigStr);
        // Only send connect request if we are in PLC mode
        const savedSim = localStorage.getItem('isSimulation');
        const isSim = savedSim !== null ? JSON.parse(savedSim) : false;
        
        fetch('http://localhost:8001/config/plc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...savedConfig,
            isSimulation: isSim
          })
        }).catch(e => console.error("Error auto-connecting to PLC:", e));
      } catch(e) {}
    }
  }, []);

  // Track alarms
  useEffect(() => {
    let newAlarmDesc = null;
    if (telemetry?.opcua_error && telemetry?.opcua_error !== "None") {
       newAlarmDesc = 'Error conexión OPC UA: ' + telemetry.opcua_error;
    }
    if (telemetry?.plc?.Ob_Abortar_Secuencia) {
       newAlarmDesc = 'Secuencia abortada por PLC';
    }
    
    if (newAlarmDesc) {
      setAlarms(prev => {
         if (prev.length > 0 && prev[0].description === newAlarmDesc && (Date.now() - prev[0].id) < 5000) return prev;
         setHasUnreadAlarms(true);
         return [{ id: Date.now(), timestamp: new Date().toLocaleString(), description: newAlarmDesc }, ...prev].slice(0, 50);
      });
    }
  }, [telemetry?.opcua_error, telemetry?.plc?.Ob_Abortar_Secuencia]);


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
    if (varName === 'Ob_Iniciar_Secuencia' && sequencerRef.current?.onIniciarSecuencia) {
      sequencerRef.current.onIniciarSecuencia();
    }
    if (varName === 'Ob_Poner_Pegatina' && sequencerRef.current?.onPegatina) {
      sequencerRef.current.onPegatina();
    }
    if (varName === 'Ob_Abortar_Secuencia' && sequencerRef.current?.onAbortar) {
      sequencerRef.current.onAbortar();
    }

    let targetVar = varName;
    
    if (!isSimulation) {
      const mappingStr = localStorage.getItem('plcVarMapping');
      if (mappingStr) {
         try {
            const mapping = JSON.parse(mappingStr);
            const found = Object.entries(mapping).find(([k, v]) => v.appVar === varName);
            if (found) {
                targetVar = found[0];
            } else {
                console.log(`[pulsePlc] ${varName} no está mapeada al PLC. Ignorando.`);
                return;
            }
         } catch(e) {}
      } else {
         return;
      }
    }

    try {
      await fetch('http://localhost:8001/plc/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [targetVar]: true })
      });
      setTimeout(async () => {
        await fetch('http://localhost:8001/plc/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [targetVar]: false })
        });
      }, 800);
    } catch (err) {
      console.error(`Error pulsando ${targetVar}:`, err);
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
        const mappingStr = localStorage.getItem('plcVarMapping');
        let mappedPlc = {};
        if (mappingStr && data.plc) {
           try {
              const mapping = JSON.parse(mappingStr);
              Object.entries(mapping).forEach(([plcKey, mapData]) => {
                  if (mapData.appVar && data.plc[plcKey] !== undefined) {
                      mappedPlc[mapData.appVar] = data.plc[plcKey];
                  }
              });
           } catch(e) {}
        }

        setTelemetry({ 
          distance: data.distance, 
          timer: data.timer, 
          state: data.state,
          plc: data.plc || {},
          mappedPlc: mappedPlc,
          opcua_connected: data.opcua_connected,
          opcua_error: data.opcua_error
        });
      }
    };
    ws.onclose = () => setNetworkStatus(prev => ({ ...prev, opc: false, basler: false }));
    return () => ws.close();
  }, []);

  const appPlc = isSimulation ? (telemetry?.plc || {}) : (telemetry?.mappedPlc || {});

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
        hasAlarms={alarms.length > 0}
        onAlarmsClick={() => { setShowAlarms(true); setHasUnreadAlarms(false); }}
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

          {/* ALARMS ICON */}
          {hasUnreadAlarms && (
            <button 
              onClick={() => { setShowAlarms(true); setHasUnreadAlarms(false); }}
              className="absolute top-20 right-6 z-50 bg-red-600/90 border border-red-500 text-white p-3 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.8)] animate-pulse"
            >
              <AlertTriangle size={24} />
            </button>
          )}

          {/* ALARMS MODAL (FLOATING PANEL) */}
          {showAlarms && (
            <div className="absolute top-32 right-6 z-50 w-[600px] bg-[#0a0f12]/95 border border-red-500/50 rounded-2xl shadow-[0_0_40px_rgba(220,38,38,0.3)] backdrop-blur-md overflow-hidden flex flex-col max-h-[80vh] animate-in slide-in-from-right-8 duration-300">
              <div className="bg-red-600/20 border-b border-red-500/30 p-5 flex justify-between items-center shrink-0">
                 <div className="flex items-center gap-3">
                    <AlertTriangle size={24} className="text-red-500" />
                    <span className="text-base font-black text-red-500 uppercase tracking-widest drop-shadow-md">Log de Alarmas</span>
                 </div>
                 <button onClick={() => setShowAlarms(false)} className="text-gray-400 hover:text-white bg-[#1d2930] p-2 rounded-lg hover:bg-red-600 transition-colors"><X size={20}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
                {alarms.length === 0 ? (
                   <span className="text-sm text-gray-500 italic text-center py-10">No hay alarmas registradas.</span>
                ) : [...alarms].reverse().map(a => (
                   <div key={a.id} className="bg-[#1d2930]/80 p-4 rounded-xl border border-red-500/30 flex flex-col gap-2 shadow-sm hover:border-red-500/60 transition-colors">
                     <span className="text-xs text-gray-400 font-mono bg-black/40 self-start px-2 py-1 rounded">{a.timestamp}</span>
                     <span className="text-sm font-bold text-white tracking-wide">{a.description}</span>
                   </div>
                ))}
              </div>
            </div>
          )}

          {/* BANNER GIGANTE DE SEGURIDAD */}
          {erpData && (currentStep === 3 || currentStep === 4) && (!appPlc?.Ob_Dtec_Valla_1_trabajo_LH || !appPlc?.Ob_Dtec_Valla_2_trabajo_RH) && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 z-50 bg-red-600/90 border-4 border-red-500 text-white px-8 py-4 rounded-xl shadow-[0_0_50px_rgba(220,38,38,0.8)] flex items-center gap-6 backdrop-blur-md">
              <AlertTriangle size={56} className="text-white drop-shadow-lg" />
              <div className="flex flex-col">
                <span className="text-4xl font-black tracking-[0.2em] drop-shadow-md">VALLAS NO EN POSICIÓN</span>
                <span className="text-sm font-bold tracking-widest text-red-100 drop-shadow">PELIGRO: LA JAULA NO ES SEGURA</span>
              </div>
            </div>
          )}

          {/* BANNER GIGANTE DE CARGA (Para Test con Carga) */}
          {erpData && (currentStep === 3 || currentStep === 4) && (
            <div className={`absolute top-10 right-10 z-50 px-6 py-4 rounded-2xl border-2 backdrop-blur-md shadow-2xl flex flex-col gap-3 ${
              (appPlc?.OW_Numero_Pallets || 0) * 250 === erpData.capac_interm_1
                ? 'bg-green-600/80 border-green-400' 
                : 'bg-[#0a0f12]/90 border-logisnext-magenta'
            }`}>
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-300 border-b border-white/20 pb-2">Control de Carga</h3>
              <div className="flex justify-between items-center gap-8">
                <span className="text-sm font-bold text-gray-400 tracking-wider">CARGA REQUERIDA (ERP)</span>
                <span className="text-xl font-black text-logisnext-magenta">{erpData.capac_interm_1 || 0} kg</span>
              </div>
              <div className="flex justify-between items-end gap-8">
                <span className="text-sm font-bold text-gray-400 tracking-wider">CARGA ACTUAL (PLC)</span>
                <div className="flex flex-col items-end">
                  <span className="text-2xl font-black text-white">{(appPlc?.OW_Numero_Pallets || 0) * 250} kg</span>
                  <span className="text-[10px] text-gray-400">({appPlc?.OW_Numero_Pallets || 0} pallets × 250kg)</span>
                </div>
              </div>
            </div>
          )}

          {/* OVERLAY DE COMPARATIVA DE TIEMPOS Y CÁMARA (Para pasos 3 y 4) */}
          {testHUDOverlay && (
            <div className="absolute top-1/2 left-10 -translate-y-1/2 z-40 flex flex-col gap-3">
              <div className="glass-panel p-5 rounded-2xl border border-[#2e404a] shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-[22rem] backdrop-blur-xl">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4 border-b border-[#2e404a] pb-3">
                  <div className="bg-logisnext-magenta/20 p-2 rounded-lg">
                    <Camera size={22} className="text-logisnext-magenta" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white uppercase tracking-wider">{testHUDOverlay.title}</h2>
                    <p className="text-[10px] text-logisnext-slate uppercase tracking-widest">{testHUDOverlay.subtitle}</p>
                  </div>
                </div>

                {/* Estado prueba */}
                <div className="flex items-center justify-between bg-[#0a0f12] px-3 py-2 rounded-lg border border-[#2e404a] mb-3">
                  <span className="text-[10px] text-logisnext-slate font-bold uppercase tracking-widest">Estado Prueba</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-300 font-mono font-bold">
                      {testHUDOverlay.cameraTestState === 'standby' && 'ESPERANDO...'}
                      {testHUDOverlay.cameraTestState === 'esperando_1500' && 'ESPERA 1500 mm ↑'}
                      {testHUDOverlay.cameraTestState === 'ascenso' && 'ASCENSO ACTIVO'}
                      {testHUDOverlay.cameraTestState === 'espera_arriba' && 'ESPERA ARRIBA'}
                      {testHUDOverlay.cameraTestState === 'descenso' && 'DESCENSO ACTIVO'}
                      {testHUDOverlay.cameraTestState === 'ok' && 'PRUEBA OK ✓'}
                      {testHUDOverlay.cameraTestState === 'nok' && 'PRUEBA NOK ✗'}
                    </span>
                    <div className={`w-3.5 h-3.5 rounded-full border-2 ${
                      testHUDOverlay.ledState === 'active' ? 'bg-green-400 border-green-200 animate-pulse shadow-[0_0_8px_#4ade80]' :
                      testHUDOverlay.ledState === 'ok' ? 'bg-green-500 border-green-300 shadow-[0_0_10px_#22c55e]' :
                      testHUDOverlay.ledState === 'nok' ? 'bg-red-500 border-red-300 shadow-[0_0_10px_#ef4444]' :
                      'bg-red-600 border-red-400 animate-pulse shadow-[0_0_8px_#dc2626]'
                    }`} />
                  </div>
                </div>

                {/* Nota compacta cuando está en espera_arriba (el contador grande cubre la vista) */}
                {testHUDOverlay.cameraTestState === 'espera_arriba' && (
                  <div className="mb-3 flex items-center justify-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl py-2 px-3">
                    <span className="text-yellow-400 text-xs font-black uppercase tracking-widest animate-pulse">⟱ ESPERA PARA DESCENDER</span>
                  </div>
                )}

                {/* Bloques de tiempo */}
                <div className="flex flex-col gap-2">
                  {/* Ascenso */}
                  {(() => {
                    const elevVal = testHUDOverlay.realElev;
                    const rawElev = testHUDOverlay._rawElev;
                    const inRange = rawElev != null && testHUDOverlay._minElev != null
                      ? rawElev >= testHUDOverlay._minElev && rawElev <= testHUDOverlay._maxElev : null;
                    const isActive = testHUDOverlay.cameraTestState === 'ascenso';
                    return (
                      <div className={`p-3 rounded-xl border relative overflow-hidden transition-all ${
                        inRange === true ? 'bg-green-900/20 border-green-500/50' :
                        inRange === false ? 'bg-red-900/20 border-red-500/50' :
                        isActive ? 'bg-blue-900/20 border-blue-500/40' : 'bg-[#1d2930]/60 border-[#2e404a]'
                      }`}>
                        <div className={`absolute top-0 left-0 w-1 h-full ${
                          inRange === true ? 'bg-green-500' : inRange === false ? 'bg-red-500' :
                          isActive ? 'bg-blue-400' : 'bg-blue-600/40'
                        }`} />
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-[10px] text-logisnext-slate uppercase tracking-widest">↑ Ascenso</span>
                          {isActive && <span className="text-[9px] text-blue-400 font-bold animate-pulse">● MIDIENDO</span>}
                        </div>
                        <span className={`text-4xl font-mono font-black leading-none ${
                          inRange === true ? 'text-green-400' : inRange === false ? 'text-red-400' :
                          isActive ? 'text-blue-300' : 'text-gray-300'
                        }`}>{elevVal ?? '—'}</span>
                        <div className="mt-2 pt-2 border-t border-[#2e404a]/60 flex items-center gap-2">
                          <span className="text-[10px] text-logisnext-slate font-bold">ERP:</span>
                          <span className="text-sm font-mono font-bold text-gray-300">
                            {testHUDOverlay.minElev ?? '—'} — {testHUDOverlay.maxElev ?? '—'}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                  {/* Descenso */}
                  {(() => {
                    const descVal = testHUDOverlay.realDesc;
                    const rawDesc = testHUDOverlay._rawDesc;
                    const inRange = rawDesc != null && testHUDOverlay._minDesc != null
                      ? rawDesc >= testHUDOverlay._minDesc && rawDesc <= testHUDOverlay._maxDesc : null;
                    const isActive = testHUDOverlay.cameraTestState === 'descenso';
                    return (
                      <div className={`p-3 rounded-xl border relative overflow-hidden transition-all ${
                        inRange === true ? 'bg-green-900/20 border-green-500/50' :
                        inRange === false ? 'bg-red-900/20 border-red-500/50' :
                        isActive ? 'bg-purple-900/20 border-purple-500/40' : 'bg-[#1d2930]/60 border-[#2e404a]'
                      }`}>
                        <div className={`absolute top-0 left-0 w-1 h-full ${
                          inRange === true ? 'bg-green-500' : inRange === false ? 'bg-red-500' :
                          isActive ? 'bg-purple-400' : 'bg-purple-600/40'
                        }`} />
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-[10px] text-logisnext-slate uppercase tracking-widest">↓ Descenso</span>
                          {isActive && <span className="text-[9px] text-purple-400 font-bold animate-pulse">● MIDIENDO</span>}
                        </div>
                        <span className={`text-4xl font-mono font-black leading-none ${
                          inRange === true ? 'text-green-400' : inRange === false ? 'text-red-400' :
                          isActive ? 'text-purple-300' : 'text-gray-300'
                        }`}>{descVal ?? '—'}</span>
                        <div className="mt-2 pt-2 border-t border-[#2e404a]/60 flex items-center gap-2">
                          <span className="text-[10px] text-logisnext-slate font-bold">ERP:</span>
                          <span className="text-sm font-mono font-bold text-gray-300">
                            {testHUDOverlay.minDesc ?? '—'} — {testHUDOverlay.maxDesc ?? '—'}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* ── CUENTA ATRÁS GRANDE — centrada en la vista 3D ── */}
          {testHUDOverlay?.cameraTestState === 'espera_arriba' && testHUDOverlay?.waitCountdown != null && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none">
              <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
              <div className="relative flex flex-col items-center gap-2">
                {testHUDOverlay.waitCountdown > 0 ? (
                  <>
                    <span className="text-yellow-300 text-base font-black uppercase tracking-[0.3em] drop-shadow-[0_0_20px_rgba(250,204,21,0.9)]">
                      INICIO DESCENSO EN
                    </span>
                    <span
                      className="font-black font-mono text-yellow-300 leading-none select-none"
                      style={{
                        fontSize: 'clamp(8rem, 22vw, 18rem)',
                        textShadow: '0 0 80px rgba(250,204,21,0.9), 0 0 160px rgba(250,204,21,0.5)',
                        animation: testHUDOverlay.waitCountdown <= 1 ? 'pulse 0.3s ease-in-out infinite' : 'pulse 0.8s ease-in-out infinite'
                      }}
                    >
                      {testHUDOverlay.waitCountdown}
                    </span>
                    <span className="text-yellow-400 text-sm font-bold uppercase tracking-[0.4em] drop-shadow-[0_0_10px_rgba(250,204,21,0.7)]">
                      {testHUDOverlay.waitCountdown === 1 ? 'segundo' : 'segundos'}
                    </span>
                  </>
                ) : (
                  <>
                    <span
                      className="font-black font-mono text-green-400 leading-none select-none animate-pulse"
                      style={{
                        fontSize: 'clamp(6rem, 18vw, 14rem)',
                        textShadow: '0 0 60px rgba(74,222,128,0.95), 0 0 120px rgba(74,222,128,0.5)'
                      }}
                    >
                      GO!
                    </span>
                    <span
                      className="text-green-400 font-black animate-bounce select-none"
                      style={{
                        fontSize: 'clamp(4rem, 12vw, 9rem)',
                        textShadow: '0 0 40px rgba(74,222,128,0.9)'
                      }}
                    >
                      ↓
                    </span>
                    <span className="text-green-300 text-base font-black uppercase tracking-[0.4em] animate-pulse drop-shadow-[0_0_15px_rgba(74,222,128,0.8)]">
                      INICIAR DESCENSO
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── MODAL NOK — ¿Repetir la prueba? ── */}
          {testHUDOverlay?.cameraTestState === 'nok' && (() => {
            const alarm = testHUDOverlay?.testAlarm;
            const isIncomplete = alarm === 'ascenso_incompleto' || alarm === 'descenso_incompleto';
            const isAscIncomplete = alarm === 'ascenso_incompleto';
            const isLoadError = typeof alarm === 'string' && alarm.startsWith('Carga incorrecta');

            return (
              <div className="absolute inset-0 z-50 flex items-center justify-center">
                {/* Backdrop: pointer-events-none para no bloquear los botones de simulación */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px] pointer-events-none" />
                {/* Dialog */}
                <div className={`relative flex flex-col items-center gap-6 bg-[#0d1a20] border-2 rounded-3xl px-14 py-10 max-w-lg w-full mx-8 ${
                  isIncomplete
                    ? 'border-orange-500/70 shadow-[0_0_80px_rgba(249,115,22,0.4)]'
                    : 'border-red-500/70 shadow-[0_0_80px_rgba(239,68,68,0.4)]'
                }`}>
                  {/* Icono */}
                  <div className={`flex items-center justify-center w-20 h-20 rounded-full border-2 ${
                    isIncomplete
                      ? 'bg-orange-500/20 border-orange-500/50 shadow-[0_0_30px_rgba(249,115,22,0.4)]'
                      : 'bg-red-500/20 border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.4)]'
                  }`}>
                    <span className="text-4xl">{isIncomplete ? '⚠' : '✕'}</span>
                  </div>

                  {/* Título */}
                  <div className="flex flex-col items-center gap-2 text-center">
                    {isLoadError ? (
                      <>
                        <span className="text-red-400 text-sm font-black uppercase tracking-[0.25em]">
                          CARGA O COTA INCORRECTA
                        </span>
                        <h2 className="text-white text-3xl font-black tracking-wide">
                          Condiciones no cumplidas
                        </h2>
                        <p className="text-gray-400 text-sm font-medium">
                          La carga no corresponde con lo que propone el ERP. Revise los pallets de hierro y madera.
                        </p>
                        <div className="mt-2 flex items-center gap-3 px-6 py-3 rounded-xl border bg-red-900/20 border-red-500/40">
                          <span className="text-red-300 text-3xl font-black">⚖️</span>
                          <div className="text-left">
                            <div className="text-red-300 font-black text-sm uppercase tracking-widest">
                              VALIDACIÓN DE CARGA
                            </div>
                            <div className="text-gray-400 text-xs">
                              {alarm}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : isIncomplete ? (
                      <>
                        <span className="text-orange-400 text-sm font-black uppercase tracking-[0.25em]">
                          MOVIMIENTO INCOMPLETO
                        </span>
                        <h2 className="text-white text-3xl font-black tracking-wide">
                          {isAscIncomplete ? 'Ascenso Incompleto' : 'Descenso Incompleto'}
                        </h2>
                        <p className="text-gray-400 text-sm font-medium">
                          {isAscIncomplete
                            ? 'La carretilla no alcanzó la altura máxima requerida. La prueba ha sido cancelada.'
                            : 'La carretilla no completó el descenso hasta la posición inicial. La prueba ha sido cancelada.'}
                        </p>
                        {/* Indicador visual del movimiento fallido */}
                        <div className={`mt-2 flex items-center gap-3 px-6 py-3 rounded-xl border ${
                          isAscIncomplete
                            ? 'bg-orange-900/20 border-orange-500/40'
                            : 'bg-orange-900/20 border-orange-500/40'
                        }`}>
                          <span className="text-orange-300 text-3xl font-black">
                            {isAscIncomplete ? '↑' : '↓'}
                          </span>
                          <div className="text-left">
                            <div className="text-orange-300 font-black text-sm uppercase tracking-widest">
                              {isAscIncomplete ? 'ASCENSO' : 'DESCENSO'}
                            </div>
                            <div className="text-gray-400 text-xs">
                              Detenido sin completar el recorrido (timeout 2s)
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-red-400 text-sm font-black uppercase tracking-[0.25em]">RESULTADO FUERA DE TOLERANCIA</span>
                        <h2 className="text-white text-3xl font-black tracking-wide">¿Repetir la prueba?</h2>
                        <p className="text-gray-400 text-sm font-medium">Los tiempos registrados no cumplen las tolerancias del ERP.</p>
                      </>
                    )}
                  </div>

                  {/* Datos fallo — solo para fallo de tolerancia */}
                  {!isIncomplete && !isLoadError && (
                    <div className="w-full grid grid-cols-2 gap-3">
                      {[
                        { label: '↑ Ascenso', val: testHUDOverlay.realElev, min: testHUDOverlay.minElev, max: testHUDOverlay.maxElev, raw: testHUDOverlay._rawElev, rMin: testHUDOverlay._minElev, rMax: testHUDOverlay._maxElev },
                        { label: '↓ Descenso', val: testHUDOverlay.realDesc, min: testHUDOverlay.minDesc, max: testHUDOverlay.maxDesc, raw: testHUDOverlay._rawDesc, rMin: testHUDOverlay._minDesc, rMax: testHUDOverlay._maxDesc }
                      ].map(({ label, val, min, max, raw, rMin, rMax }) => {
                        const ok = raw != null && rMin != null ? raw >= rMin && raw <= rMax : null;
                        return (
                          <div key={label} className={`p-3 rounded-xl border text-center ${ok ? 'border-green-500/40 bg-green-900/10' : 'border-red-500/40 bg-red-900/10'}`}>
                            <span className="text-[10px] text-gray-400 uppercase tracking-widest block mb-1">{label}</span>
                            <span className={`text-2xl font-mono font-black ${ok ? 'text-green-400' : 'text-red-400'}`}>{val ?? '—'}</span>
                            <div className="text-[10px] text-gray-500 font-mono mt-1">ERP: {min} – {max}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Botones */}
                  <div className="flex gap-4 w-full">
                    <button
                      onClick={() => pulsePlc('Ob_Iniciar_Secuencia')}
                      className="flex-1 flex flex-col items-center gap-1 py-4 rounded-2xl bg-gradient-to-b from-green-500 to-green-700 border-2 border-green-400/50 text-white font-black text-lg uppercase tracking-wider shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:shadow-[0_0_30px_rgba(34,197,94,0.7)] hover:scale-[1.03] active:scale-95 transition-all"
                    >
                      <span className="text-2xl">▶</span>
                      <span>SÍ — Repetir</span>
                      <span className="text-[10px] font-normal opacity-70 normal-case">Iniciar secuencia</span>
                    </button>
                    {/* NO CONTINUAR solo disponible si el fallo es de tolerancia, no de movimiento incompleto ni de carga */}
                    {!isIncomplete && !isLoadError && (
                      <button
                        onClick={() => pulsePlc('Ob_Poner_Pegatina')}
                        className="flex-1 flex flex-col items-center gap-1 py-4 rounded-2xl bg-gradient-to-b from-gray-600 to-gray-800 border-2 border-gray-500/50 text-white font-black text-lg uppercase tracking-wider shadow-[0_0_10px_rgba(0,0,0,0.4)] hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:scale-[1.03] active:scale-95 transition-all"
                      >
                        <span className="text-2xl">✓</span>
                        <span>NO — Continuar</span>
                        <span className="text-[10px] font-normal opacity-70 normal-case">Poner pegatina</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}


          <TelemetryHUD telemetry={telemetry} cycleTimer={cycleTimer} isSimulation={isSimulation} />
          <DigitalTwin 
            currentStep={currentStep}
            distance={telemetry.distance} 
            plcState={appPlc} 
            palletState={palletState} 
            erpData={erpData}
            onPalletAnimComplete={() => setPalletState('picked_up')} 
            showStickers={appPlc.Ob_Poner_Pegatina || currentStep > 1}
            zoomToStickers={currentStep === 1 && step2Overlay?.isOk && !appPlc.Ob_Poner_Pegatina}
          />



          {/* Slider flotante para el movimiento del carro (Solo Simulación) */}
          {isSimulation && (
            <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 bg-[#0a0f12]/80 backdrop-blur-md p-4 rounded-full border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.15)] z-40">
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
                  
                  // En simulación: escribir window.__carriageY DIRECTAMENTE en metros
                  // para que el Sequencer detecte el cruce de 1500mm independientemente del pallet
                  if (typeof window !== 'undefined') {
                    window.__carriageY = val / 1000;
                    window.__simCarriageHeight = val;
                  }

                  // Lógica física simulada para el láser Wenglor:
                  // Si hay pallet en horquillas: lee la distancia al pallet (altura del carro + grosor del pallet)
                  // Si no hay pallet: el láser lee el suelo (0) — pero el carro sigue moviéndose
                  const isPickedUp = palletState === 'picked_up' || (palletState === 'animating' && window.__animPhase !== 'idle');
                  const laserValue = isPickedUp ? val + 185 : val; // sin carga: usar altura directa

                  try {
                    await fetch('http://localhost:8001/plc/write', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ OR_Altura_Carretilla: laserValue })
                    });
                  } catch (err) { console.error("Error escribiendo altura PLC", err); }
                }}
                className="w-2 h-64 appearance-none bg-[#1d2930] rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(59,130,246,0.8)] cursor-pointer"
                style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' }}
              />
              <span className="text-blue-400 text-xs font-black uppercase tracking-widest bg-blue-500/10 px-2 py-1 rounded">0m</span>
            </div>
          )}

          {/* Botonera de pulsadores simulada y control de pallets (Solo Simulación) */}
          {isSimulation && (
            <div className="absolute left-6 bottom-6 flex gap-3 bg-[#0a0f12]/90 backdrop-blur-md p-4 rounded-xl border border-gray-800 shadow-2xl z-40">
              <div className="flex flex-col items-center">
                <button
                  onClick={() => pulsePlc('Ob_Iniciar_Secuencia')}
                  className="w-14 h-14 rounded-full bg-gradient-to-b from-green-500 to-green-700 active:from-green-700 active:to-green-900 border-4 border-[#1d2930] shadow-[0_4px_10px_rgba(34,197,94,0.3)] flex items-center justify-center transition-all active:scale-95 active:shadow-inner"
                >
                  <Play size={20} className="text-white ml-1" />
                </button>
                <span className="mt-2 text-[9px] font-black uppercase text-gray-400 tracking-wider">Iniciar<br/>Secuencia</span>
              </div>
              
              <div className="flex flex-col items-center">
                <button
                  onClick={() => pulsePlc('Ob_Poner_Pegatina')}
                  className="w-14 h-14 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 active:from-blue-700 active:to-blue-900 border-4 border-[#1d2930] shadow-[0_4px_10px_rgba(59,130,246,0.3)] flex items-center justify-center transition-all active:scale-95 active:shadow-inner"
                >
                  <CheckCircle2 size={24} className="text-white" />
                </button>
                <span className="mt-2 text-[9px] font-black uppercase text-gray-400 tracking-wider text-center">Pegatina<br/>Colocada</span>
              </div>

              <div className="flex flex-col items-center">
                <button
                  onClick={() => pulsePlc('Ob_Abortar_Secuencia')}
                  className="w-14 h-14 rounded-full bg-gradient-to-b from-red-500 to-red-700 active:from-red-700 active:to-red-900 border-4 border-[#1d2930] shadow-[0_4px_10px_rgba(239,68,68,0.3)] flex items-center justify-center transition-all active:scale-95 active:shadow-inner"
                >
                  <PowerOff size={20} className="text-white" />
                </button>
                <span className="mt-2 text-[9px] font-black uppercase text-gray-400 tracking-wider">Abortar<br/>Secuencia</span>
              </div>

              <div className="flex flex-col items-center border-l border-gray-700 pl-3 ml-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const current = appPlc.OW_Numero_Pallets || 0;
                      if (current > 0) {
                        const targetVar = (!isSimulation) ? Object.keys(JSON.parse(localStorage.getItem('plcVarMapping') || '{}')).find(k => JSON.parse(localStorage.getItem('plcVarMapping'))[k].appVar === 'OW_Numero_Pallets') : 'OW_Numero_Pallets';
                        if (targetVar) {
                          fetch('http://localhost:8001/plc/write', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ [targetVar]: current - 1 })
                          }).catch(console.error);
                        }
                      }
                    }}
                    className="w-8 h-8 rounded-full bg-[#1d2930] text-white hover:bg-gray-600 transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={appPlc.OW_Numero_Pallets || 0}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= 0) {
                        const targetVar = (!isSimulation) ? Object.keys(JSON.parse(localStorage.getItem('plcVarMapping') || '{}')).find(k => JSON.parse(localStorage.getItem('plcVarMapping'))[k].appVar === 'OW_Numero_Pallets') : 'OW_Numero_Pallets';
                        if (targetVar) {
                          fetch('http://localhost:8001/plc/write', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ [targetVar]: val })
                          }).catch(console.error);
                        }
                      }
                    }}
                    className="bg-[#0a0f12] text-white font-mono text-sm px-1 py-1 rounded border border-gray-700 w-12 text-center outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => {
                      const current = appPlc.OW_Numero_Pallets || 0;
                      const targetVar = (!isSimulation) ? Object.keys(JSON.parse(localStorage.getItem('plcVarMapping') || '{}')).find(k => JSON.parse(localStorage.getItem('plcVarMapping'))[k].appVar === 'OW_Numero_Pallets') : 'OW_Numero_Pallets';
                      if (targetVar) {
                        fetch('http://localhost:8001/plc/write', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ [targetVar]: current + 1 })
                        }).catch(console.error);
                      }
                    }}
                    className="w-8 h-8 rounded-full bg-[#1d2930] text-white hover:bg-gray-600 transition-colors"
                  >
                    +
                  </button>
                </div>
                <span className="mt-1 text-[9px] font-black uppercase text-gray-400 tracking-wider">Pallets Sim.</span>
                <span className="text-[10px] font-bold text-yellow-400">{(appPlc.OW_Numero_Pallets || 0) * 250} kg</span>
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
            plcState={appPlc}
            isSimulation={isSimulation}
            setStep2Overlay={setStep2Overlay}
            setTestHUDOverlay={setTestHUDOverlay}
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
