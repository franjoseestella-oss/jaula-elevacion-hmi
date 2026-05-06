import React from 'react';
import { ClipboardList, AlertCircle, FileText, LayoutTemplate, SlidersHorizontal } from 'lucide-react';

const DataRow = ({ label, value, highlight = false }) => (
  <div className="flex justify-between items-center py-2.5 border-b border-[#2e404a]/50 last:border-0 group hover:bg-[#2e404a]/30 px-2 rounded-sm transition-colors">
    <span className="text-logisnext-lightslate text-xs font-medium uppercase tracking-wider">{label}</span>
    <span className={`font-mono text-sm font-bold tracking-tight ${highlight ? 'text-logisnext-magenta text-glow-magenta' : 'text-white'}`}>
      {value || '---'}
    </span>
  </div>
);

const cs2s = (v) => (v != null ? (v / 10).toFixed(1).replace('.', ',') : null);

const LeftPanel = ({ data, onErpData }) => {
  return (
    <aside className="w-80 bg-gradient-to-b from-[#151f25] to-[#0a0f12] h-full flex flex-col border-r border-[#2e404a] z-10 shrink-0 relative overflow-hidden">
      {/* Decorative Background Element */}
      <div className="absolute top-[-50px] right-[-50px] w-40 h-40 bg-logisnext-magenta rounded-full opacity-5 blur-[80px] pointer-events-none"></div>

      <div className="p-5 bg-[#1d2930]/80 backdrop-blur-md border-b border-logisnext-magenta/30 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-logisnext-magenta/20 rounded-md border border-logisnext-magenta/40 text-logisnext-magenta">
            <ClipboardList size={18} />
          </div>
          <div className="flex flex-col">
            <h2 className="font-black text-white uppercase tracking-widest text-sm drop-shadow-md">DATOS ERP</h2>
            <span className="text-[9px] text-logisnext-lightslate font-bold uppercase tracking-widest">Esquema NG6OF1</span>
          </div>
        </div>
        {data && <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e] animate-pulse"></div>}
      </div>


      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar relative z-10">
        {!data ? (
          <div className="h-full flex flex-col items-center justify-center text-logisnext-slate space-y-6">
            <div className="relative">
              <AlertCircle size={56} className="opacity-40" />
              <div className="absolute inset-0 bg-logisnext-slate blur-xl opacity-20 rounded-full animate-pulse"></div>
            </div>
            <p className="text-center text-xs font-bold uppercase tracking-widest max-w-[200px] leading-relaxed opacity-60">
              Esperando lectura de bastidor para vincular datos
            </p>
          </div>
        ) : (
          <div className="space-y-4">

            {/* Fuente de datos */}
            {data.fuente && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                data.fuente === 'JAULA_ERP'
                  ? 'bg-green-900/20 border-green-500/30 text-green-400'
                  : 'bg-blue-900/20 border-blue-500/30 text-blue-400'
              }`}>
                <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                {data.fuente === 'JAULA_ERP' ? 'DAT sincronizado' : 'DAFEED en directo'}
              </div>
            )}

            {/* Sección: Identificación */}
            <div className="bg-[#1d2930]/60 backdrop-blur-sm rounded-lg p-4 border border-[#2e404a] shadow-lg relative overflow-hidden group hover:border-[#5d7a8a] transition-colors">
              <div className="absolute top-0 left-0 w-1 h-full bg-logisnext-magenta group-hover:shadow-[0_0_15px_#dd2876] transition-shadow"></div>
              <div className="flex items-center gap-2 mb-3 border-b border-[#2e404a] pb-2">
                <FileText size={14} className="text-logisnext-lightslate" />
                <h3 className="text-[10px] text-logisnext-lightslate font-black uppercase tracking-widest">Identidad</h3>
              </div>
              <DataRow label="BASTIDOR" value={data.bastidor} highlight />
              <DataRow label="MODELO" value={data.modelo} />
              <DataRow label="MÁSTIL" value={data.mastil} />
              <DataRow label="SECUENCIA" value={data.secuencia} />
              {data.fecha_montaje && <DataRow label="FEC. MONTAJE" value={data.fecha_montaje} />}
              {data.maquina && <DataRow label="MÁQUINA" value={data.maquina} />}
              {data.tonelaje && <DataRow label="TONELAJE" value={data.tonelaje} />}
            </div>

            {/* Sección: Capacidades */}
            <div className="bg-[#1d2930]/60 backdrop-blur-sm rounded-lg p-4 border border-[#2e404a] shadow-lg group hover:border-[#5d7a8a] transition-colors">
              <div className="flex items-center gap-2 mb-3 border-b border-[#2e404a] pb-2">
                <LayoutTemplate size={14} className="text-logisnext-lightslate" />
                <h3 className="text-[10px] text-logisnext-lightslate font-black uppercase tracking-widest">Parámetros</h3>
              </div>
              <DataRow label="ALT. MAX INTERM." value={data.altura_max_interm != null ? `${data.altura_max_interm} mm` : null} highlight />
              <DataRow label="CAPAC. INTERM. 1" value={data.capac_interm_1 != null ? `${data.capac_interm_1} kg` : null} />
              <DataRow label="CAPAC. INTERM. 2" value={data.capac_interm_2 != null ? `${data.capac_interm_2} kg` : null} />
              <DataRow label="CAPAC. INTERM. 3" value={data.capac_interm_3 != null ? `${data.capac_interm_3} kg` : null} />
            </div>

            {/* Sección: Tolerancias CON CARGA */}
            <div className="bg-[#1d2930]/60 backdrop-blur-sm rounded-lg p-4 border border-[#2e404a] shadow-lg group hover:border-[#5d7a8a] transition-colors">
              <div className="flex items-center gap-2 mb-3 border-b border-[#2e404a] pb-2">
                <SlidersHorizontal size={14} className="text-logisnext-lightslate" />
                <h3 className="text-[10px] text-logisnext-lightslate font-black uppercase tracking-widest">Tolerancias</h3>
              </div>
              <div className="mb-2">
                <span className="text-[9px] text-logisnext-magenta font-black uppercase tracking-widest">Con Carga</span>
              </div>
              <DataRow label="ELEVAC." value={data.tpo_elevac_min != null ? `${cs2s(data.tpo_elevac_min)}s — ${cs2s(data.tpo_elevac_max)}s` : null} />
              <DataRow label="DESCENSO" value={data.tpo_descenso_min != null ? `${cs2s(data.tpo_descenso_min)}s — ${cs2s(data.tpo_descenso_max)}s` : null} />

              <div className="mt-3 mb-2">
                <span className="text-[9px] text-logisnext-magenta font-black uppercase tracking-widest">Sin Carga</span>
              </div>
              <DataRow label="ELEVAC." value={data.tpo_elev_min_scarga != null ? `${cs2s(data.tpo_elev_min_scarga)}s — ${cs2s(data.tpo_elev_max_scarga)}s` : null} />
              <DataRow label="DESCENSO" value={data.tpo_desc_min_scarga != null ? `${cs2s(data.tpo_desc_min_scarga)}s — ${cs2s(data.tpo_desc_max_scarga)}s` : null} />

              {/* Aviso si no hay datos del DAT */}
              {data.tpo_elevac_min == null && (
                <p className="mt-2 text-[9px] text-yellow-500/70 italic">Sincroniza el DAT para ver tiempos reales</p>
              )}
            </div>

          </div>
        )}
      </div>
    </aside>
  );
};

export default LeftPanel;
