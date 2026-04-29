import React, { useState, useEffect } from 'react';
import { X, RefreshCw, FileText, Download, Activity, Clock, User, CheckCircle2, AlertTriangle } from 'lucide-react';

const API_BASE = 'http://localhost:8001';

const LogViewer = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/logs`);
      if (!res.ok) throw new Error('Error al obtener los logs');
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-logisnext-darkslate/95 backdrop-blur-sm p-8">
      <div className="flex-1 bg-[#0a0f12] rounded-2xl border border-[#2e404a] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="h-16 bg-gradient-to-r from-[#151f25] to-[#11191e] border-b border-[#2e404a] flex items-center justify-between px-6 shrink-0 relative">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-logisnext-magenta opacity-50"></div>
          
          <div className="flex items-center gap-4">
            <div className="p-2 bg-logisnext-slate/20 rounded-lg">
              <FileText size={20} className="text-logisnext-magenta" />
            </div>
            <h2 className="text-xl font-black tracking-widest text-white">
              HISTÓRICO DE PRUEBAS
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={fetchLogs}
              className="flex items-center gap-2 px-4 py-2 bg-[#1d2930] hover:bg-[#2e404a] text-white text-sm font-bold rounded-lg transition-colors border border-[#2e404a]"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              ACTUALIZAR
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-[#1d2930] hover:bg-red-900/50 hover:text-red-400 text-gray-400 rounded-lg transition-colors border border-[#2e404a] hover:border-red-900"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-logisnext-lightslate">
              <RefreshCw size={48} className="animate-spin text-logisnext-magenta" />
              <p className="font-bold tracking-widest animate-pulse">CARGANDO LOGS...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-red-400">
              <AlertTriangle size={48} />
              <p className="font-bold">{error}</p>
              <button onClick={fetchLogs} className="px-6 py-2 bg-red-900/30 border border-red-500/50 rounded hover:bg-red-900/50 text-white">REINTENTAR</button>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-logisnext-lightslate">
              <FileText size={64} className="mb-4 opacity-20" />
              <p className="text-xl font-bold tracking-widest opacity-50">NO HAY REGISTROS DISPONIBLES</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#2e404a] custom-scrollbar">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-xs uppercase bg-[#151f25] text-logisnext-lightslate font-black tracking-wider whitespace-nowrap">
                  <tr>
                    <th className="px-4 py-4 border-b border-[#2e404a]">ID</th>
                    <th className="px-4 py-4 border-b border-[#2e404a]">Fecha</th>
                    <th className="px-4 py-4 border-b border-[#2e404a]">Secuencia</th>
                    <th className="px-4 py-4 border-b border-[#2e404a]">Modelo</th>
                    <th className="px-4 py-4 border-b border-[#2e404a]">Bastidor</th>
                    <th className="px-4 py-4 border-b border-[#2e404a]">Mástil</th>
                    <th className="px-4 py-4 border-b border-[#2e404a]">Operario</th>
                    <th className="px-4 py-4 border-b border-[#2e404a]">Altura ERP (mm)</th>
                    <th className="px-4 py-4 border-b border-[#2e404a]">Carga ERP (kg)</th>
                    
                    <th className="px-4 py-4 border-b border-[#2e404a]">Multiload</th>
                    <th className="px-4 py-4 border-b border-[#2e404a]">Altura Cap. (mm)</th>
                    
                    <th className="px-4 py-4 border-b border-[#2e404a]">S/Carga</th>
                    <th className="px-4 py-4 border-b border-[#2e404a]">Elev. SC (s)</th>
                    <th className="px-4 py-4 border-b border-[#2e404a]">Desc. SC (s)</th>
                    
                    <th className="px-4 py-4 border-b border-[#2e404a]">C/Carga</th>
                    <th className="px-4 py-4 border-b border-[#2e404a]">Carga Real (kg)</th>
                    <th className="px-4 py-4 border-b border-[#2e404a]">Elev. CC (s)</th>
                    <th className="px-4 py-4 border-b border-[#2e404a]">Desc. CC (s)</th>
                    
                    <th className="px-4 py-4 border-b border-[#2e404a]">5 Minutos</th>
                    <th className="px-4 py-4 border-b border-[#2e404a]">Alt. Inicial (mm)</th>
                    <th className="px-4 py-4 border-b border-[#2e404a]">Alt. Final (mm)</th>
                    <th className="px-4 py-4 border-b border-[#2e404a]">Caída (mm)</th>
                    
                    <th className="px-4 py-4 border-b border-[#2e404a] text-center sticky right-0 bg-[#151f25] shadow-[-5px_0_10px_rgba(0,0,0,0.5)]">Estado Global</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2e404a] bg-[#0a0f12] whitespace-nowrap">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#151f25] transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{log.id}</td>
                      <td className="px-4 py-3">{log.FECHA_HORA_INICIO_SEC || '-'}</td>
                      <td className="px-4 py-3 font-bold text-white">{log.NSECUENCIA || '-'}</td>
                      <td className="px-4 py-3">{log.NMODELO || '-'}</td>
                      <td className="px-4 py-3">{log.NBASTIDOR || '-'}</td>
                      <td className="px-4 py-3">{log.NMASTIL || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-logisnext-lightslate" />
                          <span>{log.OPERARIO || '-'}</span>
                        </div>
                      </td>
                      
                      <td className="px-4 py-3 font-mono">{log.ALTURA_MAX_INTERMEDIA ?? '-'}</td>
                      <td className="px-4 py-3 font-mono">{log.CARGA_CONSIGNADA ?? '-'}</td>

                      <td className="px-4 py-3"><StatusBadge status={log.ESTADO_MULTILOAD} /></td>
                      <td className="px-4 py-3 font-mono">{log.ALTURA_CAPTADA ?? '-'}</td>

                      <td className="px-4 py-3"><StatusBadge status={log.ESTADO_SINCARGA} /></td>
                      <td className="px-4 py-3 font-mono">{log.TIEMPO_ELEVACION_MEDIDO_SINCARGA ?? '-'}</td>
                      <td className="px-4 py-3 font-mono">{log.TIEMPO_DESCENSO_MEDIDO_SINCARGA ?? '-'}</td>

                      <td className="px-4 py-3"><StatusBadge status={log.ESTADO_DESCENSO_CARGA} /></td>
                      <td className="px-4 py-3 font-mono">{log.CARGA_GET ?? '-'}</td>
                      <td className="px-4 py-3 font-mono">{log.TIEMPO_ELEVACION_MEDIDO_CARGA ?? '-'}</td>
                      <td className="px-4 py-3 font-mono">{log.TIEMPO_DESCENSO_MEDIDO_CARGA ?? '-'}</td>

                      <td className="px-4 py-3"><StatusBadge status={log.ESTADO_CARGA_5_MIN} /></td>
                      <td className="px-4 py-3 font-mono">{log.ALTURA_INICIAL ?? '-'}</td>
                      <td className="px-4 py-3 font-mono">{log.ALTURA_FINAL ?? '-'}</td>
                      <td className="px-4 py-3 font-mono text-yellow-500">{log.DIFERENCIA_ALTURAS ?? '-'}</td>

                      <td className="px-4 py-3 flex justify-center sticky right-0 bg-inherit shadow-[-5px_0_10px_rgba(0,0,0,0.2)]">
                        <GlobalStatusBadge status={log.OK_NOK} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper components para badges
const StatusBadge = ({ status }) => {
  if (!status) return <span className="text-gray-500">-</span>;
  
  if (status === 'OK') {
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-green-900/30 text-green-400 border border-green-500/30"><CheckCircle2 size={12}/> OK</span>;
  }
  if (status === 'NOK' || status === 'ERROR') {
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-red-900/30 text-red-400 border border-red-500/30"><AlertTriangle size={12}/> NOK</span>;
  }
  if (status === 'NO APLICA') {
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-gray-800 text-gray-400 border border-gray-600">N/A</span>;
  }
  return <span className="text-gray-400 text-[10px]">{status}</span>;
};

const GlobalStatusBadge = ({ status }) => {
  if (status === 'OK') {
    return <div className="px-3 py-1 bg-green-600/20 border border-green-500 rounded text-green-400 font-black text-xs tracking-wider shadow-[0_0_10px_rgba(34,197,94,0.2)]">PASS</div>;
  }
  if (status === 'NOK' || status === 'ABORTADO') {
    return <div className="px-3 py-1 bg-red-600/20 border border-red-500 rounded text-red-400 font-black text-xs tracking-wider shadow-[0_0_10px_rgba(239,68,68,0.2)]">{status}</div>;
  }
  return <div className="px-3 py-1 bg-gray-800 border border-gray-600 rounded text-gray-400 font-black text-xs tracking-wider">{status || 'UNK'}</div>;
};

export default LogViewer;
