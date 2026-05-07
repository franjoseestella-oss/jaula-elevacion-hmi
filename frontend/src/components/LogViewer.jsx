import React, { useState, useEffect } from 'react';
import { X, RefreshCw, FileText, Download, Activity, Clock, User, CheckCircle2, AlertTriangle } from 'lucide-react';

const API_BASE = 'http://localhost:8001';

const formatNumber = (val) => {
  if (val === null || val === undefined || val === '') return '-';
  return String(val).replace('.', ',');
};

const formatTime = (val) => {
  if (val === null || val === undefined || val === '') return '-';
  return Number(val).toFixed(3).replace('.', ',');
};

const formatDateToLocalString = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (!isNaN(d)) return d.toLocaleString();
  return dateStr; // fallback to raw
};

const LogViewer = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filterSec, setFilterSec] = useState('');
  const [filterBast, setFilterBast] = useState('');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' });

  const parseLocalDate = (dateStr) => {
    if (!dateStr) return null;
    
    // Attempt standard parse first
    const d = new Date(dateStr);
    if (!isNaN(d)) return d;

    const parts = dateStr.split(/, | /);
    if (parts.length >= 2) {
      const dateSplits = parts[0].split('/');
      if (dateSplits.length === 3) {
        const isoStr = `${dateSplits[2]}-${dateSplits[1].padStart(2, '0')}-${dateSplits[0].padStart(2, '0')}T${parts[1]}`;
        const d2 = new Date(isoStr);
        if (!isNaN(d2)) return d2;
      }
    }
    return null;
  };

  const getDuration = (start, end) => {
    const t1 = parseLocalDate(start);
    const t2 = parseLocalDate(end);
    if (t1 && t2) {
      const diff = Math.round((t2 - t1) / 1000);
      if (diff < 0) return '-';
      return `${Math.floor(diff / 60)}m ${diff % 60}s`;
    }
    return '-';
  };

  const filteredLogs = logs.filter(log => {
    if (filterSec && (!log.NSECUENCIA || !log.NSECUENCIA.includes(filterSec))) return false;
    if (filterBast && (!log.NBASTIDOR || !log.NBASTIDOR.toLowerCase().includes(filterBast.toLowerCase()))) return false;
    if (filterStatus && log.OK_NOK !== filterStatus) return false;
    
    if (filterDateStart || filterDateEnd) {
      const d = parseLocalDate(log.FECHA_HORA_INICIO_SEC);
      if (d) {
        const dateStr = d.toISOString().split('T')[0];
        if (filterDateStart && dateStr < filterDateStart) return false;
        if (filterDateEnd && dateStr > filterDateEnd) return false;
      }
    }
    return true;
  });

  const parseSortValue = (val) => {
    if (val === undefined || val === null || val === '-') return -Infinity; // Sort nulls at bottom
    if (typeof val === 'string' && val.includes('/')) {
      const dateObj = parseLocalDate(val);
      if (dateObj && !isNaN(dateObj)) return dateObj.getTime();
    }
    if (val !== '' && !isNaN(Number(val))) return Number(val);
    return String(val).toLowerCase();
  };

  const sortedLogs = React.useMemo(() => {
    let sortableLogs = [...filteredLogs];
    if (sortConfig !== null) {
      sortableLogs.sort((a, b) => {
        let valA = parseSortValue(a[sortConfig.key]);
        let valB = parseSortValue(b[sortConfig.key]);
        
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableLogs;
  }, [filteredLogs, sortConfig]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderTh = (label, sortKey, className = "") => (
    <th 
      key={sortKey}
      className={`px-4 py-4 border-b border-[#2e404a] align-middle cursor-pointer hover:bg-[#1d2930] transition-colors ${className}`}
      onClick={() => handleSort(sortKey)}
    >
      <div className="flex items-center justify-between gap-2">
        <span>{label}</span>
        {sortConfig?.key === sortKey ? (
          <span className="ml-1 text-logisnext-magenta font-black">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
        ) : (
          <span className="ml-1 text-logisnext-lightslate/30">↕</span>
        )}
      </div>
    </th>
  );

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
              onClick={() => { setFilterSec(''); setFilterBast(''); setFilterDateStart(''); setFilterDateEnd(''); setFilterStatus(''); }}
              className="px-4 py-2 bg-transparent hover:bg-[#1d2930] text-logisnext-lightslate text-sm font-bold rounded-lg transition-colors border border-transparent hover:border-[#2e404a]"
            >
              LIMPIAR FILTROS
            </button>
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

        {/* Filter Bar */}
        <div className="bg-[#11191e] border-b border-[#2e404a] p-4 flex flex-wrap gap-6 items-end shrink-0 shadow-inner">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">Secuencia</label>
            <input type="text" placeholder="Ej: 0296" value={filterSec} onChange={e=>setFilterSec(e.target.value)} className="bg-[#0a0f12] text-sm border border-[#2e404a] text-white p-2 rounded focus:border-logisnext-magenta outline-none w-32" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">Bastidor</label>
            <input type="text" placeholder="Ej: SFB09..." value={filterBast} onChange={e=>setFilterBast(e.target.value)} className="bg-[#0a0f12] text-sm border border-[#2e404a] text-white p-2 rounded focus:border-logisnext-magenta outline-none w-48" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">Creado (Desde)</label>
            <input type="date" style={{ colorScheme: 'dark' }} value={filterDateStart} onChange={e=>setFilterDateStart(e.target.value)} className="bg-[#0a0f12] text-sm border border-[#2e404a] text-logisnext-lightslate p-2 rounded focus:border-logisnext-magenta outline-none cursor-pointer w-36" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">Creado (Hasta)</label>
            <input type="date" style={{ colorScheme: 'dark' }} value={filterDateEnd} onChange={e=>setFilterDateEnd(e.target.value)} className="bg-[#0a0f12] text-sm border border-[#2e404a] text-logisnext-lightslate p-2 rounded focus:border-logisnext-magenta outline-none cursor-pointer w-36" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">Estado Global</label>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="bg-[#0a0f12] text-sm border border-[#2e404a] text-white p-2 rounded focus:border-logisnext-magenta outline-none cursor-pointer w-36">
              <option value="">TODOS</option>
              <option value="OK">OK</option>
              <option value="NOK">NOK</option>
              <option value="ABORTADO">ABORTADO</option>
            </select>
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
            <div className="overflow-x-auto rounded-xl border border-[#2e404a] custom-scrollbar pb-10">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-[10px] uppercase bg-[#151f25] text-logisnext-lightslate font-black tracking-wider whitespace-nowrap select-none">
                  <tr>
                    {renderTh("ID", "id")}
                    {renderTh("Operario", "OPERARIO")}
                    {renderTh("F. Montaje", "FECHA_MONTAJE")}
                    {renderTh("Secuencia", "NSECUENCIA")}
                    {renderTh("Modelo", "NMODELO")}
                    {renderTh("Bastidor", "NBASTIDOR")}
                    {renderTh("Mástil", "NMASTIL")}
                    {renderTh("Alt. ERP", "ALTURA_MAX_INTERMEDIA")}
                    {renderTh("Alt. Captada", "ALTURA_CAPTADA")}
                    {renderTh("Ini Multiload", "FECHA_HORA_INICIO_MULTILOAD")}
                    {renderTh("Fin Multiload", "FECHA_HORA_FIN_MULTILOAD")}
                    {renderTh("Est. Multiload", "ESTADO_MULTILOAD")}
                    {renderTh("Elev. Min SC", "TIEMPO_ELEVACION_MIN_SINCARGA")}
                    {renderTh("Elev. Max SC", "TIEMPO_ELEVACION_MAX_SINCARGA")}
                    {renderTh("Elev. Med SC", "TIEMPO_ELEVACION_MEDIDO_SINCARGA")}
                    {renderTh("Desc. Min SC", "TIEMPO_DESCENSO_MIN_SINCARGA")}
                    {renderTh("Desc. Max SC", "TIEMPO_DESCENSO_MAX_SINCARGA")}
                    {renderTh("Desc. Med SC", "TIEMPO_DESCENSO_MEDIDO_SINCARGA")}
                    {renderTh("Ini S/Carga", "FECHA_HORA_INICIO_SINCARGA")}
                    {renderTh("Fin S/Carga", "FECHA_HORA_FIN_SINCARGA")}
                    {renderTh("Est. S/Carga", "ESTADO_SINCARGA")}
                    {renderTh("Elev. Min CC", "TIEMPO_ELEVACION_MIN_CARGA")}
                    {renderTh("Elev. Max CC", "TIEMPO_ELEVACION_MAX_CARGA")}
                    {renderTh("Elev. Med CC", "TIEMPO_ELEVACION_MEDIDO_CARGA")}
                    {renderTh("Desc. Min CC", "TIEMPO_DESCENSO_MIN_CARGA")}
                    {renderTh("Desc. Max CC", "TIEMPO_DESCENSO_MAX_CARGA")}
                    {renderTh("Desc. Med CC", "TIEMPO_DESCENSO_MEDIDO_CARGA")}
                    {renderTh("Ini C/Carga", "FECHA_HORA_INICIO_CARGA")}
                    {renderTh("Fin C/Carga", "FECHA_HORA_FIN_CARGA")}
                    {renderTh("Est. C/Carga", "ESTADO_CARGA")}
                    {renderTh("Carga ERP", "CARGA_CONSIGNADA")}
                    {renderTh("Carga Get", "CARGA_GET")}
                    {renderTh("Alt. Inicial 5M", "ALTURA_INICIAL")}
                    {renderTh("Alt. Final 5M", "ALTURA_FINAL")}
                    {renderTh("Caída 5M", "DIFERENCIA_ALTURAS")}
                    {renderTh("Ini 5Min", "FECHA_HORA_INICIO_5MIN")}
                    {renderTh("Fin 5Min", "FECHA_HORA_FIN_5MIN")}
                    {renderTh("Est. 5Min", "ESTADO_CARGA_5_MIN")}
                    {renderTh("Reps", "REPETICIONES_SECUENCIA")}
                    {renderTh("Ini Sec.", "FECHA_HORA_INICIO_SEC")}
                    {renderTh("Fin Sec.", "FECHA_HORA_FIN_SEC")}
                    {renderTh("Duración Sec.", "DURACION_SEC", "text-logisnext-magenta")}
                    <th className="px-4 py-4 border-b border-[#2e404a] text-center sticky right-0 bg-[#151f25] shadow-[-5px_0_10px_rgba(0,0,0,0.5)] z-10 cursor-pointer hover:bg-[#1d2930] transition-colors" onClick={() => handleSort('OK_NOK')}>
                      <div className="flex items-center justify-center gap-2">
                        <span>Estado Global</span>
                        {sortConfig?.key === 'OK_NOK' ? (
                          <span className="ml-1 text-logisnext-magenta font-black">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                        ) : (
                          <span className="ml-1 text-logisnext-lightslate/30">↕</span>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2e404a] bg-[#0a0f12] whitespace-nowrap">
                  {sortedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#151f25] transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{log.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-logisnext-lightslate" />
                          <span>{log.OPERARIO || '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{log.FECHA_MONTAJE || '-'}</td>
                      <td className="px-4 py-3 font-bold text-white">{log.NSECUENCIA || '-'}</td>
                      <td className="px-4 py-3">{log.NMODELO || '-'}</td>
                      <td className="px-4 py-3">{log.NBASTIDOR || '-'}</td>
                      <td className="px-4 py-3">{log.NMASTIL || '-'}</td>
                      <td className="px-4 py-3 font-mono">{formatNumber(log.ALTURA_MAX_INTERMEDIA)}</td>
                      <td className="px-4 py-3 font-mono">{formatNumber(log.ALTURA_CAPTADA)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-logisnext-lightslate">{formatDateToLocalString(log.FECHA_HORA_INICIO_MULTILOAD)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-logisnext-lightslate">{formatDateToLocalString(log.FECHA_HORA_FIN_MULTILOAD)}</td>
                      <td className="px-4 py-3"><StatusBadge status={log.ESTADO_MULTILOAD} /></td>
                      <td className="px-4 py-3 font-mono text-logisnext-lightslate">{formatTime(log.TIEMPO_ELEVACION_MIN_SINCARGA)}</td>
                      <td className="px-4 py-3 font-mono text-logisnext-lightslate">{formatTime(log.TIEMPO_ELEVACION_MAX_SINCARGA)}</td>
                      <td className="px-4 py-3 font-mono">{formatTime(log.TIEMPO_ELEVACION_MEDIDO_SINCARGA)}</td>
                      <td className="px-4 py-3 font-mono text-logisnext-lightslate">{formatTime(log.TIEMPO_DESCENSO_MIN_SINCARGA)}</td>
                      <td className="px-4 py-3 font-mono text-logisnext-lightslate">{formatTime(log.TIEMPO_DESCENSO_MAX_SINCARGA)}</td>
                      <td className="px-4 py-3 font-mono">{formatTime(log.TIEMPO_DESCENSO_MEDIDO_SINCARGA)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-logisnext-lightslate">{formatDateToLocalString(log.FECHA_HORA_INICIO_SINCARGA)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-logisnext-lightslate">{formatDateToLocalString(log.FECHA_HORA_FIN_SINCARGA)}</td>
                      <td className="px-4 py-3"><StatusBadge status={log.ESTADO_SINCARGA} /></td>
                      <td className="px-4 py-3 font-mono text-logisnext-lightslate">{formatTime(log.TIEMPO_ELEVACION_MIN_CARGA)}</td>
                      <td className="px-4 py-3 font-mono text-logisnext-lightslate">{formatTime(log.TIEMPO_ELEVACION_MAX_CARGA)}</td>
                      <td className="px-4 py-3 font-mono">{formatTime(log.TIEMPO_ELEVACION_MEDIDO_CARGA)}</td>
                      <td className="px-4 py-3 font-mono text-logisnext-lightslate">{formatTime(log.TIEMPO_DESCENSO_MIN_CARGA)}</td>
                      <td className="px-4 py-3 font-mono text-logisnext-lightslate">{formatTime(log.TIEMPO_DESCENSO_MAX_CARGA)}</td>
                      <td className="px-4 py-3 font-mono">{formatTime(log.TIEMPO_DESCENSO_MEDIDO_CARGA)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-logisnext-lightslate">{formatDateToLocalString(log.FECHA_HORA_INICIO_CARGA)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-logisnext-lightslate">{formatDateToLocalString(log.FECHA_HORA_FIN_CARGA)}</td>
                      <td className="px-4 py-3"><StatusBadge status={log.ESTADO_CARGA} /></td>
                      <td className="px-4 py-3 font-mono">{formatNumber(log.CARGA_CONSIGNADA)}</td>
                      <td className="px-4 py-3 font-mono">{formatNumber(log.CARGA_GET)}</td>
                      <td className="px-4 py-3 font-mono">{formatNumber(log.ALTURA_INICIAL)}</td>
                      <td className="px-4 py-3 font-mono">{formatNumber(log.ALTURA_FINAL)}</td>
                      <td className="px-4 py-3 font-mono text-yellow-500">{formatNumber(log.DIFERENCIA_ALTURAS)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-logisnext-lightslate">{formatDateToLocalString(log.FECHA_HORA_INICIO_5MIN)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-logisnext-lightslate">{formatDateToLocalString(log.FECHA_HORA_FIN_5MIN)}</td>
                      <td className="px-4 py-3"><StatusBadge status={log.ESTADO_CARGA_5_MIN} /></td>
                      <td className="px-4 py-3 font-mono">{log.REPETICIONES_SECUENCIA ?? '-'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-logisnext-lightslate">{formatDateToLocalString(log.FECHA_HORA_INICIO_SEC)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-logisnext-lightslate">{formatDateToLocalString(log.FECHA_HORA_FIN_SEC)}</td>
                      <td className="px-4 py-3 font-mono font-bold text-logisnext-magenta">{log.DURACION_SEC || getDuration(log.FECHA_HORA_INICIO_SEC, log.FECHA_HORA_FIN_SEC)}</td>
                      <td className="px-4 py-3 flex justify-center sticky right-0 bg-inherit shadow-[-5px_0_10px_rgba(0,0,0,0.2)] z-10">
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
