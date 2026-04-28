import React, { useState } from 'react';
import { X, Cpu, TestTube, Network, Activity, Lightbulb, Zap } from 'lucide-react';

const PlcModal = ({ open, onClose, telemetry, isSimulation, setIsSimulation }) => {
  const [outputs, setOutputs] = useState({ 
    Ob_LUZ_VERDE: false, Ob_LUZ_AZUL: false, Ob_LUZ_ROJA: false,
    Ob_Subir_Vallas: false, Ob_Bajar_Vallas: false 
  });
  const [analogs, setAnalogs] = useState({
    OW_Altura_Elevacion: 0,
    OW_Pallet: 0
  });

  // Sync state from backend si no estamos en modo simulación
  React.useEffect(() => {
    if (telemetry?.plc && !isSimulation) {
      setOutputs({
        Ob_LUZ_VERDE: !!telemetry.plc.Ob_LUZ_VERDE,
        Ob_LUZ_AZUL: !!telemetry.plc.Ob_LUZ_AZUL,
        Ob_LUZ_ROJA: !!telemetry.plc.Ob_LUZ_ROJA,
        Ob_Subir_Vallas: !!telemetry.plc.Ob_Subir_Vallas,
        Ob_Bajar_Vallas: !!telemetry.plc.Ob_Bajar_Vallas,
      });
      setAnalogs({
        OW_Altura_Elevacion: telemetry.plc.OW_Altura_Elevacion || 0,
        OW_Pallet: telemetry.plc.OW_Pallet || 0
      });
    }
  }, [telemetry?.plc, isSimulation]);

  const sendWrite = async (payload) => {
    try {
      await fetch('http://localhost:8001/plc/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) { console.error("Error escribiendo en PLC", e); }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(5,10,14,0.85)', backdropFilter: 'blur(5px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-[800px] flex flex-col bg-gradient-to-b from-[#151f25] to-[#0d1a20] border border-[#2e404a] rounded-2xl shadow-[0_0_60px_rgba(34,197,94,0.15)] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e404a] bg-[#1d2930]/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-logisnext-slate/20 rounded-lg border border-logisnext-slate/40">
              <Cpu size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-black text-sm uppercase tracking-widest">
                Diagnóstico PLC
              </h2>
              <span className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">
                Monitorización y Control de E/S
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Modo Simulación Toggle */}
            <button
              onClick={() => setIsSimulation(!isSimulation)}
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
        <div className="p-6 flex gap-6">
          
          {/* Columna Izquierda: ENTRADAS */}
          <div className="flex-1 flex flex-col gap-4">
            <h3 className="text-sm text-white font-bold uppercase tracking-widest border-b border-[#2e404a] pb-2 flex items-center gap-2">
              <Activity size={16} className="text-blue-400" /> 
              Entradas (PLC &rarr; APP)
            </h3>
            
            <div className="flex flex-col gap-3 bg-[#0a0f12]/60 border border-[#2e404a] rounded-xl p-5 h-full">
              {[
                { id: 'OW_Altura_Elevacion', label: 'Láser Altura Elevación', isAnalog: true, unit: 'mm' },
                { id: 'OW_Pallet', label: 'Láser Altura Pallet', isAnalog: true, unit: 'mm' },
                { id: 'Ob_Inciar_Secuencia', label: 'Botón Iniciar Secuencia', isAnalog: false, canSimulateClick: true },
                { id: 'Ob_Repetir_Secuencia', label: 'Botón Repetir Secuencia', isAnalog: false, canSimulateClick: true },
                { id: 'Ob_Abortar_Secuancia', label: 'Botón Abortar Secuencia', isAnalog: false, isDanger: true, canSimulateClick: true },
                { id: 'Ob_Dtec_Valla_1_trabajo_LH', label: 'Valla 1 Trabajo LH', isAnalog: false },
                { id: 'Ob_Dtec_Valla_1_Reposo_LH', label: 'Valla 1 Reposo LH', isAnalog: false },
                { id: 'Ob_Dtec_Valla_2_trabajo_RH', label: 'Valla 2 Trabajo RH', isAnalog: false },
                { id: 'Ob_Dtec_Valla_2_Reposo_RH', label: 'Valla 2 Reposo RH', isAnalog: false }
              ].map((sensor) => {
                const value = telemetry?.plc ? telemetry.plc[sensor.id] : undefined;
                const active = !!value; // Para los digitales

                return (
                  <div key={sensor.id} className="flex items-center justify-between bg-[#1d2930]/40 border border-[#2e404a] p-4 rounded-xl">
                    <span className="text-xs text-white font-bold uppercase tracking-widest">{sensor.label}</span>
                    
                    {sensor.isAnalog ? (
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-sm font-black text-blue-400 bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20 shadow-inner">
                          {(() => {
                            let val = isSimulation ? Number(analogs[sensor.id] || 0) : (value !== undefined ? Number(value) : null);
                            if (val === null) return '---';
                            if (sensor.id === 'OW_Altura_Elevacion') val = Math.max(0, val - 1180);
                            // Convertir ambos sensores a metros (dividiendo por 1000)
                            return (val / 1000).toFixed(2);
                          })()} <span className="text-[10px] text-blue-400/70">m</span>
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
          <div className="flex-1 flex flex-col gap-4">
            <h3 className="text-sm text-white font-bold uppercase tracking-widest border-b border-[#2e404a] pb-2 flex items-center gap-2">
              <Zap size={16} className="text-yellow-400" /> 
              Salidas (APP &rarr; PLC)
            </h3>
            
            <div className="flex flex-col gap-4 bg-[#0a0f12]/60 border border-[#2e404a] rounded-xl p-5 h-full">
              {!isSimulation && (
                <div className="mb-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300 font-bold uppercase tracking-widest text-center">
                  Salidas controladas por el PLC real
                </div>
              )}
              {isSimulation && (
                <div className="mb-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-yellow-300 font-bold uppercase tracking-widest text-center">
                  Modo test: forzado de relés habilitado
                </div>
              )}

              <div className="grid gap-4 overflow-y-auto pr-2 pb-2">
                
                {/* Botones de Vallas (Solo simulación) */}
                <div className="flex gap-3 mb-2">
                  <button
                    disabled={!isSimulation}
                    onClick={() => {
                      if (!isSimulation) return;
                      const newOutputs = { ...outputs, Ob_Subir_Vallas: true, Ob_Bajar_Vallas: false };
                      setOutputs(newOutputs);
                      sendWrite({ Ob_Subir_Vallas: true, Ob_Bajar_Vallas: false });
                    }}
                    className={`flex-1 flex flex-col items-center justify-center p-3 border rounded-xl transition-all duration-300 ${
                      !isSimulation ? 'opacity-40 cursor-not-allowed border-[#2e404a] bg-[#1d2930]' : outputs.Ob_Subir_Vallas ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'border-[#2e404a] bg-[#1d2930] hover:border-indigo-500/50 text-logisnext-lightslate hover:text-indigo-400'
                    }`}
                  >
                    <span className="text-xs font-black uppercase tracking-widest">Subir Vallas</span>
                  </button>
                  <button
                    disabled={!isSimulation}
                    onClick={() => {
                      if (!isSimulation) return;
                      const newOutputs = { ...outputs, Ob_Subir_Vallas: false, Ob_Bajar_Vallas: true };
                      setOutputs(newOutputs);
                      sendWrite({ Ob_Subir_Vallas: false, Ob_Bajar_Vallas: true });
                    }}
                    className={`flex-1 flex flex-col items-center justify-center p-3 border rounded-xl transition-all duration-300 ${
                      !isSimulation ? 'opacity-40 cursor-not-allowed border-[#2e404a] bg-[#1d2930]' : outputs.Ob_Bajar_Vallas ? 'bg-orange-500/20 border-orange-500 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : 'border-[#2e404a] bg-[#1d2930] hover:border-orange-500/50 text-logisnext-lightslate hover:text-orange-400'
                    }`}
                  >
                    <span className="text-xs font-black uppercase tracking-widest">Bajar Vallas</span>
                  </button>
                </div>

                {['VERDE', 'AZUL', 'ROJA'].map((color) => {
                  const prop = `Ob_LUZ_${color}`;
                  const isActive = outputs[prop];
                  const colorMap = {
                    VERDE: 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)] border-green-400',
                    AZUL: 'bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)] border-blue-400',
                    ROJA: 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)] border-red-400',
                  };
                  
                  return (
                    <button
                      key={color}
                      disabled={!isSimulation}
                      onClick={() => {
                        if (!isSimulation) return;
                        const newOutputs = { ...outputs, Ob_LUZ_VERDE: false, Ob_LUZ_AZUL: false, Ob_LUZ_ROJA: false };
                        if (!isActive) newOutputs[prop] = true;
                        
                        setOutputs(newOutputs);
                        sendWrite({ Ob_LUZ_VERDE: false, Ob_LUZ_AZUL: false, Ob_LUZ_ROJA: false, [prop]: newOutputs[prop] });
                      }}
                      className={`relative flex items-center justify-between p-4 border rounded-xl transition-all duration-300 ${
                        !isSimulation 
                          ? 'opacity-40 cursor-not-allowed border-[#2e404a] bg-[#1d2930]' 
                          : isActive 
                            ? `${colorMap[color]} text-white transform scale-[1.02]` 
                            : 'border-[#2e404a] bg-[#1d2930] hover:border-[#5d7a8a] text-logisnext-lightslate'
                      }`}
                    >
                      <div className="flex items-center gap-3 z-10">
                        <Lightbulb size={20} className={isActive ? 'text-white animate-pulse' : ''} />
                        <span className="text-sm font-black uppercase tracking-widest">BALIZA {color}</span>
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
                  );
                })}
              </div>
            </div>
          </div>
          
        </div>

      </div>
    </div>
  );
};

export default PlcModal;
