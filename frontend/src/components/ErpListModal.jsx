import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Server, RefreshCw, Search, CheckCircle2, Loader2,
  AlertTriangle, ChevronRight, Database, ChevronDown,
  Clock, Weight, Ruler, Calendar, ArrowUp, ArrowDown, RotateCcw
} from 'lucide-react';

const API_BASE = 'http://localhost:8001';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v, decimals = 1) =>
  v !== null && v !== undefined ? Number(v).toFixed(decimals).replace('.', ',') : '—';

const fmtDate = (s) => {
  if (!s) return '—';
  // yyyymmdd → dd/mm/yyyy
  if (/^\d{8}$/.test(s)) return `${s.slice(6)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
  return s;
};

// Convierte centésimas de segundo a "s" con 2 decimales
const cs2s = (v) => (v !== null && v !== undefined ? `${(v / 100).toFixed(2).replace('.', ',')} s` : '—');

// ── Badge de fuente ───────────────────────────────────────────────────────────
const SourceBadge = ({ fuente }) => {
  const colors = {
    JAULA_ERP: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    DAFEED:    'bg-blue-500/20 text-blue-400 border-blue-500/40',
    ninguna:   'bg-red-500/20 text-red-400 border-red-500/40',
  };
  return (
    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${colors[fuente] || colors.ninguna}`}>
      {fuente}
    </span>
  );
};

// ── Panel de detalle de una carretilla ───────────────────────────────────────
const DetallePanel = ({ item, onClose, onVincular }) => {
  const Section = ({ title, icon: Icon, children }) => (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2 pb-1 border-b border-[#2e404a]/60">
        <Icon size={12} className="text-logisnext-magenta" />
        <span className="text-[10px] text-logisnext-magenta font-black uppercase tracking-[0.15em]">{title}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">{children}</div>
    </div>
  );

  const Field = ({ label, value, unit = '', highlight = false }) => (
    <div className="flex flex-col">
      <span className="text-[9px] text-logisnext-slate uppercase tracking-wider leading-tight">{label}</span>
      <span className={`text-xs font-mono font-bold mt-0.5 ${highlight ? 'text-logisnext-magenta' : 'text-white'}`}>
        {value}{unit && value !== '—' ? <span className="text-logisnext-slate text-[9px] ml-0.5">{unit}</span> : ''}
      </span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: 'rgba(5,10,14,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-[560px] max-h-[88vh] flex flex-col bg-gradient-to-b from-[#151f25] to-[#0d1a20] border border-[#2e404a] rounded-2xl shadow-[0_0_60px_rgba(221,40,118,0.2)] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2e404a] bg-[#1d2930]/60 shrink-0">
          <div>
            <h3 className="text-logisnext-magenta font-black text-sm uppercase tracking-widest">
              {item.bastidor?.trim()}
            </h3>
            <span className="text-[10px] text-logisnext-lightslate font-mono">{item.modelo} · Mástil {item.mastil}</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[#2e404a] rounded-lg text-logisnext-slate hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-0">

          <Section title="Identificación" icon={Server}>
            <Field label="Bastidor"   value={item.bastidor?.trim()} highlight />
            <Field label="Secuencia"  value={item.secuencia?.trim()} />
            <Field label="Modelo"     value={item.modelo?.trim()} />
            <Field label="Mástil ref" value={item.mastil?.trim()} />
            <Field label="Fec. montaje"   value={fmtDate(item.fecha_montaje)} />
            <Field label="Fec. importación" value={item.fecha_importacion} />
          </Section>

          <Section title="Geometría" icon={Ruler}>
            <Field label="Altura máx intermedia" value={fmt(item.altura_max_interm, 0)} unit="mm" highlight />
          </Section>

          <Section title="Capacidades intermedias" icon={Weight}>
            <Field label="Capac. interm. 1" value={fmt(item.capac_interm_1, 0)} unit="kg" />
            <Field label="Capac. interm. 2" value={fmt(item.capac_interm_2, 0)} unit="kg" />
            <Field label="Capac. interm. 3" value={fmt(item.capac_interm_3, 0)} unit="kg" />
          </Section>

          <Section title="Tiempos con carga" icon={Clock}>
            <Field label="Elevación mín"   value={cs2s(item.tpo_elevac_min)} />
            <Field label="Elevación máx"   value={cs2s(item.tpo_elevac_max)} />
            <Field label="Descenso mín"    value={cs2s(item.tpo_descenso_min)} />
            <Field label="Descenso máx"    value={cs2s(item.tpo_descenso_max)} />

          </Section>

          <Section title="Tiempos sin carga" icon={RotateCcw}>
            <Field label="Elevación mín"   value={cs2s(item.tpo_elev_min_scarga)} />
            <Field label="Elevación máx"   value={cs2s(item.tpo_elev_max_scarga)} />
            <Field label="Descenso mín"    value={cs2s(item.tpo_desc_min_scarga)} />
            <Field label="Descenso máx"    value={cs2s(item.tpo_desc_max_scarga)} />
          </Section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#2e404a] bg-[#0a0f12]/60 shrink-0">
          <button onClick={onClose} className="text-[10px] text-logisnext-slate hover:text-white uppercase tracking-widest font-bold transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => onVincular(item)}
            className="flex items-center gap-2 px-5 py-2 bg-logisnext-magenta hover:bg-logisnext-magenta/80 text-white text-xs font-black uppercase tracking-wider rounded-lg transition-all shadow-[0_0_20px_rgba(221,40,118,0.4)]"
          >
            Cargar secuencia <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Modal principal ───────────────────────────────────────────────────────────
const ErpListModal = ({ open, onClose, onSelect }) => {
  const [items, setItems]             = useState([]);
  const [total, setTotal]             = useState(0);
  const [fuente, setFuente]           = useState('');
  const [loading, setLoading]         = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMsg, setSyncMsg]         = useState('');
  const [syncOk, setSyncOk]           = useState(null);
  const [filter, setFilter]           = useState('');
  const [detalle, setDetalle]         = useState(null);
  const [sortField, setSortField]     = useState('secuencia');
  const [sortDir, setSortDir]         = useState('desc');

  // ── Cargar listado ────────────────────────────────────────────────────────
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/erp/carretillas?limit=500`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setFuente(data.fuente || '');
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) { setFilter(''); setDetalle(null); setSyncMsg(''); setSyncOk(null); fetchList(); }
  }, [open, fetchList]);

  // ── Sync DAT ──────────────────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncLoading(true); setSyncMsg(''); setSyncOk(null);
    try {
      const res  = await fetch(`${API_BASE}/erp/sync`, { method: 'POST' });
      const data = await res.json();
      setSyncOk(res.ok);
      setSyncMsg(data.message || data.detail || 'Error.');
      if (res.ok) fetchList();
    } catch (err) {
      setSyncOk(false); setSyncMsg(`Sin conexión: ${err.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  // ── Vincular ──────────────────────────────────────────────────────────────
  const handleVincular = (item) => { onSelect(item.bastidor); onClose(); };

  // ── Ordenación ────────────────────────────────────────────────────────────
  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  // ── Filtro + orden ────────────────────────────────────────────────────────
  const filtered = items
    .filter(item => {
      // Excluir si el modelo (descripcion) está vacío
      const desc = item.descripcion?.trim() || '';
      if (!desc || desc === '-' || desc === '—') return false;

      const q = filter.toLowerCase();
      return (
        item.bastidor?.toLowerCase().includes(q) ||
        item.secuencia?.toLowerCase().includes(q) ||
        desc.toLowerCase().includes(q) ||
        item.referencia?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const va = (a[sortField] ?? '').toString();
      const vb = (b[sortField] ?? '').toString();
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });

  if (!open) return null;

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="opacity-20">↕</span>;
    return sortDir === 'asc' ? <ArrowUp size={9} /> : <ArrowDown size={9} />;
  };

  const ColHeader = ({ label, field }) => (
    <button
      onClick={() => toggleSort(field)}
      className="flex items-center gap-1 text-[9px] text-logisnext-slate font-black uppercase tracking-[0.15em] hover:text-white transition-colors"
    >
      {label} <SortIcon field={field} />
    </button>
  );

  return (
    <>
      {/* Overlay + Panel */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(5,10,14,0.88)', backdropFilter: 'blur(6px)' }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="relative w-[1100px] max-h-[90vh] flex flex-col bg-gradient-to-b from-[#151f25] to-[#0d1a20] border border-[#2e404a] rounded-2xl shadow-[0_0_80px_rgba(221,40,118,0.15)] overflow-hidden">

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e404a] bg-[#1d2930]/60 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-logisnext-magenta/20 rounded-lg border border-logisnext-magenta/40">
                <Server size={18} className="text-logisnext-magenta" />
              </div>
              <div>
                <h2 className="text-white font-black text-sm uppercase tracking-widest">
                  Listado ERP — JAULA_ERP
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">
                    {total} carretillas
                  </span>
                  {fuente && <SourceBadge fuente={fuente} />}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[#2e404a] rounded-lg text-logisnext-lightslate hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* ── Toolbar ── */}
          <div className="flex items-center gap-3 px-6 py-3 border-b border-[#2e404a]/50 bg-[#0d1a20]/60 shrink-0">
            <div className="flex-1 flex items-center gap-2 bg-[#0a0f12] border border-[#2e404a] rounded-lg px-3 py-2">
              <Search size={13} className="text-logisnext-slate" />
              <input
                type="text"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Filtrar por bastidor, secuencia, modelo, mástil…"
                className="flex-1 bg-transparent text-white text-xs font-mono placeholder-[#3a5060] outline-none"
              />
              {filter && (
                <button onClick={() => setFilter('')} className="text-logisnext-slate hover:text-white">
                  <X size={12} />
                </button>
              )}
            </div>
            <button
              onClick={handleSync}
              disabled={syncLoading}
              className="flex items-center gap-2 px-4 py-2 bg-[#1d2930] hover:bg-[#2e404a] border border-[#2e404a] hover:border-[#5d7a8a] text-logisnext-lightslate hover:text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
            >
              {syncLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Sync DAT
            </button>
            <button onClick={fetchList} disabled={loading} className="p-2 bg-[#1d2930] hover:bg-[#2e404a] border border-[#2e404a] rounded-lg text-logisnext-lightslate hover:text-white transition-all disabled:opacity-50" title="Recargar">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
            </button>
          </div>

          {/* Sync feedback */}
          {syncMsg && (
            <div className={`flex items-center gap-2 px-6 py-2 text-xs font-medium shrink-0 ${syncOk ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
              {syncOk ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
              {syncMsg}
            </div>
          )}

          {/* ── Tabla completa ── */}
          <div className="flex-1 overflow-auto custom-scrollbar">
            {/* Cabecera */}
            <div className="sticky top-0 z-10 grid gap-0 px-4 py-2 bg-[#0a0f12] border-b border-[#2e404a]"
              style={{ gridTemplateColumns: '1.6fr 0.7fr 1.2fr 0.9fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 40px' }}>
              <ColHeader label="Bastidor"   field="bastidor" />
              <ColHeader label="Sec."       field="secuencia" />
              <ColHeader label="Modelo"     field="descripcion" />
              <ColHeader label="Mástil"     field="referencia" />
              <span className="text-[9px] text-logisnext-slate font-black uppercase tracking-[0.15em]">Alt.máx mm</span>
              <span className="text-[9px] text-logisnext-slate font-black uppercase tracking-[0.15em]">C1 kg</span>
              <span className="text-[9px] text-logisnext-slate font-black uppercase tracking-[0.15em]">C2 kg</span>
              <span className="text-[9px] text-logisnext-slate font-black uppercase tracking-[0.15em]">↑min c</span>
              <span className="text-[9px] text-logisnext-slate font-black uppercase tracking-[0.15em]">↑max c</span>
              <span className="text-[9px] text-logisnext-slate font-black uppercase tracking-[0.15em]">↓min c</span>
              <span className="text-[9px] text-logisnext-slate font-black uppercase tracking-[0.15em]">↓max c</span>
              <ColHeader label="F.montaje"  field="fecha_montaje" />
              <span />
            </div>

            {/* Filas */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-logisnext-slate">
                <Loader2 size={32} className="animate-spin opacity-40" />
                <span className="text-xs font-bold uppercase tracking-widest opacity-40">Cargando…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-logisnext-slate">
                <AlertTriangle size={32} className="opacity-30" />
                <span className="text-xs font-bold uppercase tracking-widest opacity-40">
                  {filter ? 'Sin resultados para ese filtro' : 'No hay registros en JAULA_ERP — usa SYNC DAT'}
                </span>
              </div>
            ) : (
              filtered.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => setDetalle(item)}
                  className={`grid gap-0 px-4 py-2.5 border-b cursor-pointer transition-all group ${
                    item.estado_prueba === 'FINALIZADO_OK'
                      ? 'bg-green-900/10 border-green-500/30 hover:bg-green-900/20'
                      : item.estado_prueba === 'ERROR'
                      ? 'bg-red-900/10 border-red-500/30 hover:bg-red-900/20'
                      : 'border-[#1a262d]/60 hover:bg-logisnext-magenta/5 hover:border-logisnext-magenta/20'
                  }`}
                  style={{ gridTemplateColumns: '1.6fr 0.7fr 1.2fr 0.9fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 40px' }}
                >
                  {/* Bastidor */}
                  <span className="font-mono text-xs text-logisnext-magenta font-bold tracking-wide group-hover:text-white transition-colors truncate">
                    {item.bastidor?.trim() || '—'}
                  </span>
                  {/* Secuencia */}
                  <span className="font-mono text-xs text-logisnext-lightslate">
                    {item.secuencia?.trim() || '—'}
                  </span>
                  {/* Modelo */}
                  <span className="text-xs text-white/80 truncate">
                    {item.descripcion?.trim() || '—'}
                  </span>
                  {/* Mástil */}
                  <span className="font-mono text-xs text-logisnext-slate truncate">
                    {item.referencia?.trim() || '—'}
                  </span>
                  {/* Altura max */}
                  <span className="font-mono text-xs text-cyan-400/80">
                    {item.altura_max_interm != null ? Math.round(item.altura_max_interm) : '—'}
                  </span>
                  {/* Capac 1 */}
                  <span className="font-mono text-xs text-amber-400/80">
                    {item.capac_interm_1 != null ? Math.round(item.capac_interm_1) : '—'}
                  </span>
                  {/* Capac 2 */}
                  <span className="font-mono text-xs text-amber-400/60">
                    {item.capac_interm_2 != null ? Math.round(item.capac_interm_2) : '—'}
                  </span>
                  {/* Tpo elevac min c/carga */}
                  <span className="font-mono text-xs text-emerald-400/80">
                    {item.tpo_elevac_min != null ? (item.tpo_elevac_min / 100).toFixed(2).replace('.', ',') : '—'}
                  </span>
                  {/* Tpo elevac max c/carga */}
                  <span className="font-mono text-xs text-emerald-400/60">
                    {item.tpo_elevac_max != null ? (item.tpo_elevac_max / 100).toFixed(2).replace('.', ',') : '—'}
                  </span>
                  {/* Tpo descenso min c/carga */}
                  <span className="font-mono text-xs text-violet-400/80">
                    {item.tpo_descenso_min != null ? (item.tpo_descenso_min / 100).toFixed(2).replace('.', ',') : '—'}
                  </span>
                  {/* Tpo descenso max c/carga */}
                  <span className="font-mono text-xs text-violet-400/60">
                    {item.tpo_descenso_max != null ? (item.tpo_descenso_max / 100).toFixed(2).replace('.', ',') : '—'}
                  </span>
                  {/* Fecha montaje */}
                  <span className="font-mono text-[10px] text-logisnext-slate/70">
                    {fmtDate(item.fecha_montaje)}
                  </span>
                  {/* Detalle */}
                  <div className="flex items-center justify-end">
                    <ChevronDown size={12} className="text-logisnext-magenta/0 group-hover:text-logisnext-magenta transition-all" />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-[#2e404a] bg-[#0a0f12]/60 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-logisnext-slate font-mono">
                {filter ? `${filtered.length} de ${total} resultados` : `${total} registros`}
              </span>
              <span className="text-[10px] text-logisnext-slate/50">·</span>
              <span className="text-[10px] text-logisnext-slate/50 font-mono">
                Clic en fila para ver detalle completo
              </span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[#1d2930] hover:bg-[#2e404a] border border-[#2e404a] text-logisnext-lightslate text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Panel de detalle (sub-modal) */}
      {detalle && (
        <DetallePanel
          item={detalle}
          onClose={() => setDetalle(null)}
          onVincular={handleVincular}
        />
      )}
    </>
  );
};

export default ErpListModal;
