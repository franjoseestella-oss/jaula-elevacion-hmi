import React, { useState, useRef } from 'react';
import { Search, RefreshCw, CheckCircle2, AlertTriangle, Loader2, Hash, FileText } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8001';

const ErpSearch = ({ onErpData }) => {
  const [secuencia, setSecuencia] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const inputRef = useRef(null);

  const handleSearch = async (e) => {
    e?.preventDefault();
    const query = secuencia.trim();
    if (!query) return;

    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch(`${API_BASE}/erp/secuencia/${encodeURIComponent(query)}`);
      const data = await res.json();

      if (res.ok) {
        setStatus('found');
        setMessage(`Vinculado: ${data.bastidor} · ${data.modelo}`);
        onErpData(data);
      } else if (res.status === 404) {
        setStatus('not_found');
        setMessage(data.detail || 'Secuencia no encontrada.');
        onErpData(null);
      } else {
        throw new Error(`Error ${res.status}`);
      }
    } catch (err) {
      if (err.name === 'SyntaxError') { setStatus('not_found'); setMessage('No encontrado.'); }
      else { setStatus('error'); setMessage(`Sin conexión: ${err.message}`); }
      onErpData(null);
    }
  };

  const handleSync = async () => {
    setSyncLoading(true);
    try {
      const res = await fetch(`${API_BASE}/erp/sync`, { method: 'POST' });
      const data = await res.json();
      setStatus(res.ok ? 'found' : 'error');
      setMessage(data.message || data.detail || (res.ok ? 'Sync OK' : 'Error.'));
    } catch (err) {
      setStatus('error');
      setMessage(`Error: ${err.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const statusConfig = {
    idle: { border: 'border-[#2e404a]', icon: null, textColor: 'text-logisnext-lightslate' },
    loading: { border: 'border-logisnext-magenta/60', icon: <Loader2 size={14} className="animate-spin text-logisnext-magenta" />, textColor: 'text-logisnext-magenta' },
    found: { border: 'border-green-500/60', icon: <CheckCircle2 size={14} className="text-green-400" />, textColor: 'text-green-400' },
    not_found: { border: 'border-yellow-500/60', icon: <AlertTriangle size={14} className="text-yellow-400" />, textColor: 'text-yellow-400' },
    error: { border: 'border-red-500/60', icon: <AlertTriangle size={14} className="text-red-400" />, textColor: 'text-red-400' },
  };
  const cfg = statusConfig[status];

  return (
    <div className="px-5 py-4 border-b border-[#2e404a] bg-[#0d1a20]/80 backdrop-blur-md">

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Hash size={13} className="text-logisnext-magenta" />
        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-logisnext-lightslate">
          Vincular Secuencia
        </span>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSearch} className="flex gap-2 items-stretch">
        <div className={`flex-1 flex items-center gap-2 bg-[#0a0f12] border ${cfg.border} rounded-lg px-3 py-2 transition-colors duration-300`}>
          <Hash size={13} className="text-logisnext-slate shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={secuencia}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 4);
              setSecuencia(v);
              if (status !== 'idle') setStatus('idle');
            }}
            placeholder="Nº secuencia (ej: 0210)…"
            inputMode="numeric"
            maxLength={4}
            className="flex-1 bg-transparent text-white text-xs font-mono placeholder-[#3a5060] outline-none w-full tracking-widest"
          />
          {secuencia && (
            <span className="text-[9px] text-logisnext-slate/60 font-mono shrink-0">
              {secuencia.padStart(4, '0')}
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={status === 'loading' || !secuencia.trim()}
          className="px-3 py-2 bg-logisnext-magenta/90 hover:bg-logisnext-magenta text-white rounded-lg font-black text-xs uppercase transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_12px_rgba(221,40,118,0.3)] hover:shadow-[0_0_20px_rgba(221,40,118,0.5)] active:scale-95"
        >
          {status === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
        </button>

        <button
          type="button"
          onClick={handleSync}
          disabled={syncLoading}
          title="Lee el fichero DAT del ERP e importa los datos a la base de datos local"
          className="flex items-center gap-1.5 px-3 py-2 bg-logisnext-magenta hover:bg-logisnext-magenta/80 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 disabled:opacity-40 shadow-[0_0_12px_rgba(221,40,118,0.3)] hover:shadow-[0_0_20px_rgba(221,40,118,0.5)] active:scale-95 whitespace-nowrap"
        >
          {syncLoading ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
          {syncLoading ? 'Leyendo…' : 'Leer ERP'}
        </button>
      </form>

      {/* Estado */}
      {message && (
        <div className={`mt-2 flex items-center gap-1.5 ${cfg.textColor}`}>
          {cfg.icon}
          <span className="text-[10px] font-medium leading-tight">{message}</span>
        </div>
      )}
    </div>
  );
};

export default ErpSearch;
