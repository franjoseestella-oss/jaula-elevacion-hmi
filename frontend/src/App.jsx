import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, Play, CheckCircle2, PowerOff, Camera, X, Download, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
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
  const [pulseActive, setPulseActive] = useState(null); // { varName: string, timeLeft: number }

  const [alarms, setAlarms] = useState([]);
  const [showAlarmsHistory, setShowAlarmsHistory] = useState(false);
  const [showActiveAlarms, setShowActiveAlarms] = useState(false);
  const [hasUnreadAlarms, setHasUnreadAlarms] = useState(false);
  
  const [alarmConfig, setAlarmConfig] = useState(() => {
    const saved = localStorage.getItem("plcAlarmConfig");
    return saved ? JSON.parse(saved) : { in: [], out: [] };
  });

  useEffect(() => {
    const handleConfigChange = () => {
      const saved = localStorage.getItem("plcAlarmConfig");
      if (saved) setAlarmConfig(JSON.parse(saved));
    };
    window.addEventListener('plcAlarmConfigUpdated', handleConfigChange);
    return () => window.removeEventListener('plcAlarmConfigUpdated', handleConfigChange);
  }, []);

  const hasActiveCriticalAlarm = alarmConfig?.in?.some(a => a.type === 'Alarma' && telemetry?.plc?.[a.plcVar]) || false;
  
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
         return [{ id: Date.now(), timestamp: new Date().toLocaleString(), description: newAlarmDesc, type: 'Alarma' }, ...prev].slice(0, 5000);
      });
    }
  }, [telemetry?.opcua_error, telemetry?.plc?.Ob_Abortar_Secuencia]);

  const activePlcAlarmsRef = useRef([]);
  
  // Procesar flancos de subida de las alarmas configuradas (IN ALARMAS)
  useEffect(() => {
    if (!telemetry?.plc || !alarmConfig?.in) return;
    
    const currentActive = alarmConfig.in.filter(a => telemetry.plc[a.plcVar]).map(a => a.plcVar);

    // Inject manual mode alarm if not automatic (and not in simulation)
    if (!isSimulation && telemetry?.opcua_connected && !telemetry.mappedPlc?.Ob_Estado_Automatico && !telemetry.plc?.Ob_Estado_Automatico) {
      currentActive.push('SYS_MODO_MANUAL');
    }

    const newAlarms = currentActive.filter(id => !activePlcAlarmsRef.current.includes(id));
    
    if (newAlarms.length > 0) {
      setHasUnreadAlarms(true);
      const now = new Date();
      
      const newAlarmObjects = newAlarms.map(id => {
        if (id === 'SYS_MODO_MANUAL') {
          return {
            id: `SYS_MODO_MANUAL-${now.getTime()}`,
            plcVar: 'SYS_MODO_MANUAL',
            description: '[ADVERTENCIA] Máquina en estado manual, no cumples condiciones iniciales',
            type: 'Advertencia',
            timestamp: now.toLocaleTimeString(),
            startTime: now.getTime(),
            endTime: null,
            duration: 'Activa'
          };
        }

        const config = alarmConfig.in.find(a => a.plcVar === id);
        let desc = `[${id}]`;
        if (config.desc) desc += ` ${config.desc}`;
        if (config.remedy) desc += ` (Remedio: ${config.remedy})`;
        
        return {
          id: `${id}-${now.getTime()}`,
          plcVar: id,
          description: desc,
          type: config.type || 'Alarma',
          timestamp: now.toLocaleTimeString(),
          startTime: now.getTime(),
          endTime: null,
          duration: 'Activa'
        };
      });

      setAlarms(prev => {
        const updated = [...newAlarmObjects, ...prev];
        return updated.slice(0, 5000); // Limit historical alarms to 5000
      });
    }

    // Identify RESOLVED alarms (in previous ref but not in current)
    const resolvedAlarms = activePlcAlarmsRef.current.filter(id => !currentActive.includes(id));
    if (resolvedAlarms.length > 0) {
      const nowTime = Date.now();
      setAlarms(prev => prev.map(alarm => {
        if (resolvedAlarms.includes(alarm.plcVar) && !alarm.endTime) {
          const durationMs = nowTime - alarm.startTime;
          const secs = Math.floor(durationMs / 1000);
          const mins = Math.floor(secs / 60);
          const durationStr = mins > 0 ? `${mins}m ${secs % 60}s` : `${secs}s`;
          return { ...alarm, endTime: nowTime, duration: durationStr };
        }
        return alarm;
      }));
    }
    
    activePlcAlarmsRef.current = currentActive;
  }, [telemetry?.plc, alarmConfig?.in]);

  const activeAlarmsList = React.useMemo(() => {
    if (!telemetry?.plc || !alarmConfig?.in) return [];
    const list = alarmConfig.in.filter(a => telemetry.plc[a.plcVar]).map(a => {
      const typeStr = (a.type || 'Alarma').toUpperCase();
      let desc = `[${typeStr}] ${a.plcVar}`;
      if (a.desc) desc += `: ${a.desc}`;
      if (a.remedy) desc += ` (Remedio: ${a.remedy})`;
      return { id: a.plcVar, description: desc, type: a.type || 'Alarma' };
    });

    if (telemetry?.opcua_connected && !telemetry.mappedPlc?.Ob_Estado_Automatico && !telemetry.plc?.Ob_Estado_Automatico) {
      list.push({ 
        id: 'SYS_MODO_MANUAL', 
        description: '[ADVERTENCIA] Máquina en estado manual, no cumples condiciones iniciales', 
        type: 'Advertencia' 
      });
    }

    return list;
  }, [telemetry?.plc, telemetry?.mappedPlc, telemetry?.opcua_connected, alarmConfig?.in]);

  // Reset de alarmas: solo pulso al PLC, se conserva el histórico
  const handleResetAlarms = useCallback(() => {
    pulsePlc('Ob_Reset_Alarmas', 0.5);
    setHasUnreadAlarms(false);

    // Si la alarma es persistente (no se limpia tras el reset), 
    // tras 1.5 segundos forzamos que se vuelva a detectar como "nueva" 
    // para que vuelva a "sacar el alarmero".
    setTimeout(() => {
      activePlcAlarmsRef.current = [];
    }, 1500);
  }, []);

  const handleExportAlarms = useCallback(() => {
    if (alarms.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(alarms.map(a => ({
      Fecha_Hora: a.timestamp,
      Tipo: a.type,
      Descripcion: a.description,
      Duracion: a.duration
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Histórico de Alarmas");
    XLSX.writeFile(workbook, `Historial_Alarmas_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`);
  }, [alarms]);

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

  const usePlcCountdown = (varValue, onComplete) => {
    const [timeLeft, setTimeLeft] = useState(null);
    const onCompleteRef = useRef(onComplete);
    
    useEffect(() => {
      onCompleteRef.current = onComplete;
    }, [onComplete]);

    useEffect(() => {
      let interval;
      let triggered = false;
      let currentLeft = 3;
      if (varValue) {
        setTimeLeft(3);
        interval = setInterval(() => {
          currentLeft -= 1;
          if (currentLeft <= 0) {
             setTimeLeft(0);
             if (!triggered) {
               triggered = true;
               if (onCompleteRef.current) onCompleteRef.current();
             }
          } else {
             setTimeLeft(currentLeft);
          }
        }, 1000);
      } else {
        setTimeLeft(null);
      }
      return () => clearInterval(interval);
    }, [varValue]);

    return timeLeft;
  };


  const handleHoldStart = (varName) => {
    if (varName === 'Ob_Iniciar_Secuencia' && !appPlc?.Ob_Estado_Automatico) {
      alert("No se puede iniciar la secuencia: La máquina está en modo MANUAL.");
      return;
    }
    let targetVar = varName;
    if (!isSimulation) {
      const mappingStr = localStorage.getItem('plcVarMapping');
      if (mappingStr) {
         try {
            const mapping = JSON.parse(mappingStr);
            const found = Object.entries(mapping).find(([k, v]) => v.appVar === varName);
            if (found) targetVar = found[0];
            else return;
         } catch(e) {}
      } else return;
    }
    fetch('http://localhost:8001/plc/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [targetVar]: true, is_force: isSimulation })
    }).catch(console.error);
  };

  const handleHoldEnd = (varName) => {
    let targetVar = varName;
    if (!isSimulation) {
      const mappingStr = localStorage.getItem('plcVarMapping');
      if (mappingStr) {
         try {
            const mapping = JSON.parse(mappingStr);
            const found = Object.entries(mapping).find(([k, v]) => v.appVar === varName);
            if (found) targetVar = found[0];
            else return;
         } catch(e) {}
      } else return;
    }
    fetch('http://localhost:8001/plc/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [targetVar]: false, is_force: isSimulation })
    }).catch(console.error);
  };

  // Enviar comando al PLC para activar un bit, esperar N segundos y desactivarlo
  const pulsePlc = async (varName, durationSecs = 3) => {
    if (pulseActive && pulseActive.varName === varName) return; // Prevent overlapping pulses

    if (varName === 'Ob_Iniciar_Secuencia' && !appPlc?.Ob_Estado_Automatico) {
      alert("No se puede iniciar la secuencia: La máquina está en modo MANUAL.");
      return;
    }

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
        body: JSON.stringify({ [targetVar]: true, is_force: isSimulation })
      });
      
      // If duration is less than 1, we don't show the visual countdown, just timeout
      if (durationSecs < 1) {
        setTimeout(async () => {
          await fetch('http://localhost:8001/plc/write', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [targetVar]: false, is_force: isSimulation })
          }).catch(e => console.error(e));
        }, durationSecs * 1000);
        return;
      }

      setPulseActive({ varName, timeLeft: durationSecs });
      
      let secondsLeft = durationSecs;
      const interval = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft <= 0) {
           clearInterval(interval);
           setPulseActive(null);
           fetch('http://localhost:8001/plc/write', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ [targetVar]: false, is_force: isSimulation })
           }).catch(e => console.error(e));
        } else {
           setPulseActive({ varName, timeLeft: secondsLeft });
        }
      }, 1000);
    } catch (error) {
      console.error('Error in pulsePlc:', error);
      setPulseActive(null);
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

  // ── Parpadeo de luces en modal NOK ──
  useEffect(() => {
    let intervalId = null;
    let lightState = false;

    if (testHUDOverlay?.cameraTestState === 'nok') {
      const alarm = testHUDOverlay?.testAlarm;
      const isIncomplete = alarm === 'ascenso_incompleto' || alarm === 'descenso_incompleto';
      const isLoadError = typeof alarm === 'string' && alarm.startsWith('Carga incorrecta');
      const onlyBtn1 = isIncomplete || isLoadError;

      intervalId = setInterval(() => {
        lightState = !lightState;
        fetch('http://localhost:8001/plc/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            Ib_LUZ_Pulsador_1: lightState,
            Ib_LUZ_Pulsador_2: onlyBtn1 ? false : lightState,
            is_force: isSimulation 
          })
        }).catch(err => console.error('Error parpadeo luces:', err));
      }, 1000); // 1000ms on, 1000ms off
    } else {
      // Apagamos las luces si salimos del modo NOK
      fetch('http://localhost:8001/plc/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          Ib_LUZ_Pulsador_1: false,
          Ib_LUZ_Pulsador_2: false,
          is_force: isSimulation 
        })
      }).catch(err => console.error('Error apagando luces:', err));
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      // Solo lanzamos el fetch al desmontar si estábamos parpadeando
      if (testHUDOverlay?.cameraTestState === 'nok') {
        fetch('http://localhost:8001/plc/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            Ib_LUZ_Pulsador_1: false,
            Ib_LUZ_Pulsador_2: false,
            is_force: isSimulation 
          })
        }).catch(err => console.error('Error apagando luces al desmontar:', err));
      }
    };
  }, [testHUDOverlay?.cameraTestState, isSimulation]);

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

  const appPlc = isSimulation ? { ...(telemetry?.plc || {}), Ob_Estado_Automatico: true } : (telemetry?.mappedPlc || {});
  
  const iniciarPlcTime = usePlcCountdown(appPlc?.Ob_Iniciar_Secuencia, () => {
    if (sequencerRef.current?.onIniciarSecuencia) sequencerRef.current.onIniciarSecuencia();
  });
  const pegatinaPlcTime = usePlcCountdown(appPlc?.Ob_Poner_Pegatina, () => {
    if (sequencerRef.current?.onPegatina) sequencerRef.current.onPegatina();
  });
  const abortarPlcTime = usePlcCountdown(appPlc?.Ob_Abortar_Secuencia, () => {
    if (sequencerRef.current?.onAbortar) sequencerRef.current.onAbortar();
  });
  
  const isMainScreen = !erpModalOpen && !settingsOpen && !plcModalOpen && !logsOpen && !showAlarmsHistory;

  return (
    <div className="h-screen w-screen flex flex-col bg-logisnext-darkslate text-white overflow-hidden font-primary">
      <Header
        status={networkStatus}
        isAuto={appPlc?.Ob_Estado_Automatico === true}
        onErpClick={() => setErpModalOpen(true)}
        onSettingsClick={() => setSettingsOpen(true)}
        onLogsClick={() => setLogsOpen(true)}
        onPlcClick={() => setPlcModalOpen(true)}
        operario={operario}
        canChangeOperator={!erpData}
        onOperatorClick={() => setOperario(null)}
        hasAlarms={alarms.length > 0}
        onAlarmsClick={() => { setShowAlarmsHistory(true); setHasUnreadAlarms(false); }}
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
                    ALTURA ACTUAL: <span className={step2Overlay.isOk ? "text-white" : "text-blue-400"}>{step2Overlay.actual.toFixed(2)} mm</span>
                  </span>
                  <div className="flex gap-4 items-center">
                    <span className="text-lg font-bold tracking-widest text-gray-300">OBJETIVO:</span>
                    <span className="text-xl font-black text-gray-200 bg-black/30 px-3 py-1 rounded">
                      {step2Overlay.min} mm <span className="text-gray-400 mx-1">—</span> {step2Overlay.max} mm
                    </span>
                  </div>
                  {step2Overlay.isOk ? (
                    <span className="text-xl font-black tracking-widest text-green-200 mt-2 border-t border-green-500/50 pt-2">
                      CARRETILLA EN POSICIÓN. PUEDE COLOCAR PEGATINA.
                    </span>
                  ) : (
                    <span className="text-xl font-black tracking-widest text-blue-200 mt-2 border-t border-blue-500/50 pt-2">
                      PUEDE COLOCAR PEGATINA.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ALARMS ICON */}
          {hasUnreadAlarms && (
            <button 
              onClick={() => { setShowActiveAlarms(true); setHasUnreadAlarms(false); }}
              className="absolute top-48 right-12 z-50 bg-red-600/90 border-4 border-red-500 text-white p-8 rounded-full shadow-[0_0_50px_rgba(220,38,38,0.8)] hover:scale-110 active:scale-95 transition-all animate-pulse"
            >
              <AlertTriangle size={108} />
            </button>
          )}

          {/* ALARMAS ACTIVAS MODAL (FLOATING PANEL) */}
          {showActiveAlarms && (
            <div className="absolute top-56 right-6 z-50 w-[600px] bg-[#0a0f12]/95 border border-red-500/50 rounded-2xl shadow-[0_0_40px_rgba(220,38,38,0.3)] backdrop-blur-md overflow-hidden flex flex-col max-h-[70vh] animate-in slide-in-from-right-8 duration-300">
              <div className="bg-red-600/20 border-b border-red-500/30 p-5 flex justify-between items-center shrink-0">
                 <div className="flex items-center gap-3">
                    <AlertTriangle size={24} className="text-red-500" />
                    <span className="text-base font-black text-red-500 uppercase tracking-widest drop-shadow-md">Alarmas Activas</span>
                 </div>
                 <div className="flex items-center gap-3">
                   <button onClick={() => { handleResetAlarms(); setShowActiveAlarms(false); }} className="text-white text-xs font-bold uppercase tracking-wider bg-red-600/80 border border-red-500 hover:bg-red-500 px-3 py-1.5 rounded-lg shadow-sm transition-colors">
                     Reset Alarmas
                   </button>
                   <button onClick={() => setShowActiveAlarms(false)} className="text-gray-400 hover:text-white bg-[#1d2930] p-2 rounded-lg hover:bg-red-600 transition-colors"><X size={20}/></button>
                 </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
                {activeAlarmsList.length === 0 ? (
                   <span className="text-sm text-gray-500 italic text-center py-10">No hay alarmas activas en este momento.</span>
                ) : activeAlarmsList.map(a => {
                   const isWarning = a.type?.toUpperCase() === 'ADVERTENCIA';
                   return (
                     <div key={a.id} className={`bg-[#1d2930]/80 p-4 rounded-xl border flex flex-col gap-2 shadow-sm transition-colors ${
                       isWarning ? 'border-yellow-500/50 hover:border-yellow-500/80' : 'border-red-500/50 hover:border-red-500/80'
                     }`}>
                       <span className={`text-sm font-bold tracking-wide ${isWarning ? 'text-yellow-400' : 'text-red-400'}`}>
                         {a.description}
                       </span>
                     </div>
                   );
                })}
              </div>
            </div>
          )}

          {/* HISTÓRICO ALARMS MODAL (FULL SCREEN) */}
          {showAlarmsHistory && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-8">
              <div className="w-full max-w-6xl bg-[#0a0f12] border border-red-500/50 rounded-2xl shadow-[0_0_60px_rgba(220,38,38,0.3)] overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                <div className="bg-red-600/20 border-b border-red-500/30 p-6 flex justify-between items-center shrink-0">
                   <div className="flex items-center gap-4">
                      <AlertTriangle size={32} className="text-red-500" />
                      <span className="text-2xl font-black text-red-500 uppercase tracking-widest drop-shadow-md">Log_Alarms</span>
                   </div>
                   <div className="flex items-center gap-4">
                     <button onClick={() => setAlarms([])} className="text-white text-sm font-bold uppercase tracking-wider bg-orange-600/80 border border-orange-500 hover:bg-orange-500 px-4 py-2 rounded-lg shadow-sm transition-colors flex items-center gap-2">
                       <Trash2 size={18} /> Borrar Histórico
                     </button>
                     <button onClick={handleExportAlarms} className="text-white text-sm font-bold uppercase tracking-wider bg-green-600/80 border border-green-500 hover:bg-green-500 px-4 py-2 rounded-lg shadow-sm transition-colors flex items-center gap-2">
                       <Download size={18} /> Exportar .xlsx
                     </button>
                     <button onClick={() => setShowAlarmsHistory(false)} className="text-gray-400 hover:text-white bg-[#1d2930] p-2.5 rounded-lg hover:bg-red-600 transition-colors">
                       <X size={24} />
                     </button>
                   </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                  {alarms.length === 0 ? (
                     <div className="text-lg text-gray-500 italic text-center py-20">No hay alarmas registradas en el histórico.</div>
                  ) : (
                    <table className="w-full text-left border-collapse text-sm">
                      <thead className="bg-[#1d2930] sticky top-0 z-10">
                        <tr>
                          <th className="p-4 border-b border-gray-700 text-gray-300 font-bold uppercase w-1/6">Fecha y Hora</th>
                          <th className="p-4 border-b border-gray-700 text-gray-300 font-bold uppercase w-1/6">Alarma / Advertencia</th>
                          <th className="p-4 border-b border-gray-700 text-gray-300 font-bold uppercase w-3/6">Descripción</th>
                          <th className="p-4 border-b border-gray-700 text-gray-300 font-bold uppercase w-1/6">Duración</th>
                        </tr>
                      </thead>
                      <tbody>
                        {alarms.map(a => {
                          const isWarning = a.type?.toUpperCase() === 'ADVERTENCIA';
                          const isActive = a.duration === 'Activa';
                          return (
                            <tr key={a.id} className={`border-b border-gray-800/50 transition-colors ${
                              isWarning ? 'hover:bg-yellow-500/10' : 'hover:bg-red-500/10'
                            }`}>
                              <td className="p-4 text-gray-400 font-mono">{a.timestamp}</td>
                              <td className={`p-4 font-bold ${isWarning ? 'text-yellow-500' : 'text-red-500'}`}>
                                {isWarning ? 'ADVERTENCIA' : 'ALARMA'}
                              </td>
                              <td className="p-4 text-gray-200">{a.description}</td>
                              <td className="p-4">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  isActive ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-gray-800 text-gray-400'
                                }`}>
                                  {a.duration}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* BANNER GIGANTE DE SEGURIDAD: FALTAN VALLAS */}
          {isMainScreen && erpData && (currentStep === 3 || currentStep === 4) && (!appPlc?.Ob_Dtec_Valla_1_trabajo_LH || !appPlc?.Ob_Dtec_Valla_2_trabajo_RH) && (
            <div className="absolute top-28 left-1/2 -translate-x-1/2 z-50 bg-red-600/90 border-4 border-red-500 text-white px-8 py-4 rounded-xl shadow-[0_0_50px_rgba(220,38,38,0.8)] flex items-center gap-6 backdrop-blur-md">
              <AlertTriangle size={56} className="text-white drop-shadow-lg" />
              <div className="flex flex-col">
                <span className="text-4xl font-black tracking-[0.2em] drop-shadow-md">VALLAS NO EN POSICIÓN</span>
                <span className="text-sm font-bold tracking-widest text-red-100 drop-shadow">PELIGRO: LA JAULA NO ES SEGURA</span>
              </div>
            </div>
          )}

          {/* BANNER FIJO: VALLAS ABAJO (EN TRABAJO) */}
          {isMainScreen && (appPlc?.Ob_Dtec_Valla_1_trabajo_LH || appPlc?.Ob_Dtec_Valla_2_trabajo_RH) && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-[60] bg-yellow-400 text-black px-10 py-2 rounded-b-3xl border-4 border-t-0 border-black shadow-[0_15px_40px_rgba(234,179,8,0.6)] flex items-center gap-6" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(0,0,0,0.2) 20px, rgba(0,0,0,0.2) 40px)' }}>
              <AlertTriangle size={36} className="text-black drop-shadow-sm animate-pulse" />
              <div className="flex flex-col text-center">
                <span className="text-2xl font-black tracking-[0.1em] uppercase drop-shadow-sm bg-yellow-400/80 px-2 rounded">¡¡ ATENCIÓN VALLAS ABAJO !!</span>
                <span className="text-sm font-black tracking-widest text-black/90 drop-shadow-sm bg-yellow-400/80 px-2 mt-1 rounded">SUBIRLAS AL FINALIZAR LA PRUEBA</span>
              </div>
              <AlertTriangle size={36} className="text-black drop-shadow-sm animate-pulse" />
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
                      {testHUDOverlay.cameraTestState === 'esperando_1500' && `ESPERA ${localStorage.getItem('cotaInicialPruebas') || 1500} mm ↑`}
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
                      onClick={() => {
                        pulsePlc('Ob_Iniciar_Secuencia', 0.5);
                        if (sequencerRef.current?.onIniciarSecuencia) sequencerRef.current.onIniciarSecuencia();
                      }}
                      className={`flex-1 flex flex-col items-center gap-1 py-4 rounded-2xl border-2 text-white font-black text-lg uppercase tracking-wider transition-all ${iniciarPlcTime !== null ? 'bg-green-800 border-green-700 opacity-50 cursor-not-allowed' : 'bg-gradient-to-b from-green-500 to-green-700 border-green-400/50 shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:shadow-[0_0_30px_rgba(34,197,94,0.7)] hover:scale-[1.03] active:scale-95'}`}
                    >
                      {iniciarPlcTime !== null ? (
                        <>
                          <span className="text-4xl animate-pulse py-1">{iniciarPlcTime}</span>
                          <span className="text-[10px] font-normal opacity-70 normal-case">Pulsador físico detectado...</span>
                        </>
                      ) : (
                        <>
                          <span className="text-2xl">▶</span>
                          <span>SÍ — Repetir</span>
                          <span className="text-[10px] font-normal opacity-70 normal-case">Click para iniciar</span>
                        </>
                      )}
                    </button>
                    {/* NO CONTINUAR solo disponible si el fallo es de tolerancia, no de movimiento incompleto ni de carga */}
                    {!isIncomplete && !isLoadError && (
                      <button
                        onClick={() => {
                          pulsePlc('Ob_Poner_Pegatina', 0.5);
                          if (sequencerRef.current?.onPegatina) sequencerRef.current.onPegatina();
                        }}
                        className={`flex-1 flex flex-col items-center gap-1 py-4 rounded-2xl border-2 text-white font-black text-lg uppercase tracking-wider transition-all ${pegatinaPlcTime !== null ? 'bg-gray-700 border-gray-600 opacity-50 cursor-not-allowed' : 'bg-gradient-to-b from-gray-600 to-gray-800 border-gray-500/50 shadow-[0_0_10px_rgba(0,0,0,0.4)] hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:scale-[1.03] active:scale-95'}`}
                      >
                        {pegatinaPlcTime !== null ? (
                          <>
                            <span className="text-4xl animate-pulse py-1">{pegatinaPlcTime}</span>
                            <span className="text-[10px] font-normal opacity-70 normal-case">Pulsador físico detectado...</span>
                          </>
                        ) : (
                          <>
                            <span className="text-2xl">✓</span>
                            <span>NO — Continuar</span>
                            <span className="text-[10px] font-normal opacity-70 normal-case">Click para continuar</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}


          <TelemetryHUD 
            telemetry={telemetry} 
            cycleTimer={cycleTimer} 
            isSimulation={isSimulation}
            distance={appPlc?.OR_Altura_Carretilla !== undefined ? appPlc.OR_Altura_Carretilla : telemetry.distance}
          />
          <DigitalTwin 
            currentStep={currentStep}
            distance={appPlc?.OR_Altura_Carretilla !== undefined ? appPlc.OR_Altura_Carretilla : telemetry.distance} 
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

          {/* Botonera de pulsadores simulada y control de simulación (SOLO SIMULACIÓN) */}
          {isSimulation && (
            <div className="absolute left-6 bottom-6 flex gap-3 bg-[#0a0f12]/90 backdrop-blur-md p-4 rounded-xl border border-gray-800 shadow-2xl z-40">
              <div className="flex flex-col items-center">
                <button
                  onClick={() => {
                    if (hasActiveCriticalAlarm) {
                      alert("No se puede iniciar la secuencia: Hay alarmas críticas activas.");
                      return;
                    }
                    if (!appPlc?.Ob_Estado_Automatico) return;
                    pulsePlc('Ob_Iniciar_Secuencia', 0.5);
                    if (sequencerRef.current?.onIniciarSecuencia) sequencerRef.current.onIniciarSecuencia();
                  }}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all border-4 shadow-[0_4px_10px_rgba(34,197,94,0.3)]
                    ${hasActiveCriticalAlarm || !appPlc?.Ob_Estado_Automatico || iniciarPlcTime !== null
                      ? 'bg-gray-600 border-gray-500 opacity-50 cursor-not-allowed' 
                      : 'bg-gradient-to-b from-green-500 to-green-700 active:from-green-700 active:to-green-900 border-[#1d2930] active:scale-95 active:shadow-inner'}`}
                >
                  {iniciarPlcTime !== null ? (
                     <span className="text-white font-black text-2xl animate-pulse">{iniciarPlcTime}</span>
                  ) : (
                     <Play size={20} className="text-white ml-1" />
                  )}
                </button>
                <span className="mt-2 text-[9px] font-black uppercase text-gray-400 tracking-wider text-center">Iniciar<br/>Secuencia</span>
              </div>
              
              <div className="flex flex-col items-center">
                <button
                  onClick={() => {
                    pulsePlc('Ob_Poner_Pegatina', 0.5);
                    if (sequencerRef.current?.onPegatina) sequencerRef.current.onPegatina();
                  }}
                  className={`w-14 h-14 rounded-full border-4 border-[#1d2930] shadow-[0_4px_10px_rgba(59,130,246,0.3)] flex items-center justify-center transition-all active:scale-95 active:shadow-inner
                    ${pegatinaPlcTime !== null
                      ? 'bg-gray-600 opacity-50 cursor-not-allowed'
                      : 'bg-gradient-to-b from-blue-500 to-blue-700 active:from-blue-700 active:to-blue-900'}`}
                >
                  {pegatinaPlcTime !== null ? (
                     <span className="text-white font-black text-2xl animate-pulse">{pegatinaPlcTime}</span>
                  ) : (
                     <CheckCircle2 size={24} className="text-white" />
                  )}
                </button>
                <span className="mt-2 text-[9px] font-black uppercase text-gray-400 tracking-wider text-center">Pegatina<br/>Colocada</span>
              </div>

              <div className="flex flex-col items-center border-r border-gray-700 pr-3 mr-1">
                <button
                  onClick={() => {
                    pulsePlc('Ob_Abortar_Secuencia', 0.5);
                    if (sequencerRef.current?.onAbortar) sequencerRef.current.onAbortar();
                  }}
                  className={`w-14 h-14 rounded-full border-4 border-[#1d2930] shadow-[0_4px_10px_rgba(239,68,68,0.3)] flex items-center justify-center transition-all active:scale-95 active:shadow-inner
                    ${abortarPlcTime !== null
                      ? 'bg-gray-600 opacity-50 cursor-not-allowed'
                      : 'bg-gradient-to-b from-red-500 to-red-700 active:from-red-700 active:to-red-900'}`}
                >
                  {abortarPlcTime !== null ? (
                     <span className="text-white font-black text-2xl animate-pulse">{abortarPlcTime}</span>
                  ) : (
                     <PowerOff size={20} className="text-white" />
                  )}
                </button>
                <span className="mt-2 text-[9px] font-black uppercase text-gray-400 tracking-wider text-center">Abortar<br/>Secuencia</span>
              </div>

              {/* Control de Vallas Simuladas */}
              <div className="flex flex-col gap-1 items-center justify-center border-r border-gray-700 pr-3 mr-1">
                <span className="text-[9px] font-black uppercase text-gray-500 tracking-wider mb-1">Jaula</span>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const newVal = !appPlc.Ob_Subir_Vallas;
                      try {
                        await fetch('http://localhost:8001/plc/write', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ Ob_Subir_Vallas: newVal, Ob_Bajar_Vallas: false, is_force: true })
                        });
                      } catch(e) {}
                    }}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      appPlc.Ob_Subir_Vallas 
                        ? 'bg-indigo-500 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.6)] text-white scale-105' 
                        : 'bg-[#1d2930] border-[#2e404a] text-gray-400 hover:bg-indigo-900/50 hover:text-indigo-300'
                    } border-2`}
                    title="Subir Vallas"
                  >
                    <span className="text-sm font-black">↑</span>
                  </button>
                  <button
                    onClick={async () => {
                      const newVal = !appPlc.Ob_Bajar_Vallas;
                      try {
                        await fetch('http://localhost:8001/plc/write', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ Ob_Bajar_Vallas: newVal, Ob_Subir_Vallas: false, is_force: true })
                        });
                      } catch(e) {}
                    }}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      appPlc.Ob_Bajar_Vallas 
                        ? 'bg-orange-500 border-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.6)] text-white scale-105' 
                        : 'bg-[#1d2930] border-[#2e404a] text-gray-400 hover:bg-orange-900/50 hover:text-orange-300'
                    } border-2`}
                    title="Bajar Vallas"
                  >
                    <span className="text-sm font-black">↓</span>
                  </button>
                </div>
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
