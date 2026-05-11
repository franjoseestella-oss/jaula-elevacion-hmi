import React, { useState } from 'react';
import { X, Cpu, TestTube, Network, Activity, Lightbulb, Zap, Play, CheckCircle2, PowerOff, RefreshCw, Settings, Database, Link as LinkIcon, Save, AlertTriangle } from 'lucide-react';
const PROJECT_VARS = [
  "Ob_Poner_Pegatina",
  "Ob_Abortar_Secuencia",
  "Ib_LUZ_Pulsador_1",
  "Ib_LUZ_Pulsador_2",
  "OW_Numero_Pallets",
  "Ob_Bit_VIDA_PLC_APP",
  "Ib_Bit_VIDA_APP_PLC",
  "OR_Altura_Carretilla"
];

const PROJECT_VAR_LABELS = {
  "Ob_Poner_Pegatina":    "Poner Pegatina",
  "Ob_Abortar_Secuencia": "Abortar Secuencia",
  "Ib_LUZ_Pulsador_1":    "Luz Pulsador 1",
  "Ib_LUZ_Pulsador_2":    "Luz Pulsador 2",
  "OW_Numero_Pallets":    "Número de Pallets",
  "Ob_Bit_VIDA_PLC_APP":  "Bit Vida (PLC → APP)",
  "Ib_Bit_VIDA_APP_PLC":  "Bit Vida (APP → PLC)",
  "OR_Altura_Carretilla": "Láser Altura Elevación"
};

const PROJECT_VAR_DEFAULT_DIR = {
  "Ob_Poner_Pegatina":    "OUT",
  "Ob_Abortar_Secuencia": "OUT",
  "Ib_LUZ_Pulsador_1":    "IN",
  "Ib_LUZ_Pulsador_2":    "IN",
  "OW_Numero_Pallets":    "OUT",
  "Ob_Bit_VIDA_PLC_APP":  "OUT",
  "Ib_Bit_VIDA_APP_PLC":  "IN",
  "OR_Altura_Carretilla": "OUT"
};

const PlcModal = ({ open, onClose, telemetry, isSimulation, setIsSimulation, pulsePlc }) => {
  const [outputs, setOutputs] = useState({ 
    Ib_LUZ_VERDE: false, Ib_LUZ_AZUL: false, Ib_LUZ_ROJA: false,
    Ib_LUZ_Pulsador_1: false, Ib_LUZ_Pulsador_2: false,
    Ib_Bit_VIDA_APP_PLC: false
  });
  const [analogs, setAnalogs] = useState({
    OR_Altura_Carretilla: 0,
    OW_Numero_Pallets: 0
  });

  const [forceMode, setForceMode] = useState(false);

  const [plcConfig, setPlcConfig] = useState(() => {
    const saved = localStorage.getItem('plcConfig');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      ip: '192.168.1.1',
      port: '4840',
      dbName: 'DB_App',
      namespace: '4'
    };
  });

  const [varMapping, setVarMapping] = useState(() => {
    const saved = localStorage.getItem('plcVarMapping');
    return saved ? JSON.parse(saved) : {};
  });

  const updateMappingFromAppVar = (appVar, newPlcKey, direction) => {
    const newMapping = { ...varMapping };
    // Eliminar mapeo previo de esta appVar (si estaba en otra plcKey)
    Object.keys(newMapping).forEach(key => {
      if (newMapping[key].appVar === appVar) delete newMapping[key];
    });
    if (newPlcKey) {
      newMapping[newPlcKey] = { appVar, direction: direction || PROJECT_VAR_DEFAULT_DIR[appVar] || 'IN' };
    }
    setVarMapping(newMapping);
    localStorage.setItem('plcVarMapping', JSON.stringify(newMapping));
  };

  // También usada internamente por updateMappingFromPlcKey (compatible con localStorage existente)
  const updateMappingFromPlcKey = (plcKey, newAppVar, direction) => {
    const newMapping = { ...varMapping };
    if (newAppVar) {
      newMapping[plcKey] = { appVar: newAppVar, direction: direction || (newAppVar.startsWith('O') ? 'OUT' : 'IN') };
    } else {
      delete newMapping[plcKey];
    }
    setVarMapping(newMapping);
    localStorage.setItem('plcVarMapping', JSON.stringify(newMapping));
  };

  const [isScanningIPs, setIsScanningIPs] = useState(false);
  const [isScanningDBs, setIsScanningDBs] = useState(false);
  const [scanModal, setScanModal] = useState({ isOpen: false, type: '', data: [] });

  const scanIPs = async () => {
    setIsScanningIPs(true);
    try {
      const res = await fetch('http://localhost:8001/plc/scan_ips', { cache: 'no-store' });
      if (!res.ok) throw new Error('Backend error');
      const text = await res.text();
      const data = text ? JSON.parse(text) : { ips: [] };
      setScanModal({ isOpen: true, type: 'IP', data: data.ips || [] });
    } catch (e) {
      console.error(e);
      setScanModal({ isOpen: true, type: 'IP', data: [], error: e.message });
    }
    setIsScanningIPs(false);
  };

  const scanDBs = async () => {
    setIsScanningDBs(true);
    try {
      const res = await fetch('http://localhost:8001/plc/browse_nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: plcConfig.ip, port: plcConfig.port })
      });
      if (!res.ok) throw new Error('Backend error');
      const text = await res.text();
      const data = text ? JSON.parse(text) : { nodes: [] };
      
      if (data.error) {
        setScanModal({ isOpen: true, type: 'DB', data: [], error: data.error });
      } else {
        setScanModal({ isOpen: true, type: 'DB', data: data.nodes || [] });
      }
    } catch (e) {
      console.error(e);
      setScanModal({ isOpen: true, type: 'DB', data: [], error: e.message });
    }
    setIsScanningDBs(false);
  };

  const lastWriteTime = React.useRef(0);

  // Sync state from backend si no estamos en modo simulación
  React.useEffect(() => {
    // Evitar parpadeos: no sincronizar la UI con la telemetría si acabamos de escribir (esperar 1 segundo)
    if (telemetry?.mappedPlc && !isSimulation && Date.now() - lastWriteTime.current > 1000) {
      setOutputs(prev => ({
        ...prev,
        Ib_LUZ_VERDE: !!telemetry.mappedPlc.Ib_LUZ_VERDE,
        Ib_LUZ_AZUL: !!telemetry.mappedPlc.Ib_LUZ_AZUL,
        Ib_LUZ_ROJA: !!telemetry.mappedPlc.Ib_LUZ_ROJA,
        Ib_LUZ_Pulsador_1: !!telemetry.mappedPlc.Ib_LUZ_Pulsador_1,
        Ib_LUZ_Pulsador_2: !!telemetry.mappedPlc.Ib_LUZ_Pulsador_2,
        Ib_Bit_VIDA_APP_PLC: !!telemetry.mappedPlc.Ib_Bit_VIDA_APP_PLC,
      }));
      setAnalogs({
        OR_Altura_Carretilla: telemetry.mappedPlc.OR_Altura_Carretilla || 0,
        OW_Numero_Pallets: telemetry.mappedPlc.OW_Numero_Pallets || 0
      });
    }
  }, [telemetry?.mappedPlc, isSimulation]);

  const sendWrite = async (payload) => {
    const newPayload = {};
    let shouldSend = false;
    
    if (payload.is_force !== undefined) {
       newPayload.is_force = payload.is_force;
    }
    
    if (isSimulation) {
       Object.assign(newPayload, payload);
       shouldSend = true;
    } else {
       Object.entries(payload).forEach(([key, value]) => {
          if (key === 'is_force') return;
          const found = Object.entries(varMapping).find(([k, v]) => v.appVar === key);
          if (found) {
             newPayload[found[0]] = value;
             shouldSend = true;
          }
       });
    }
    
    if (!shouldSend && !isSimulation) {
       console.log("Ignorando sendWrite: Variables no mapeadas al PLC.");
       return;
    }

    try {
      await fetch('http://localhost:8001/plc/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPayload)
      });
    } catch (e) { console.error("Error escribiendo en PLC", e); }
  };

  const saveConfig = async (simMode) => {
    try {
      localStorage.setItem('plcConfig', JSON.stringify(plcConfig));
      await fetch('http://localhost:8001/config/plc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...plcConfig,
          isSimulation: simMode
        })
      });
      console.log("Configuración PLC guardada y enviada al backend");
    } catch (e) { console.error("Error guardando config PLC", e); }
  };

  const handleToggleMode = () => {
    const nextSim = !isSimulation;
    setIsSimulation(nextSim);
    saveConfig(nextSim);
  };

  const handleToggleForceMode = async () => {
    const nextForce = !forceMode;
    setForceMode(nextForce);
    try {
      await fetch('http://localhost:8001/plc/force_mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextForce })
      });
    } catch (e) { console.error("Error setting force mode", e); }
  };

  if (!open) return null;

  const renderPlcVarTag = (varName) => null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(5,10,14,0.85)', backdropFilter: 'blur(5px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {scanModal.isOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#11191e] border border-[#2e404a] rounded-xl w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-[#2e404a] flex justify-between items-center bg-[#151f25]">
              <h3 className="text-white font-bold uppercase tracking-widest flex items-center gap-2 text-sm">
                {scanModal.type === 'IP' ? <Network size={16} className="text-blue-400" /> : <Database size={16} className="text-blue-400" />}
                {scanModal.type === 'IP' ? 'Dispositivos Encontrados' : 'Data Blocks Disponibles'}
              </h3>
              <button onClick={() => setScanModal({ isOpen: false, type: '', data: [] })} className="text-gray-400 hover:text-white p-1">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar">
              {scanModal.error ? (
                <div className="text-red-400 text-sm text-center py-6 flex flex-col items-center justify-center gap-2">
                   <AlertTriangle size={24} className="opacity-80"/>
                   <span className="font-bold uppercase tracking-widest text-[10px]">Error de Conexión</span>
                   <span className="text-[10px] opacity-80 break-words w-full text-center">{scanModal.error}</span>
                </div>
              ) : scanModal.data.length === 0 ? (
                <div className="text-gray-500 italic text-sm text-center py-6 flex flex-col items-center justify-center gap-2">
                   <AlertTriangle size={24} className="opacity-50"/>
                   <span>No se encontraron resultados.</span>
                </div>
              ) : (
                scanModal.data.map((item, idx) => (
                  <div 
                    key={idx}
                    onClick={() => {
                      if (scanModal.type === 'IP') setPlcConfig({...plcConfig, ip: item});
                      else setPlcConfig({...plcConfig, dbName: item});
                      setScanModal({ isOpen: false, type: '', data: [] });
                    }}
                    className="bg-[#1d2930] hover:bg-blue-600/20 hover:border-blue-500/50 border border-[#2e404a] p-3 rounded-lg cursor-pointer transition-colors flex items-center gap-3 group"
                  >
                    {scanModal.type === 'IP' ? <Network size={14} className="text-gray-400 group-hover:text-blue-400 transition-colors" /> : <Database size={14} className="text-gray-400 group-hover:text-blue-400 transition-colors" />}
                    <span className="text-sm font-bold text-white group-hover:text-blue-200 transition-colors">{item}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="relative w-[95vw] max-w-[1600px] max-h-[95vh] flex flex-col bg-gradient-to-b from-[#151f25] to-[#0d1a20] border border-[#2e404a] rounded-2xl shadow-[0_0_60px_rgba(34,197,94,0.15)] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e404a] bg-[#1d2930]/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-logisnext-slate/20 rounded-lg border border-logisnext-slate/40">
              <Cpu size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-black text-sm uppercase tracking-widest">
                Diagnóstico & Configuración PLC
              </h2>
              <span className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">
                Monitorización, Control y OPC UA
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Modo Simulación Toggle */}
            <button
              onClick={handleToggleMode}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-black uppercase tracking-wider transition-all shadow-md ${
                isSimulation 
                  ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50 hover:bg-yellow-500/30' 
                  : 'bg-green-500/20 text-green-500 border-green-500/50 hover:bg-green-500/30'
              }`}
            >
              {isSimulation ? (
                <><TestTube size={16} /> Modo Simulación</>
              ) : (
                <><Network size={16} /> Conectado a PLC</>
              )}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-[#2e404a] rounded-lg text-logisnext-lightslate hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar flex-1 w-full">
          
          <div className="grid grid-cols-12 gap-6 shrink-0">
          
          {/* Columna Izquierda: CONFIGURACIÓN */}
          <div className="col-span-3 flex flex-col gap-4">
            <h3 className="text-sm text-white font-bold uppercase tracking-widest border-b border-[#2e404a] pb-2 flex items-center gap-2">
              <Settings size={16} className="text-gray-400" /> 
              Configuración OPC UA
            </h3>
            
            <div className="flex flex-col gap-4 bg-[#0a0f12]/60 border border-[#2e404a] rounded-xl p-5">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">IP del Servidor (PLC)</label>
                  <button onClick={scanIPs} disabled={isScanningIPs} className="text-[9px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-widest flex items-center gap-1">
                    <RefreshCw size={10} className={isScanningIPs ? "animate-spin" : ""} /> {isScanningIPs ? "Buscando..." : "Escanear Red"}
                  </button>
                </div>
                <div className="relative">
                  <Network className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                  <input 
                    type="text" 
                    value={plcConfig.ip}
                    onChange={(e) => setPlcConfig({...plcConfig, ip: e.target.value})}
                    className="w-full bg-[#1d2930] border border-[#2e404a] rounded-lg py-2 pl-9 pr-3 text-xs text-white focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">Puerto OPC UA</label>
                <input 
                  type="text" 
                  value={plcConfig.port}
                  onChange={(e) => setPlcConfig({...plcConfig, port: e.target.value})}
                  className="w-full bg-[#1d2930] border border-[#2e404a] rounded-lg py-2 px-3 text-xs text-white focus:border-blue-500 outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">Nombre Data Block (DB)</label>
                  <button onClick={scanDBs} disabled={isScanningDBs} className="text-[9px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-widest flex items-center gap-1">
                    <RefreshCw size={10} className={isScanningDBs ? "animate-spin" : ""} /> {isScanningDBs ? "Consultando..." : "Buscar en PLC"}
                  </button>
                </div>
                <div className="relative">
                  <Database className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                  <input 
                    type="text" 
                    value={plcConfig.dbName}
                    onChange={(e) => setPlcConfig({...plcConfig, dbName: e.target.value})}
                    className="w-full bg-[#1d2930] border border-[#2e404a] rounded-lg py-2 pl-9 pr-3 text-xs text-white focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">Namespace (ns)</label>
                <input 
                  type="text" 
                  value={plcConfig.namespace}
                  onChange={(e) => setPlcConfig({...plcConfig, namespace: e.target.value})}
                  className="w-full bg-[#1d2930] border border-[#2e404a] rounded-lg py-2 px-3 text-xs text-white focus:border-blue-500 outline-none"
                />
              </div>

              <div className="mt-4 pt-4 border-t border-[#2e404a] flex flex-col gap-2">
                <button 
                  onClick={() => saveConfig(isSimulation)}
                  className="w-full py-2 bg-[#1d2930] hover:bg-[#2e404a] text-white rounded-lg text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors border border-[#2e404a]"
                >
                  <Save size={14} /> Guardar Configuración
                </button>

                {isSimulation ? (
                  <button 
                    onClick={() => {
                      setIsSimulation(false);
                      saveConfig(false);
                    }}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors shadow-[0_0_15px_rgba(37,99,235,0.4)] mt-2"
                  >
                    <LinkIcon size={16} /> Conectar al PLC
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      setIsSimulation(true);
                      saveConfig(true);
                    }}
                    className="w-full py-3 bg-red-600/80 hover:bg-red-500 text-white rounded-lg text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors mt-2"
                  >
                    <PowerOff size={16} /> Desconectar (Modo Simulación)
                  </button>
                )}
              </div>

              <div className="mt-2 p-3 bg-gray-500/10 border border-gray-500/20 rounded-lg text-[10px] text-gray-400 leading-relaxed">
                Esta configuración indica a la aplicación Python dónde encontrar el Servidor OPC UA y en qué DB de Siemens se exponen las variables de la máquina.
              </div>

              {!isSimulation && (
                <div className={`mt-2 p-3 border rounded-lg text-[10px] font-bold uppercase tracking-widest text-center transition-all flex flex-col gap-1 items-center ${
                  telemetry?.opcua_connected 
                    ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                    : (!telemetry?.opcua_error)
                      ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                      : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}>
                  <div className="flex items-center gap-2">
                    {telemetry?.opcua_connected ? (
                      <CheckCircle2 size={14} />
                    ) : (!telemetry?.opcua_error) ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <AlertTriangle size={14} />
                    )}
                    
                    {telemetry?.opcua_connected 
                      ? 'OPC UA Conectado' 
                      : (!telemetry?.opcua_error) 
                        ? 'Diagnosticando Conexión...' 
                        : 'OPC UA Desconectado'}
                  </div>
                  {telemetry?.opcua_error && (
                    <>
                      <div className="text-[8px] font-mono normal-case opacity-70 mt-1">
                        {telemetry.opcua_error}
                      </div>
                      {telemetry.opcua_error.toLowerCase().includes('securit') && (
                        <div className="text-[9px] text-yellow-500/90 mt-1">
                          ⚠️ Recuerda aprobar el certificado en TIA Portal (Security &gt; Certificate manager) para permitir la conexión.
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Columna Centro: ENTRADAS */}
          <div className="col-span-5 flex flex-col gap-4">
            <h3 className="text-sm text-white font-bold uppercase tracking-widest border-b border-[#2e404a] pb-2 flex items-center gap-2">
              <Activity size={16} className="text-blue-400" /> 
              Entradas (PLC &rarr; APP)
            </h3>
            
            <div className="flex flex-col gap-3 bg-[#0a0f12]/60 border border-[#2e404a] rounded-xl p-5 h-full overflow-y-auto">
              
              {/* Botonera de pulsadores simulada */}
              <div className="mb-4 bg-[#1d2930]/40 border border-[#2e404a] rounded-xl p-4">
                <h4 className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest mb-4 border-b border-[#2e404a] pb-2">
                  Pulsadores de Control (Físicos en Máquina)
                </h4>
                <div className="flex justify-between items-start px-2">
                  
                  <div className="flex flex-col items-center">
                    <button
                      disabled={!isSimulation}
                      onClick={() => pulsePlc('Ob_Iniciar_Secuencia')}
                      className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transition-all ${!isSimulation ? 'bg-[#1d2930] border-[#2e404a] opacity-50 cursor-not-allowed' : 'bg-gradient-to-b from-green-500 to-green-700 active:from-green-700 active:to-green-900 border-[#1d2930] shadow-[0_4px_10px_rgba(34,197,94,0.3)] active:scale-95 active:shadow-inner'}`}
                    >
                      <Play size={18} className={`${!isSimulation ? 'text-gray-500' : 'text-white ml-1'}`} />
                    </button>
                    <span className="mt-2 text-[9px] font-black uppercase text-gray-400 tracking-wider text-center">Iniciar<br/>Secuencia</span>
                    {renderPlcVarTag('Ob_Iniciar_Secuencia')}
                  </div>

                  <div className="flex flex-col items-center">
                    <button
                      disabled={!isSimulation}
                      onClick={() => pulsePlc('Ob_Poner_Pegatina')}
                      className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transition-all ${!isSimulation ? 'bg-[#1d2930] border-[#2e404a] opacity-50 cursor-not-allowed' : 'bg-gradient-to-b from-blue-500 to-blue-700 active:from-blue-700 active:to-blue-900 border-[#1d2930] shadow-[0_4px_10px_rgba(59,130,246,0.3)] active:scale-95 active:shadow-inner'}`}
                    >
                      <CheckCircle2 size={20} className={`${!isSimulation ? 'text-gray-500' : 'text-white'}`} />
                    </button>
                    <span className="mt-2 text-[9px] font-black uppercase text-gray-400 tracking-wider text-center">Pegatina<br/>Colocada</span>
                    {renderPlcVarTag('Ob_Poner_Pegatina')}
                  </div>

                  <div className="flex flex-col items-center">
                    <button
                      disabled={!isSimulation}
                      onClick={() => pulsePlc('Ob_Abortar_Secuencia')}
                      className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transition-all ${!isSimulation ? 'bg-[#1d2930] border-[#2e404a] opacity-50 cursor-not-allowed' : 'bg-gradient-to-b from-red-500 to-red-700 active:from-red-700 active:to-red-900 border-[#1d2930] shadow-[0_4px_10px_rgba(239,68,68,0.3)] active:scale-95 active:shadow-inner'}`}
                    >
                      <PowerOff size={18} className={`${!isSimulation ? 'text-gray-500' : 'text-white'}`} />
                    </button>
                    <span className="mt-2 text-[9px] font-black uppercase text-gray-400 tracking-wider text-center">Abortar<br/>Secuencia</span>
                    {renderPlcVarTag('Ob_Abortar_Secuencia')}
                  </div>

                </div>
              </div>

              {[
                { id: 'Ob_Bit_VIDA_PLC_APP', label: 'BIT VIDA (PLC → APP)', isAnalog: false, canSimulateClick: true },
                { id: 'OR_Altura_Carretilla', label: 'Láser Altura Elevación', isAnalog: true, unit: 'mm' },
                { id: 'OW_Numero_Pallets', label: 'Número de Pallets (Carga)', isAnalog: true, unit: ' uds' }
              ].map((sensor) => {
                const value = telemetry?.plc ? telemetry.plc[sensor.id] : undefined;
                const active = !!value; // Para los digitales

                return (
                  <div key={sensor.id} className="flex items-center justify-between bg-[#1d2930]/40 border border-[#2e404a] p-3 rounded-xl hover:bg-[#1d2930]/60 transition-colors">
                    <div className="flex flex-col">
                      <span className="text-xs text-white font-bold uppercase tracking-widest">{sensor.label}</span>
                      {renderPlcVarTag(sensor.id)}
                    </div>
                    
                    {sensor.isAnalog ? (
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-sm font-black text-blue-400 bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20 shadow-inner">
                          {(() => {
                            let val = isSimulation ? Number(analogs[sensor.id] || 0) : (value !== undefined ? Number(value) : null);
                            if (val === null) return '---';
                            if (sensor.id === 'OR_Altura_Carretilla') {
                              return (val / 1000).toFixed(2);
                            }
                            return val.toFixed(0);
                          })()} <span className="text-[10px] text-blue-400/70">{sensor.id === 'OR_Altura_Carretilla' ? 'm' : sensor.unit.trim()}</span>
                          {sensor.id === 'OW_Numero_Pallets' && (
                            <span className="ml-2 text-xs text-yellow-400 font-bold">
                              ({(isSimulation ? Number(analogs[sensor.id] || 0) : (value !== undefined ? Number(value) : 0)) * 250} kg)
                            </span>
                          )}
                        </span>
                      </div>
                    ) : (
                      <div 
                        className={`flex items-center gap-3 ${isSimulation && sensor.canSimulateClick ? 'cursor-pointer hover:opacity-80' : ''}`}
                        onClick={() => {
                          if (isSimulation && sensor.canSimulateClick) {
                            sendWrite({ [sensor.id]: !active });
                          }
                        }}
                      >
                        {isSimulation && sensor.canSimulateClick && (
                          <span className="text-[9px] text-gray-500 bg-[#0a0f12] px-1.5 py-0.5 rounded border border-[#2e404a]">FORZAR</span>
                        )}
                        <span className={`text-[10px] font-black uppercase ${active ? (sensor.isDanger ? 'text-red-400' : 'text-green-400') : 'text-gray-500'}`}>
                          {active ? 'Activo' : 'Reposo'}
                        </span>
                        <div className={`w-4 h-4 rounded-full border-2 transition-all ${
                          active 
                            ? (sensor.isDanger ? 'bg-red-500 border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.6)]' : 'bg-green-500 border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.6)]') 
                            : 'bg-[#0a0f12] border-[#2e404a]'
                        }`} />
                      </div>
                    )}
                  </div>
                );
              })}



            </div>
          </div>

          {/* Columna Derecha: SALIDAS */}
          <div className="col-span-4 flex flex-col gap-4">
            <h3 className="text-sm text-white font-bold uppercase tracking-widest border-b border-[#2e404a] pb-2 flex items-center gap-2">
              <Zap size={16} className="text-yellow-400" /> 
              Salidas (APP &rarr; PLC)
            </h3>
            
            <div className="flex flex-col gap-4 bg-[#0a0f12]/60 border border-[#2e404a] rounded-xl p-5 h-full overflow-y-auto">
              {!isSimulation && (
                <div className="mb-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300 font-bold uppercase tracking-widest text-center">
                  Controlado por PLC real
                </div>
              )}
              {isSimulation && (
                <div className="mb-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-yellow-300 font-bold uppercase tracking-widest text-center">
                  Modo test: forzado manual habilitado
                </div>
              )}
              
              {!isSimulation && (
                <div className="mb-4 flex flex-col gap-2">
                  <button
                    onClick={handleToggleForceMode}
                    className={`w-full py-3 rounded-xl border-2 font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${
                      forceMode 
                        ? 'bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]' 
                        : 'bg-logisnext-slate/10 border-logisnext-slate/30 text-logisnext-lightslate hover:bg-logisnext-slate/20'
                    }`}
                  >
                    <Zap size={18} className={forceMode ? 'animate-pulse' : ''} />
                    {forceMode ? 'Deshabilitar Forzado' : 'Habilitar Forzado Manual'}
                  </button>
                  {forceMode && (
                    <div className="text-[9px] text-red-400 font-bold uppercase tracking-tighter text-center animate-pulse">
                      ¡Atención! Control manual directo sobre PLC habilitado
                    </div>
                  )}
                </div>
              )}

              <div className="grid gap-4 overflow-y-auto pr-2 pb-2">
                
                {['VERDE', 'AZUL', 'ROJA'].map((color) => {
                  const prop = `Ib_LUZ_${color}`;
                  const isActive = outputs[prop];
                  const colorMap = {
                    VERDE: 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)] border-green-400',
                    AZUL: 'bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)] border-blue-400',
                    ROJA: 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)] border-red-400',
                  };
                  
                  return (
                    <div key={color} className="flex flex-col">
                      <button
                        disabled={!isSimulation && !forceMode}
                        onClick={() => {
                          const newOutputs = { ...outputs, Ib_LUZ_VERDE: false, Ib_LUZ_AZUL: false, Ib_LUZ_ROJA: false };
                          if (!isActive) newOutputs[prop] = true;
                          
                          setOutputs(newOutputs);
                          lastWriteTime.current = Date.now();
                          sendWrite({ Ib_LUZ_VERDE: false, Ib_LUZ_AZUL: false, Ib_LUZ_ROJA: false, [prop]: newOutputs[prop], is_force: true });
                        }}
                        className={`relative flex items-center justify-between p-4 border rounded-xl transition-all duration-300 ${
                          (!isSimulation && !forceMode) 
                            ? 'opacity-30 cursor-not-allowed border-[#2e404a] bg-[#0a0f12]' 
                            : isActive 
                              ? `${colorMap[color]} text-white transform scale-[1.02]` 
                              : 'border-[#2e404a] bg-[#1d2930] hover:border-[#5d7a8a] text-logisnext-lightslate'
                        }`}
                      >
                        <div className="flex items-center gap-3 z-10">
                          <Lightbulb size={20} className={isActive ? 'text-white animate-pulse' : ''} />
                          <div className="flex flex-col items-start">
                            <span className="text-sm font-black uppercase tracking-widest">BALIZA {color}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 z-10">
                          <span className="text-[10px] font-bold uppercase">{isActive ? 'Activado' : 'Apagado'}</span>
                          <div className={`w-8 h-4 rounded-full border border-white/20 transition-all flex p-0.5 ${isActive ? 'bg-white/30 justify-end' : 'bg-black/40 justify-start'}`}>
                            <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                          </div>
                        </div>
                        {/* Background glow if active */}
                        {isActive && <div className="absolute inset-0 bg-white/10 rounded-xl" />}
                      </button>
                      <div className="ml-2 mt-1">
                        {renderPlcVarTag(prop)}
                      </div>
                    </div>
                  );
                })}

                {/* Botones LUZ Pulsadores */}
                {['1', '2'].map((num) => {
                  const prop = `Ib_LUZ_Pulsador_${num}`;
                  const isActive = outputs[prop];
                  
                  return (
                    <div key={`pulsador_${num}`} className="flex flex-col">
                      <button
                        disabled={!isSimulation && !forceMode}
                        onClick={() => {
                          const newValue = !isActive;
                          const newOutputs = { ...outputs, [prop]: newValue };
                          setOutputs(newOutputs);
                          lastWriteTime.current = Date.now();
                          sendWrite({ [prop]: newValue, is_force: true });
                        }}
                        className={`relative flex items-center justify-between p-4 border rounded-xl transition-all duration-300 ${
                          (!isSimulation && !forceMode) 
                            ? 'opacity-30 cursor-not-allowed border-[#2e404a] bg-[#0a0f12]' 
                            : isActive 
                              ? `bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.5)] border-yellow-400 text-white transform scale-[1.02]` 
                              : 'border-[#2e404a] bg-[#1d2930] hover:border-yellow-500/50 text-logisnext-lightslate hover:text-yellow-400'
                        }`}
                      >
                        <div className="flex items-center gap-3 z-10">
                          <Lightbulb size={20} className={isActive ? 'text-white animate-pulse' : ''} />
                          <div className="flex flex-col items-start">
                            <span className="text-sm font-black uppercase tracking-widest">Boton Luz {num}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 z-10">
                          <span className="text-[10px] font-bold uppercase">{isActive ? 'Activado' : 'Apagado'}</span>
                          <div className={`w-8 h-4 rounded-full border border-white/20 transition-all flex p-0.5 ${isActive ? 'bg-white/30 justify-end' : 'bg-black/40 justify-start'}`}>
                            <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                          </div>
                        </div>
                        {isActive && <div className="absolute inset-0 bg-white/10 rounded-xl" />}
                      </button>
                      <div className="ml-2 mt-1">
                        {renderPlcVarTag(prop)}
                      </div>
                    </div>
                  );
                })}

                {/* BIT VIDA APP */}
                <div className="flex flex-col mt-2">
                  <div className={`relative flex items-center justify-between p-4 border rounded-xl transition-all duration-300 border-[#2e404a] bg-[#0a0f12]`}>
                    <div className="flex items-center gap-3 z-10">
                      <Activity size={20} className={(!isSimulation ? telemetry?.mappedPlc?.Ib_Bit_VIDA_APP_PLC : telemetry?.plc?.Ib_Bit_VIDA_APP_PLC) ? 'text-cyan-400 animate-pulse' : 'text-gray-600'} />
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-black uppercase tracking-widest text-white">BIT VIDA APP (APP&rarr;PLC)</span>
                        <span className="text-[9px] text-gray-500">Oscilador automático (1Hz)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 z-10">
                      <div className={`w-3 h-3 rounded-full transition-all ${(!isSimulation ? telemetry?.mappedPlc?.Ib_Bit_VIDA_APP_PLC : telemetry?.plc?.Ib_Bit_VIDA_APP_PLC) ? 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]' : 'bg-[#1d2930]'}`}></div>
                    </div>
                  </div>
                  <div className="ml-2 mt-1">
                    {renderPlcVarTag('Ib_Bit_VIDA_APP_PLC')}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* MAPEO DE VARIABLES DEL PROYECTO */}
        <div className="flex flex-col h-[400px] shrink-0">
          <h4 className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mb-3 flex items-center justify-between">
            <span>Configuración de Variables — Asignar PLC a Proyecto</span>
            <span className="bg-[#2e404a]/50 px-2 py-0.5 rounded text-white text-[9px]">
              {Object.values(varMapping).filter(m => m.appVar).length}/{PROJECT_VARS.length} MAPEADAS
            </span>
          </h4>
          
          <div className="bg-[#0a0f12] rounded-xl border border-[#2e404a] flex-1 overflow-y-auto shadow-inner">
            <table className="w-full text-left text-[10px] text-gray-300">
              <thead className="bg-[#1d2930] sticky top-0 border-b border-[#2e404a] z-10 shadow-md">
                <tr>
                  <th className="p-2 px-4 font-bold uppercase tracking-wider w-[28%]">Variable Proyecto</th>
                  <th className="p-2 px-4 font-bold uppercase tracking-wider w-[32%]">Variable PLC (Data Block)</th>
                  <th className="p-2 px-4 font-bold uppercase tracking-wider w-[15%]">APP → PLC</th>
                  <th className="p-2 px-4 font-bold uppercase tracking-wider text-right w-[25%]">Valor Real</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2e404a]/50">
                {PROJECT_VARS.map(appVar => {
                  const mappingEntry = Object.entries(varMapping).find(([k, v]) => v.appVar === appVar);
                  const plcKey   = mappingEntry ? mappingEntry[0] : '';
                  const direction = mappingEntry ? mappingEntry[1].direction : PROJECT_VAR_DEFAULT_DIR[appVar] || 'IN';
                  const plcKeys  = telemetry?.plc ? Object.keys(telemetry.plc).sort((a,b) => a.localeCompare(b)) : [];
                  const value    = plcKey && telemetry?.plc ? telemetry.plc[plcKey] : null;
                  const isMapped = !!plcKey;

                  return (
                    <tr key={appVar} className="hover:bg-[#1d2930]/50 transition-colors group">

                      {/* Nombre descriptivo */}
                      <td className="p-2 px-4">
                        <span className="font-bold uppercase tracking-wide text-[11px] text-white">
                          {PROJECT_VAR_LABELS[appVar]}
                        </span>
                      </td>

                      {/* Dropdown con las variables reales del PLC */}
                      <td className="p-2 px-4">
                        <select
                          value={plcKey}
                          onChange={(e) => updateMappingFromAppVar(appVar, e.target.value, direction)}
                          className="w-full bg-[#1d2930] border border-[#2e404a] text-white rounded p-1 text-[10px] outline-none focus:border-blue-500 transition-colors"
                        >
                          <option value="">-- Ninguna --</option>
                          {plcKeys.map(k => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
                        {plcKeys.length === 0 && (
                          <span className="text-[9px] text-gray-600 italic">Sin conexión OPC UA</span>
                        )}
                      </td>

                      {/* Dirección */}
                      <td className="p-2 px-4">
                        <select
                          value={direction}
                          onChange={(e) => updateMappingFromAppVar(appVar, plcKey, e.target.value)}
                          className="w-full bg-[#1d2930] border border-[#2e404a] text-white rounded p-1 text-[10px] outline-none focus:border-blue-500"
                        >
                          <option value="IN">IN (Lectura)</option>
                          <option value="OUT">OUT (Escritura)</option>
                        </select>
                      </td>

                      {/* Valor real */}
                      <td className="p-2 px-4 text-right font-mono font-bold">
                        {typeof value === 'boolean'
                          ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className={`text-base font-black ${value ? 'text-green-400' : 'text-gray-400'}`}>{value ? 'TRUE' : 'FALSE'}</span>
                              <div className={`w-3 h-3 rounded-full ${value ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.9)]' : 'bg-gray-600'}`} />
                            </div>
                          )
                          : <span className="text-base font-black text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded">
                              {value !== null && value !== undefined ? value.toString() : '---'}
                            </span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      </div>
    </div>
  );
};

export default PlcModal;
