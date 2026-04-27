import React, { useState, useRef, useEffect } from 'react';
import { User, Search, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
const API_BASE = 'http://localhost:8000';

const OperatorLoginModal = ({ onLogin }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setResults([]);
    try {
      const res = await fetch(`${API_BASE}/erp/operarios/${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (res.ok) {
        setResults(data);
      } else {
        setError(data.detail || 'Operario no encontrado');
      }
    } catch (err) {
      setError('Error de conexión con el servidor ERP.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (op) => {
    onLogin(op);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050a0e]/95 backdrop-blur-md">
      <div className="w-[450px] bg-gradient-to-b from-[#151f25] to-[#0d1a20] border border-[#2e404a] rounded-2xl shadow-[0_0_80px_rgba(221,40,118,0.15)] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#2e404a] bg-[#1d2930]/60 flex items-center gap-4">
          <div className="p-3 bg-logisnext-magenta/20 rounded-xl border border-logisnext-magenta/40">
            <User size={24} className="text-logisnext-magenta" />
          </div>
          <div>
            <h2 className="text-white font-black uppercase tracking-widest text-lg">Identificación</h2>
            <p className="text-logisnext-slate text-xs uppercase tracking-wider font-bold">Introduzca su código o apellidos</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-logisnext-slate" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ej. 00000764 o URBICAIN"
                className="w-full pl-10 pr-4 py-3 bg-[#0a0f12] border border-[#2e404a] text-white text-sm rounded-lg focus:border-logisnext-magenta focus:ring-1 focus:ring-logisnext-magenta outline-none transition-all placeholder:text-logisnext-slate/50 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={!query.trim() || loading}
              className="px-6 bg-logisnext-magenta hover:bg-logisnext-magenta/80 text-white font-black uppercase tracking-widest text-xs rounded-lg transition-colors disabled:opacity-50"
            >
              Buscar
            </button>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
              <AlertTriangle size={16} />
              <span className="text-xs font-medium">{error}</span>
            </div>
          )}

          {results.length > 0 && (
            <div className="mt-5 space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
              {results.map((op, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelect(op)}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-[#2e404a] bg-[#1d2930]/40 hover:bg-logisnext-magenta/10 hover:border-logisnext-magenta/40 transition-all group text-left"
                >
                  <div>
                    <div className="text-white font-bold tracking-wider text-sm group-hover:text-logisnext-magenta transition-colors">
                      {op.APELLIDOS}
                    </div>
                    <div className="text-logisnext-slate text-[10px] font-mono tracking-widest mt-1">
                      CÓDIGO: {op.CODIGO}
                    </div>
                  </div>
                  <CheckCircle2 size={18} className="text-logisnext-slate group-hover:text-logisnext-magenta opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OperatorLoginModal;
