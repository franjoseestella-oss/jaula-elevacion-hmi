import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Server, RefreshCw, Search, CheckCircle2, Loader2,
  AlertTriangle, ChevronRight, Database, ChevronDown,
  Clock, Weight, Ruler, Calendar, ArrowUp, ArrowDown, RotateCcw, FileText
} from 'lucide-react';
import { useLanguage } from '../LanguageContext';

const API_BASE = 'http://127.0.0.1:8001';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v, decimals = 1) =>
  v !== null && v !== undefined ? Number(v).toFixed(decimals).replace('.', ',') : '—';

const fmtDate = (s) => {
  if (!s) return '—';
  // yyyymmdd → dd/mm/yyyy
  if (/^\d{8}$/.test(s)) return `${s.slice(6)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
  return s;
};

// Convierte el valor del ERP (centésimas) a "s" con 3 decimales
const cs2s = (v) => (v !== null && v !== undefined ? `${(v / 100).toFixed(3).replace('.', ',')} s` : '—');

// ── Badge de fuente ───────────────────────────────────────────────────────────
const SourceBadge = ({ fuente }) => {
  const colors = {
    JAULA_ERP: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    DAFEED: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
    ninguna: 'bg-red-500/20 text-red-400 border-red-500/40',
  };
  return (
    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${colors[fuente] || colors.ninguna}`}>
      {fuente}
    </span>
  );
};

// ── Modal principal ───────────────────────────────────────────────────────────
const ErpListModal = ({ open, onClose, onSelect }) => {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [fuente, setFuente] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [syncOk, setSyncOk] = useState(null);
  const [filter, setFilter] = useState('');
  const [sortField, setSortField] = useState('secuencia');
  const [sortDir, setSortDir] = useState('desc');

  // ── Cargar listado ────────────────────────────────────────────────────────
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/erp/carretillas?limit=500`);
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
    if (open) { setFilter(''); setSyncMsg(''); setSyncOk(null); fetchList(); }
  }, [open, fetchList]);

  // ── Sync DAT ──────────────────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncLoading(true); setSyncMsg(''); setSyncOk(null);
    try {
      const res = await fetch(`${API_BASE}/erp/sync`, { method: 'POST' });
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
  const handleVincular = (item) => { onSelect(item); onClose(); };

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
      className="flex items-center gap-1 text-xs text-logisnext-slate font-black uppercase tracking-[0.15em] hover:text-white transition-colors"
    >
      {label} <SortIcon field={field} />
    </button>
  );

  return (
    <>
      {/* Overlay + Panel */}
      <div
        className="fixed inset-0 z-[150] flex items-center justify-center"
        style={{ background: 'rgba(5,10,14,0.88)', backdropFilter: 'blur(6px)' }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="relative w-[95vw] max-w-[1600px] max-h-[90vh] flex flex-col bg-gradient-to-b from-[#151f25] to-[#0d1a20] border border-[#2e404a] rounded-2xl shadow-[0_0_80px_rgba(221,40,118,0.15)] overflow-hidden">

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e404a] bg-[#1d2930]/60 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-logisnext-magenta/20 rounded-lg border border-logisnext-magenta/40">
                <Server size={18} className="text-logisnext-magenta" />
              </div>
              <div>
                <h2 className="text-white font-black text-sm uppercase tracking-widest">
                  {t('erp_list_title')}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">
                    {t('total_carretillas').replace('{total}', total)}
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
                placeholder={t('filter_placeholder')}
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
              className="flex items-center gap-2 px-5 py-2 bg-logisnext-magenta hover:bg-logisnext-magenta/80 border border-logisnext-magenta/60 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 shadow-[0_0_18px_rgba(221,40,118,0.35)] hover:shadow-[0_0_28px_rgba(221,40,118,0.55)] active:scale-95"
              title={t('read_erp_tooltip')}
            >
              {syncLoading
                ? <Loader2 size={14} className="animate-spin" />
                : <FileText size={14} />}
              {syncLoading ? t('reading_erp') : t('read_erp')}
            </button>
            <button onClick={fetchList} disabled={loading} className="p-2 bg-[#1d2930] hover:bg-[#2e404a] border border-[#2e404a] rounded-lg text-logisnext-lightslate hover:text-white transition-all disabled:opacity-50" title={t('reload_table_tooltip')}>
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
            <div className="sticky top-0 z-10 grid gap-4 px-6 py-4 bg-[#0a0f12] border-b border-[#2e404a] items-center"
              style={{ gridTemplateColumns: '1.6fr 0.8fr 0.7fr 1.2fr 0.9fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.9fr 40px' }}>
              <ColHeader label={t('col_chassis')} field="bastidor" />
              <ColHeader label={t('col_assembly_date')} field="fecha_montaje" />
              <ColHeader label={t('col_sequence')} field="secuencia" />
              <ColHeader label={t('col_model')} field="descripcion" />
              <ColHeader label={t('col_mast')} field="referencia" />
              <span className="text-xs text-logisnext-slate font-black uppercase tracking-[0.15em]">{t('col_max_height_mm')}</span>
              <span className="text-xs text-logisnext-slate font-black uppercase tracking-[0.15em]">{t('col_c1_kg')}</span>
              <span className="text-xs text-logisnext-slate font-black uppercase tracking-[0.15em]">{t('col_c2_kg')}</span>
              <span className="text-xs text-logisnext-slate font-black uppercase tracking-[0.15em]">{t('col_lift_min')}</span>
              <span className="text-xs text-logisnext-slate font-black uppercase tracking-[0.15em]">{t('col_lift_max')}</span>
              <span className="text-xs text-logisnext-slate font-black uppercase tracking-[0.15em]">{t('col_desc_min')}</span>
              <span className="text-xs text-logisnext-slate font-black uppercase tracking-[0.15em]">{t('col_desc_max')}</span>
              <span className="text-xs text-logisnext-slate font-black uppercase tracking-[0.15em]">{t('col_test_weight')}</span>
              <span />
            </div>
 
            {/* Filas */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-logisnext-slate">
                <Loader2 size={32} className="animate-spin opacity-40" />
                <span className="text-xs font-bold uppercase tracking-widest opacity-40">{t('cargando')}</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-logisnext-slate">
                <AlertTriangle size={32} className="opacity-30" />
                <span className="text-xs font-bold uppercase tracking-widest opacity-40">
                  {filter ? t('no_filter_results') : t('no_data_press_read_erp')}
                </span>
              </div>
            ) : (
              filtered.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleVincular(item)}
                  className={`grid gap-4 items-center px-6 py-4 border-b cursor-pointer transition-all group ${item.estado_prueba === 'FINALIZADO_OK'
                      ? 'bg-green-600/30 border-green-500/80 hover:bg-green-500/50 shadow-[inset_4px_0_0_rgba(34,197,94,1)]'
                      : item.estado_prueba === 'ERROR'
                        ? 'bg-red-600/30 border-red-500/80 hover:bg-red-500/50 shadow-[inset_4px_0_0_rgba(239,68,68,1)]'
                        : 'border-[#1a262d]/60 hover:bg-logisnext-magenta/5 hover:border-logisnext-magenta/20'
                    }`}
                  style={{ gridTemplateColumns: '1.6fr 0.8fr 0.7fr 1.2fr 0.9fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.9fr 40px' }}
                >
                  {/* Bastidor */}
                  <span className="font-mono text-sm text-logisnext-magenta font-bold tracking-wide group-hover:text-white transition-colors truncate">
                    {item.bastidor?.trim() || '—'}
                  </span>
                  {/* Fecha montaje */}
                  <span className="font-mono text-sm text-white font-bold">
                    {fmtDate(item.fecha_montaje)}
                  </span>
                  {/* Secuencia */}
                  <span className="font-mono text-sm text-logisnext-lightslate">
                    {item.secuencia?.trim() || '—'}
                  </span>
                  {/* Modelo */}
                  <span className="text-sm text-white/80 truncate">
                    {item.descripcion?.trim() || '—'}
                  </span>
                  {/* Mástil */}
                  <span className="font-mono text-sm text-logisnext-slate truncate">
                    {item.referencia?.trim() || '—'}
                  </span>
                  {/* Altura max */}
                  <span className="font-mono text-sm text-cyan-400/80">
                    {item.altura_max_interm != null ? Math.round(item.altura_max_interm) : '—'}
                  </span>
                  {/* Capac 1 */}
                  <span className="font-mono text-sm text-amber-400/80">
                    {item.capac_interm_1 != null ? Math.round(item.capac_interm_1) : '—'}
                  </span>
                  {/* Capac 2 */}
                  <span className="font-mono text-sm text-amber-400/60">
                    {item.capac_interm_2 != null ? Math.round(item.capac_interm_2) : '—'}
                  </span>
                  {/* Tpo elevac min c/carga */}
                  <span className="font-mono text-sm text-emerald-400/80">
                    {cs2s(item.tpo_elevac_min)}
                  </span>
                  {/* Tpo elevac max c/carga */}
                  <span className="font-mono text-sm text-emerald-400/60">
                    {cs2s(item.tpo_elevac_max)}
                  </span>
                  {/* Tpo descenso min c/carga */}
                  <span className="font-mono text-sm text-violet-400/80">
                    {cs2s(item.tpo_descenso_min)}
                  </span>
                  {/* Tpo descenso max c/carga */}
                  <span className="font-mono text-sm text-violet-400/60">
                    {cs2s(item.tpo_descenso_max)}
                  </span>
                  {/* Peso pruebas */}
                  <span className="font-mono text-sm text-logisnext-magenta font-bold">
                    {item.peso_pruebas != null ? Math.round(item.peso_pruebas) : '—'}
                  </span>
                  {/* Detalle */}
                  <div className="flex items-center justify-end">
                    <ChevronDown size={14} className="text-logisnext-magenta/0 group-hover:text-logisnext-magenta transition-all" />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-[#2e404a] bg-[#0a0f12]/60 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-logisnext-slate font-mono">
                {filter
                  ? t('filtered_results').replace('{filtered}', filtered.length).replace('{total}', total)
                  : t('total_records').replace('{total}', total)}
              </span>
              <span className="text-[10px] text-logisnext-slate/50">·</span>
              <span className="text-[10px] text-logisnext-slate/50 font-mono">
                {t('click_to_preview_seq')}
              </span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[#1d2930] hover:bg-[#2e404a] border border-[#2e404a] text-logisnext-lightslate text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
            >
              {t('cerrar')}
            </button>
          </div>
        </div>
      </div>

    </>
  );
};

export default ErpListModal;
