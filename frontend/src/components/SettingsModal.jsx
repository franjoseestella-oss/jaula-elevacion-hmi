import React, { useState } from 'react';
import { X, Settings, Network, Usb, Save, TestTube, Cpu, Activity, Lightbulb, Box, Upload } from 'lucide-react';
import ObjViewer from './ObjViewer';

const SettingsModal = ({ open, onClose, telemetry }) => {
  const [activeTab, setActiveTab] = useState('datalogic');
  const [connType, setConnType] = useState('tcp');
  const [ip, setIp] = useState('192.168.0.50');
  const [port, setPort] = useState('5025');
  const [comPort, setComPort] = useState('COM3');
  const [baudRate, setBaudRate] = useState('115200');
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSimulation, setIsSimulation] = useState(true);

  // Archivos 3D
  const [objFile, setObjFile] = useState(null);
  const [mtlFile, setMtlFile] = useState(null);

  // Estados de tolerancia (se guardan en localStorage para persistencia)
  const [toleranciaPositiva, setToleranciaPositiva] = useState(() => parseInt(localStorage.getItem('toleranciaPositiva')) || 50);
  const [toleranciaNegativa, setToleranciaNegativa] = useState(() => parseInt(localStorage.getItem('toleranciaNegativa')) || 50);

  // Parámetros Prueba 5 minutos
  const [test5mDuration, setTest5mDuration] = useState(() => parseInt(localStorage.getItem('test5mDuration')) || 300);
  const [test5mTolerancia, setTest5mTolerancia] = useState(() => parseInt(localStorage.getItem('test5mTolerancia')) || 15);

  // Estado local para las salidas del PLC
  const [luces, setLuces] = useState({ Ib_LUZ_VERDE: false, Ib_LUZ_AZUL: false, Ib_LUZ_ROJA: false });

  // Sincronizar el estado local con la telemetría real del backend
  React.useEffect(() => {
    const activePlc = telemetry?.mappedPlc || telemetry?.plc;
    if (activePlc) {
      setLuces({
        Ib_LUZ_VERDE: !!activePlc.Ib_LUZ_VERDE,
        Ib_LUZ_AZUL: !!activePlc.Ib_LUZ_AZUL,
        Ib_LUZ_ROJA: !!activePlc.Ib_LUZ_ROJA,
      });
    }
  }, [telemetry?.mappedPlc, telemetry?.plc]);

  if (!open) return null;

  const handleSave = () => {
    // Aquí se enviaría la configuración al backend
    console.log("Guardando config Datalogic:", { connType, ip, port, comPort, baudRate });
    localStorage.setItem('toleranciaPositiva', toleranciaPositiva);
    localStorage.setItem('toleranciaNegativa', toleranciaNegativa);
    localStorage.setItem('test5mDuration', test5mDuration);
    localStorage.setItem('test5mTolerancia', test5mTolerancia);
    // Notificar al sistema para actualizar tolerancias si es necesario
    window.dispatchEvent(new Event('toleranciaChanged'));
    window.dispatchEvent(new Event('test5mConfigChanged'));
    onClose();
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('http://localhost:8001/config/datalogic/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connType, ip, port, comPort, baudRate })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ status: 'error', message: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(5,10,14,0.85)', backdropFilter: 'blur(5px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-[900px] flex flex-col bg-gradient-to-b from-[#151f25] to-[#0d1a20] border border-[#2e404a] rounded-2xl shadow-[0_0_60px_rgba(221,40,118,0.15)] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e404a] bg-[#1d2930]/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-logisnext-slate/20 rounded-lg border border-logisnext-slate/40">
              <Settings size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-black text-sm uppercase tracking-widest">
                Configuración del Sistema
              </h2>
              <span className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">
                Preferencias y Dispositivos
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#2e404a] rounded-lg text-logisnext-lightslate hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-row h-[600px]">
          {/* Sidebar Tabs */}
          <div className="w-48 border-r border-[#2e404a] bg-[#0a0f12]/50 p-4 flex flex-col gap-2">
            <button
              onClick={() => setActiveTab('datalogic')}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'datalogic'
                  ? 'bg-logisnext-magenta/20 text-logisnext-magenta border border-logisnext-magenta/30'
                  : 'text-logisnext-slate hover:bg-[#1d2930] hover:text-white border border-transparent'
              }`}
            >
              <Network size={14} />
              Datalogic
            </button>
            <button
              onClick={() => setActiveTab('tolerancia')}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'tolerancia'
                  ? 'bg-logisnext-magenta/20 text-logisnext-magenta border border-logisnext-magenta/30'
                  : 'text-logisnext-slate hover:bg-[#1d2930] hover:text-white border border-transparent'
              }`}
            >
              <Activity size={14} />
              Tolerancia
            </button>
            <button
              onClick={() => setActiveTab('prueba5m')}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'prueba5m'
                  ? 'bg-logisnext-magenta/20 text-logisnext-magenta border border-logisnext-magenta/30'
                  : 'text-logisnext-slate hover:bg-[#1d2930] hover:text-white border border-transparent'
              }`}
            >
              <TestTube size={14} />
              Prueba 5 Min
            </button>
            <button
              onClick={() => setActiveTab('visor3d')}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'visor3d'
                  ? 'bg-logisnext-magenta/20 text-logisnext-magenta border border-logisnext-magenta/30'
                  : 'text-logisnext-slate hover:bg-[#1d2930] hover:text-white border border-transparent'
              }`}
            >
              <Box size={14} />
              Visor 3D
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
            {activeTab === 'datalogic' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm text-white font-bold uppercase tracking-widest border-b border-logisnext-magenta/50 pb-1 inline-block">
                    Escáner Datalogic
                  </h3>
                </div>

                {/* Tipo de Conexión */}
                <div className="space-y-3">
                  <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">
                    Tipo de Conexión
                  </label>
                  <div className="flex gap-4">
                    <label className={`flex-1 flex items-center justify-center gap-2 py-3 border rounded-lg cursor-pointer transition-all ${
                      connType === 'tcp' ? 'bg-[#1d2930] border-logisnext-magenta text-white shadow-[0_0_15px_rgba(221,40,118,0.2)]' : 'border-[#2e404a] text-logisnext-slate hover:border-[#5d7a8a]'
                    }`}>
                      <input type="radio" name="connType" value="tcp" checked={connType === 'tcp'} onChange={() => setConnType('tcp')} className="hidden" />
                      <Network size={16} />
                      <span className="text-xs font-bold uppercase tracking-wider">TCP / IP</span>
                    </label>
                    <label className={`flex-1 flex items-center justify-center gap-2 py-3 border rounded-lg cursor-pointer transition-all ${
                      connType === 'serial' ? 'bg-[#1d2930] border-logisnext-magenta text-white shadow-[0_0_15px_rgba(221,40,118,0.2)]' : 'border-[#2e404a] text-logisnext-slate hover:border-[#5d7a8a]'
                    }`}>
                      <input type="radio" name="connType" value="serial" checked={connType === 'serial'} onChange={() => setConnType('serial')} className="hidden" />
                      <Usb size={16} />
                      <span className="text-xs font-bold uppercase tracking-wider">Serial (COM)</span>
                    </label>
                  </div>
                </div>

                {/* Parámetros Dinámicos */}
                <div className="bg-[#1d2930]/40 border border-[#2e404a] rounded-xl p-5 space-y-4">
                  {connType === 'tcp' ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">Dirección IP</label>
                        <input
                          type="text"
                          value={ip}
                          onChange={(e) => setIp(e.target.value)}
                          className="bg-[#0a0f12] border border-[#2e404a] rounded-lg px-3 py-2 text-white text-xs font-mono outline-none focus:border-logisnext-magenta transition-colors"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">Puerto TCP</label>
                        <input
                          type="text"
                          value={port}
                          onChange={(e) => setPort(e.target.value)}
                          className="bg-[#0a0f12] border border-[#2e404a] rounded-lg px-3 py-2 text-white text-xs font-mono outline-none focus:border-logisnext-magenta transition-colors"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">Puerto COM</label>
                        <input
                          type="text"
                          value={comPort}
                          onChange={(e) => setComPort(e.target.value)}
                          className="bg-[#0a0f12] border border-[#2e404a] rounded-lg px-3 py-2 text-white text-xs font-mono outline-none focus:border-logisnext-magenta transition-colors"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">Baud Rate</label>
                        <select
                          value={baudRate}
                          onChange={(e) => setBaudRate(e.target.value)}
                          className="bg-[#0a0f12] border border-[#2e404a] rounded-lg px-3 py-2 text-white text-xs font-mono outline-none focus:border-logisnext-magenta transition-colors"
                        >
                          <option value="9600">9600</option>
                          <option value="19200">19200</option>
                          <option value="38400">38400</option>
                          <option value="57600">57600</option>
                          <option value="115200">115200</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex flex-col items-end gap-2">
                  <button
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="flex items-center gap-2 px-4 py-2 border border-[#2e404a] hover:bg-[#2e404a] text-logisnext-lightslate hover:text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                  >
                    <TestTube size={14} className={isTesting ? "animate-spin" : ""} />
                    {isTesting ? "Probando..." : "Test Conexión"}
                  </button>
                  {testResult && (
                    <div className={`text-xs px-3 py-1.5 rounded bg-[#1d2930]/80 border ${
                      testResult.status === 'ok' ? 'text-green-400 border-green-500/30' : 'text-red-400 border-red-500/30'
                    }`}>
                      {testResult.message}
                    </div>
                  )}
                </div>

              </div>
            )}

            {activeTab === 'tolerancia' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm text-white font-bold uppercase tracking-widest border-b border-logisnext-magenta/50 pb-1 inline-block">
                    Tolerancia (Multiload)
                  </h3>
                </div>

                <div className="bg-[#1d2930]/40 border border-[#2e404a] rounded-xl p-5 space-y-6">
                  <p className="text-xs text-logisnext-lightslate font-medium">
                    Configure los márgenes de tolerancia para la colocación de la pegatina en la etapa de Multiload. El sistema indicará posición correcta si la altura del láser se encuentra dentro de estos límites respecto a la ALTURA MAX del ERP.
                  </p>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] text-green-400 font-bold uppercase tracking-widest">
                        Tolerancia en Positivo (+mm)
                      </label>
                      <input
                        type="number"
                        value={toleranciaPositiva}
                        onChange={(e) => setToleranciaPositiva(e.target.value)}
                        className="bg-[#0a0f12] border border-green-500/30 rounded-lg px-4 py-3 text-white text-sm font-black outline-none focus:border-green-400 transition-colors"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] text-red-400 font-bold uppercase tracking-widest">
                        Tolerancia en Negativo (-mm)
                      </label>
                      <input
                        type="number"
                        value={toleranciaNegativa}
                        onChange={(e) => setToleranciaNegativa(e.target.value)}
                        className="bg-[#0a0f12] border border-red-500/30 rounded-lg px-4 py-3 text-white text-sm font-black outline-none focus:border-red-400 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'prueba5m' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm text-white font-bold uppercase tracking-widest border-b border-logisnext-magenta/50 pb-1 inline-block">
                    Prueba 5 Minutos (Mx / XL)
                  </h3>
                </div>

                <div className="bg-[#1d2930]/40 border border-[#2e404a] rounded-xl p-5 space-y-6">
                  <p className="text-xs text-logisnext-lightslate font-medium">
                    Configure la duración de la prueba de estabilidad en carga y la tolerancia máxima permitida de caída (variación en milímetros) respecto a la altura inicial.
                  </p>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">
                        Duración (segundos)
                      </label>
                      <input
                        type="number"
                        value={test5mDuration}
                        onChange={(e) => setTest5mDuration(e.target.value)}
                        className="bg-[#0a0f12] border border-[#2e404a] rounded-lg px-4 py-3 text-white text-sm font-black outline-none focus:border-logisnext-magenta transition-colors"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">
                        Tolerancia de caída (mm)
                      </label>
                      <input
                        type="number"
                        value={test5mTolerancia}
                        onChange={(e) => setTest5mTolerancia(e.target.value)}
                        className="bg-[#0a0f12] border border-[#2e404a] rounded-lg px-4 py-3 text-white text-sm font-black outline-none focus:border-logisnext-magenta transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'visor3d' && (
              <div className="space-y-4 h-full flex flex-col">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm text-white font-bold uppercase tracking-widest border-b border-logisnext-magenta/50 pb-1 inline-block">
                    Visor 3D (OBJ/MTL)
                  </h3>
                </div>

                <div className="flex gap-4 shrink-0">
                  <label className="flex-1 flex flex-col items-center justify-center p-3 bg-[#1d2930]/40 border border-dashed border-[#2e404a] hover:border-logisnext-magenta/50 rounded-xl cursor-pointer transition-colors">
                    <Upload size={16} className="text-logisnext-lightslate mb-1" />
                    <span className="text-[10px] text-white font-bold uppercase tracking-widest">Subir .OBJ</span>
                    <span className="text-[9px] text-logisnext-slate mt-0.5 truncate max-w-[150px]">
                      {objFile ? objFile.name : 'Ningún archivo seleccionado'}
                    </span>
                    <input type="file" accept=".obj" className="hidden" onChange={(e) => setObjFile(e.target.files[0])} />
                  </label>
                  <label className="flex-1 flex flex-col items-center justify-center p-3 bg-[#1d2930]/40 border border-dashed border-[#2e404a] hover:border-logisnext-magenta/50 rounded-xl cursor-pointer transition-colors">
                    <Upload size={16} className="text-logisnext-lightslate mb-1" />
                    <span className="text-[10px] text-white font-bold uppercase tracking-widest">Subir .MTL</span>
                    <span className="text-[9px] text-logisnext-slate mt-0.5 truncate max-w-[150px]">
                      {mtlFile ? mtlFile.name : 'Opcional (Materiales)'}
                    </span>
                    <input type="file" accept=".mtl" className="hidden" onChange={(e) => setMtlFile(e.target.files[0])} />
                  </label>
                </div>

                <div className="flex-1 relative min-h-[450px]">
                  <ObjViewer objFile={objFile} mtlFile={mtlFile} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#2e404a] bg-[#0a0f12]/80 shrink-0">
          <button onClick={onClose} className="text-[10px] text-logisnext-slate hover:text-white uppercase tracking-widest font-bold transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2 bg-logisnext-magenta hover:bg-logisnext-magenta/80 text-white text-xs font-black uppercase tracking-wider rounded-lg transition-all shadow-[0_0_20px_rgba(221,40,118,0.4)]"
          >
            <Save size={14} /> Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
