import React, { useState, useEffect, useRef } from 'react';
import {
  Layers, Barcode, ArrowUpDown, Timer, Weight,
  CheckCircle2, AlertTriangle, SkipForward, Loader2,
  RotateCcw, Ruler, Lock, Hash, Database, XCircle
} from 'lucide-react';


const API_BASE = 'http://localhost:8000';

// ─── Helpers ────────────────────────────────────────────────────────────────

const ds2s = (v) => (v != null ? `${(v / 10).toFixed(1)} s` : '—');
const isMxXL = (modelo) => {
  if (!modelo) return false;
  const m = modelo.trim().toUpperCase();
  return m.startsWith('MX') || m.startsWith('XL');
};

// ─── Componentes de paso ─────────────────────────────────────────────────────

const STEP_STATUS = {
  PENDING: 'pending',
  ACTIVE:  'active',
  OK:      'ok',
  SKIP:    'skip',
  ERROR:   'error',
};

const statusStyle = {
  pending: { ring: 'border-[#2e404a]/50',  bg: 'bg-[#0d1a20]',   num: 'bg-[#1d2930] text-gray-400',       label: 'text-gray-500' },
  active:  { ring: 'border-logisnext-magenta/80', bg: 'bg-[#1d2930]/80', num: 'bg-logisnext-magenta text-white shadow-[0_0_10px_#dd2876]', label: 'text-white' },
  ok:      { ring: 'border-green-500/50',  bg: 'bg-green-900/10', num: 'bg-green-600 text-white',           label: 'text-green-400' },
  skip:    { ring: 'border-gray-800/50', bg: 'bg-[#0a0f12] opacity-50 grayscale',   num: 'bg-[#1d2930] text-gray-600',  label: 'text-gray-600 line-through' },
  error:   { ring: 'border-red-500/60',   bg: 'bg-red-900/10',   num: 'bg-red-700 text-white',             label: 'text-red-400' },
};

const StatusIcon = ({ status }) => {
  if (status === STEP_STATUS.OK)    return <CheckCircle2 size={14} className="text-green-400" />;
  if (status === STEP_STATUS.SKIP)  return <XCircle size={14} className="text-gray-600" />;
  if (status === STEP_STATUS.ERROR) return <AlertTriangle size={14} className="text-red-400" />;
  if (status === STEP_STATUS.ACTIVE) return <Loader2 size={14} className="animate-spin text-logisnext-magenta" />;
  return null;
};

const StepCard = ({ num, icon: Icon, title, status, children, action, canSkip, onToggleSkip }) => {
  const s = statusStyle[status] || statusStyle.pending;
  const isActive = status === STEP_STATUS.ACTIVE;

  return (
    <div className={`relative rounded-xl border transition-all duration-300 overflow-hidden ${s.ring} ${s.bg} ${isActive ? 'shadow-[0_0_24px_rgba(221,40,118,0.15)]' : ''}`}>
      {/* Barra lateral activa */}
      {isActive && <div className="absolute left-0 top-0 w-[3px] h-full bg-logisnext-magenta shadow-[0_0_8px_#dd2876]" />}
      {status === STEP_STATUS.OK && <div className="absolute left-0 top-0 w-[3px] h-full bg-green-500" />}
      {status === STEP_STATUS.SKIP && <div className="absolute left-0 top-0 w-[3px] h-full bg-gray-800" />}

      <div className="pl-4 pr-4 pt-3.5 pb-3">
        {/* Header del paso */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 transition-all duration-300 ${s.num}`}>
            {status === STEP_STATUS.OK ? <CheckCircle2 size={13} /> : status === STEP_STATUS.SKIP ? <XCircle size={12} /> : num}
          </div>
          <Icon size={13} className={isActive ? 'text-logisnext-magenta' : 'text-logisnext-slate'} />
          <span className={`font-black text-[10px] uppercase tracking-widest flex-1 ${s.label}`}>{title}</span>
          
          {canSkip && status !== STEP_STATUS.OK && (
            <button
              onClick={onToggleSkip}
              className={`p-1 mr-1 rounded transition-colors ${status === STEP_STATUS.SKIP ? 'text-gray-500 hover:text-gray-300 bg-gray-800/50' : 'text-logisnext-slate hover:text-white'}`}
              title={status === STEP_STATUS.SKIP ? "Restaurar etapa" : "Deshabilitar etapa"}
            >
              {status === STEP_STATUS.SKIP ? <RotateCcw size={12} /> : <XCircle size={12} />}
            </button>
          )}

          <StatusIcon status={status} />
        </div>

        {/* Contenido dinámico */}
        {children && (
          <div className="mt-2 space-y-1.5 pl-1">{children}</div>
        )}

        {/* Botón de acción */}
        {action && isActive && (
          <div className="mt-3">{action}</div>
        )}
      </div>

      {/* Progress shimmer si activo */}
      {isActive && (
        <div className="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-transparent via-logisnext-magenta to-transparent animate-pulse" />
      )}
    </div>
  );
};

const DataLine = ({ label, value, highlight = false }) => (
  <div className="flex items-baseline justify-between gap-2">
    <span className="text-[9px] text-logisnext-slate uppercase tracking-wider whitespace-nowrap">{label}</span>
    <span className={`font-mono text-[11px] font-bold truncate ${highlight ? 'text-logisnext-magenta' : 'text-white/80'}`}>{value ?? '—'}</span>
  </div>
);

const ActionBtn = ({ onClick, children, disabled = false, variant = 'primary' }) => {
  const base = 'w-full py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5';
  const variants = {
    primary:   'bg-logisnext-magenta/90 hover:bg-logisnext-magenta text-white shadow-[0_0_12px_rgba(221,40,118,0.3)]',
    secondary: 'bg-[#1d2930] hover:bg-[#2e404a] text-logisnext-lightslate border border-[#2e404a]',
    success:   'bg-green-700/80 hover:bg-green-600 text-white',
  };
  return (
    <button className={`${base} ${variants[variant]}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
};

// ─── Componente principal ────────────────────────────────────────────────────

const Sequencer = ({ erpData, onErpData, onOpenErp }) => {
  const [stepStatus, setStepStatus]   = useState([
    STEP_STATUS.ACTIVE,
    STEP_STATUS.PENDING,
    STEP_STATUS.PENDING,
    STEP_STATUS.PENDING,
    STEP_STATUS.PENDING,
  ]);
  const currentStep = stepStatus.findIndex(s => s === STEP_STATUS.ACTIVE);
  const isSequenceFinished = stepStatus[0] === STEP_STATUS.OK && !stepStatus.includes(STEP_STATUS.ACTIVE) && !stepStatus.includes(STEP_STATUS.PENDING);

  const [seqInput, setSeqInput]     = useState('');
  const [seqLoading, setSeqLoading] = useState(false);
  const [seqError, setSeqError]     = useState('');
  const [scannedSeq, setScannedSeq] = useState(null);
  const [inputMode, setInputMode]   = useState('scanner'); // 'scanner' | 'manual'
  const [manualDigits, setManualDigits] = useState('');    // dígitos teclados a mano
  const [timer5min, setTimer5min]   = useState(null);
  const [visionOk, setVisionOk]     = useState(false);
  const [pruebaId, setPruebaId]     = useState(null);
  const inputRef = useRef(null);

  // ── Reset cuando no hay datos ERP (ej. sesión nueva) ────────────────────
  const resetSequence = () => {
    setStepStatus([STEP_STATUS.ACTIVE, STEP_STATUS.PENDING, STEP_STATUS.PENDING, STEP_STATUS.PENDING, STEP_STATUS.PENDING]);
    setSeqInput('');
    setSeqError('');
    setScannedSeq(null);
    setManualDigits('');
    setTimer5min(null);
    setVisionOk(false);
    setPruebaId(null);
    if (onErpData) onErpData(null);
  };

  const handleAbort = async () => {
    if (pruebaId) {
      try {
        await fetch(`${API_BASE}/pruebas/${pruebaId}/resultado`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tiempo_real: 0, estado: 'ERROR' })
        });
      } catch (e) { console.error("Error aborting test:", e); }
    }
    resetSequence();
  };

  // ── Auto-Avanzar PASO 1 si se carga desde ERP Modal ───────────────
  useEffect(() => {
    if (erpData && stepStatus[0] === STEP_STATUS.ACTIVE) {
      setScannedSeq(null);
      markOk(0);
      
      // Crear nueva prueba en BD
      fetch(`${API_BASE}/pruebas/nueva`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_montaje: erpData.fecha_montaje || "",
          secuencia: erpData.secuencia || "",
          modelo: erpData.modelo || "",
          bastidor: erpData.bastidor || "",
          mastil: erpData.mastil || "",
          altura_max_interm: erpData.altura_max_interm || 0,
          tpo_elevac_min: erpData.tpo_elevac_min || 0,
          tpo_elevac_max: erpData.tpo_elevac_max || 0
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.id) setPruebaId(data.id);
      })
      .catch(e => console.error("Error creating test:", e));
    }
  }, [erpData, stepStatus]);

  // ── Teclado numérico manual ───────────────────────────────────────────────
  const handleNumpadPress = (key) => {
    setSeqError('');
    if (key === 'DEL') {
      setManualDigits(prev => prev.slice(0, -1));
    } else if (key === 'OK') {
      if (manualDigits.length > 0) {
        const digits = manualDigits.padStart(4, '0');
        setScannedSeq({ raw: manualDigits, digits });
        setManualDigits('');
      }
    } else if (manualDigits.length < 4) {
      setManualDigits(prev => prev + key);
    }
  };

  // ── Avanzar paso ──────────────────────────────────────────────────────────
  const recalculateActive = (statuses) => {
    const s = [...statuses];
    for (let i = 0; i < s.length; i++) {
      if (s[i] === STEP_STATUS.ACTIVE) s[i] = STEP_STATUS.PENDING;
    }
    for (let i = 0; i < s.length; i++) {
      if (s[i] === STEP_STATUS.PENDING) {
        s[i] = STEP_STATUS.ACTIVE;
        break;
      }
    }
    return s;
  };

  const markOk = (idx, skipNext = false) => {
    setStepStatus(prev => {
      let s = [...prev];
      s[idx] = STEP_STATUS.OK;
      if (skipNext && idx + 1 < s.length) s[idx + 1] = STEP_STATUS.SKIP;
      return recalculateActive(s);
    });
  };

  const toggleSkip = (idx) => {
    if (idx === 0) return;
    setStepStatus(prev => {
      let s = [...prev];
      if (s[idx] === STEP_STATUS.SKIP) {
        s[idx] = STEP_STATUS.PENDING;
      } else if (s[idx] === STEP_STATUS.PENDING || s[idx] === STEP_STATUS.ACTIVE) {
        s[idx] = STEP_STATUS.SKIP;
      }
      return recalculateActive(s);
    });
  };

  // ── PASO 1A: El lector envía el código → extraer dígitos → mostrar confirmación
  const handleLeerSecuencia = () => {
    const raw    = seqInput.trim();
    const digits = raw.replace(/\D/g, '').slice(-4).padStart(4, '0');
    if (!digits || digits === '0000') return;
    setScannedSeq({ raw, digits });
    setSeqInput('');
  };

  // ── PASO 1B: Operario pulsa "Cargar" → consulta ERP y avanza
  const handleConfirmarCarga = async () => {
    if (!scannedSeq) return;
    setSeqLoading(true);
    setSeqError('');
    try {
      const res  = await fetch(`${API_BASE}/erp/secuencia/${encodeURIComponent(scannedSeq.digits)}`);
      const data = await res.json();
      if (res.ok) {
        onErpData(data);
        setScannedSeq(null);
        markOk(0);
      } else {
        setSeqError(data.detail || `Secuencia '${scannedSeq.digits}' no encontrada.`);
        setScannedSeq(null);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    } catch {
      setSeqError('Sin conexión con el servidor.');
      setScannedSeq(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    } finally {
      setSeqLoading(false);
    }
  };

  // Cancelar confirmación → volver a esperar lectura
  const handleCancelarLectura = () => {
    setScannedSeq(null);
    setSeqInput('');
    setSeqError('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Foco automático — siempre que el paso 1 esté activo y no haya confirmación pendiente
  useEffect(() => {
    if (currentStep === 0 && stepStatus[0] === STEP_STATUS.ACTIVE && !scannedSeq) {
      inputRef.current?.focus();
    }
  }, [currentStep, stepStatus, scannedSeq]);

  // Re-foco si el usuario hace clic fuera
  const handleStepClick = () => {
    if (stepStatus[0] === STEP_STATUS.ACTIVE && !scannedSeq) inputRef.current?.focus();
  };

  // ── PASO 2: Multiload — decidir automáticamente al entrar ─────────────────
  useEffect(() => {
    if (currentStep === 1 && stepStatus[1] === STEP_STATUS.ACTIVE && erpData) {
      const altura = erpData.altura_max_interm;
      if (!altura || altura === 0) {
        // Sin multiload → saltar
        setTimeout(() => toggleSkip(1), 600);
      }
    }
  }, [currentStep, stepStatus, erpData]);

  // ── PASO 3: 5 minutos — decidir automáticamente al entrar ─────────────────
  useEffect(() => {
    if (currentStep === 2 && stepStatus[2] === STEP_STATUS.ACTIVE && erpData) {
      if (!isMxXL(erpData.modelo)) {
        setTimeout(() => toggleSkip(2), 600);
      }
    }
  }, [currentStep, stepStatus, erpData]);

  // ── Timer 5 minutos ───────────────────────────────────────────────────────
  useEffect(() => {
    if (timer5min === null) return;
    if (timer5min <= 0) { setTimer5min(0); return; }
    const t = setTimeout(() => setTimer5min(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [timer5min]);

  const startTimer5min = () => setTimer5min(300);
  const timer5minDisplay = timer5min !== null
    ? `${String(Math.floor(timer5min / 60)).padStart(2, '0')}:${String(timer5min % 60).padStart(2, '0')}`
    : null;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <aside className="w-80 bg-gradient-to-b from-[#151f25] to-[#0a0f12] h-full flex flex-col border-l border-[#2e404a] z-10 shrink-0 relative">

      {/* Header */}
      <div className="p-5 bg-[#1d2930]/80 backdrop-blur-md border-b border-[#2e404a] flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-logisnext-slate/20 rounded-md border border-logisnext-slate/40 text-logisnext-lightslate">
            <Layers size={18} />
          </div>
          <div className="flex flex-col">
            <h2 className="font-black text-white uppercase tracking-widest text-sm">SECUENCIA</h2>
            <span className="text-[9px] text-logisnext-lightslate font-bold uppercase tracking-widest">Protocolo de Prueba</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {erpData && (
            <button 
              onClick={handleAbort} 
              title="Abortar prueba" 
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/20 hover:bg-red-900/40 border border-red-500/30 text-red-400 rounded-lg transition-colors text-[10px] font-bold uppercase tracking-widest"
            >
              Abortar
            </button>
          )}
          <button onClick={resetSequence} title="Reiniciar secuencia" className="p-1.5 hover:bg-[#2e404a] rounded-lg text-logisnext-slate hover:text-white transition-colors">
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">

        {/* ── PASO 1: Leer código de barras / secuencia ────────────────────── */}
        <StepCard num={1} icon={Barcode} title="Identificar carretilla" status={stepStatus[0]}>
          {stepStatus[0] === STEP_STATUS.ACTIVE && (
            <>
              {/* ── Selector de modo ── */}
              {!scannedSeq && !seqLoading && (
                <div className="flex rounded-lg overflow-hidden border border-[#2e404a] mb-2">
                  <button
                    onClick={() => { setInputMode('scanner'); setManualDigits(''); setSeqError(''); setTimeout(() => inputRef.current?.focus(), 50); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                      inputMode === 'scanner'
                        ? 'bg-logisnext-magenta/20 text-logisnext-magenta border-r border-logisnext-magenta/30'
                        : 'bg-transparent text-logisnext-slate hover:text-white border-r border-[#2e404a]'
                    }`}
                  >
                    <Barcode size={10} /> Escáner
                  </button>
                  <button
                    onClick={() => { setInputMode('manual'); setSeqInput(''); setSeqError(''); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                      inputMode === 'manual'
                        ? 'bg-logisnext-magenta/20 text-logisnext-magenta border-r border-logisnext-magenta/30'
                        : 'bg-transparent text-logisnext-slate hover:text-white border-r border-[#2e404a]'
                    }`}
                  >
                    <Hash size={10} /> Manual
                  </button>
                  <button
                    onClick={() => { if(onOpenErp) onOpenErp(); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all bg-transparent text-logisnext-slate hover:text-white"
                  >
                    <Database size={10} /> ERP
                  </button>
                </div>
              )}

              {/* Input oculto — solo activo en modo escáner */}
              {inputMode === 'scanner' && (
                <form
                  onSubmit={(e) => { e.preventDefault(); handleLeerSecuencia(); }}
                  onClick={handleStepClick}
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={seqInput}
                    onChange={(e) => { setSeqInput(e.target.value); setSeqError(''); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleLeerSecuencia(); }
                    }}
                    className="sr-only"
                    autoFocus
                    tabIndex={0}
                  />
                </form>
              )}

              {/* ── Estado: esperando lectura (Modo Escáner) ── */}
              {!scannedSeq && inputMode === 'scanner' && (
                <div
                  onClick={handleStepClick}
                  className={`relative flex flex-col items-center justify-center gap-3 py-5 px-4 rounded-xl border-2 border-dashed cursor-text transition-all ${
                    seqError
                      ? 'border-red-500/50 bg-red-900/10'
                      : 'border-[#2e404a] hover:border-logisnext-magenta/40 bg-[#0a0f12]'
                  }`}
                >
                  <div className="relative">
                    <Barcode size={36} className={`transition-all ${seqError ? 'text-red-400' : 'text-logisnext-slate'}`} />
                    {!seqError && (
                      <div className="absolute inset-0 rounded-full bg-logisnext-magenta opacity-10 blur-xl animate-pulse" />
                    )}
                  </div>

                  {seqError ? (
                    <div className="flex items-center gap-1.5 text-red-400">
                      <AlertTriangle size={12} />
                      <span className="text-[10px] font-medium text-center leading-snug">{seqError}</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-logisnext-slate font-bold uppercase tracking-widest">
                      Esperando lectura…
                    </span>
                  )}

                  {seqInput && (
                    <div className="font-mono text-2xl font-black text-logisnext-magenta tracking-[0.4em]">
                      {seqInput.replace(/\D/g, '').padEnd(4, '·')}
                    </div>
                  )}
                </div>
              )}

              {/* ── Estado: teclado manual (Modo Manual) ── */}
              {!scannedSeq && inputMode === 'manual' && (
                <div className="flex flex-col gap-3">
                  <div className={`p-3 rounded-lg border flex items-center justify-center bg-[#0a0f12] shadow-inner ${seqError ? 'border-red-500/50' : 'border-[#2e404a]'}`}>
                    <div className="font-mono text-3xl font-black text-white tracking-[0.4em] h-9">
                      {manualDigits.padEnd(4, '·')}
                    </div>
                  </div>
                  {seqError && (
                    <div className="flex items-center justify-center gap-1 text-red-400 mt-[-4px]">
                      <AlertTriangle size={10} />
                      <span className="text-[9px] font-medium">{seqError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                      <button key={n} onClick={() => handleNumpadPress(n.toString())} className="h-10 bg-[#1d2930] hover:bg-[#2e404a] text-white font-mono text-lg rounded-lg transition-colors border border-[#2e404a]">
                        {n}
                      </button>
                    ))}
                    <button onClick={() => handleNumpadPress('DEL')} className="h-10 bg-[#1d2930] hover:bg-red-900/40 text-red-400 font-bold text-xs rounded-lg transition-colors border border-[#2e404a]">
                      DEL
                    </button>
                    <button onClick={() => handleNumpadPress('0')} className="h-10 bg-[#1d2930] hover:bg-[#2e404a] text-white font-mono text-lg rounded-lg transition-colors border border-[#2e404a]">
                      0
                    </button>
                    <button 
                      onClick={() => handleNumpadPress('OK')} 
                      disabled={manualDigits.length === 0}
                      className="h-10 bg-logisnext-magenta hover:bg-logisnext-magenta/80 text-white font-bold text-xs rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-logisnext-magenta border border-logisnext-magenta/50"
                    >
                      OK
                    </button>
                  </div>
                </div>
              )}

              {/* ── Estado: código leído → confirmación ── */}
              {scannedSeq && !seqLoading && (
                <div className="flex flex-col items-center gap-4 py-4 px-3 rounded-xl border-2 border-logisnext-magenta/60 bg-logisnext-magenta/5">
                  {/* Icono check */}
                  <div className="w-10 h-10 rounded-full bg-logisnext-magenta/20 border border-logisnext-magenta/50 flex items-center justify-center">
                    <Barcode size={20} className="text-logisnext-magenta" />
                  </div>

                  {/* Secuencia leída */}
                  <div className="text-center">
                    <p className="text-[9px] text-logisnext-slate uppercase tracking-widest mb-1">
                      Secuencia detectada
                    </p>
                    <div className="font-mono text-4xl font-black text-white tracking-[0.3em]">
                      {scannedSeq.digits}
                    </div>
                    {scannedSeq.raw !== scannedSeq.digits && (
                      <p className="text-[8px] text-logisnext-slate/50 font-mono mt-1 break-all">
                        raw: {scannedSeq.raw}
                      </p>
                    )}
                  </div>

                  {/* Botón Cargar */}
                  <button
                    onClick={handleConfirmarCarga}
                    className="w-full py-2.5 rounded-xl bg-logisnext-magenta hover:bg-logisnext-magenta/80 text-white font-black text-sm uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(221,40,118,0.4)] active:scale-95"
                  >
                    Cargar
                  </button>

                  {/* Volver a escanear */}
                  <button
                    onClick={handleCancelarLectura}
                    className="text-[9px] text-logisnext-slate hover:text-white uppercase tracking-widest transition-colors"
                  >
                    ↩ Volver a leer
                  </button>
                </div>
              )}

              {/* Buscando... */}
              {seqLoading && (
                <div className="flex flex-col items-center gap-3 py-6">
                  <Loader2 size={28} className="animate-spin text-logisnext-magenta" />
                  <span className="text-[10px] text-logisnext-magenta font-bold uppercase tracking-widest">
                    Cargando secuencia {scannedSeq?.digits}…
                  </span>
                </div>
              )}
            </>

          )}
          {stepStatus[0] === STEP_STATUS.OK && erpData && (
            <>
              <DataLine label="Bastidor"  value={erpData.bastidor}  highlight />
              <DataLine label="Secuencia" value={erpData.secuencia} />
              <DataLine label="Modelo"    value={erpData.modelo} />
              <DataLine label="Mástil"    value={erpData.mastil} />
            </>
          )}
        </StepCard>


        {/* ── PASO 2: Multiload — poner mástil en posición ────────────────── */}
        <StepCard num={2} icon={Ruler} title="Posición multiload" status={stepStatus[1]} canSkip onToggleSkip={() => toggleSkip(1)}>
          {stepStatus[1] === STEP_STATUS.ACTIVE && erpData && (
            <>
              <DataLine label="Altura máx" value={`${erpData.altura_max_interm} mm`} highlight />
              <p className="text-[9px] text-logisnext-slate leading-relaxed">
                Posiciona el mástil a la altura indicada. Confirma cuando esté en posición.
              </p>
              <ActionBtn onClick={() => markOk(1)} variant="primary">
                <CheckCircle2 size={12} /> Mástil en posición
              </ActionBtn>
            </>
          )}
          {stepStatus[1] === STEP_STATUS.SKIP && (
            <p className="text-[9px] text-yellow-500/80">
              Altura máx = 0 → <strong>Sin multiload</strong>. Paso omitido.
            </p>
          )}
          {stepStatus[1] === STEP_STATUS.OK && erpData && (
            <DataLine label="Posición" value={`${erpData.altura_max_interm} mm ✓`} highlight />
          )}
        </StepCard>

        {/* ── PASO 3: Prueba 5 minutos (solo Mx / XL) ─────────────────────── */}
        <StepCard num={3} icon={Timer} title="Prueba 5 minutos" status={stepStatus[2]} canSkip onToggleSkip={() => toggleSkip(2)}>
          {stepStatus[2] === STEP_STATUS.ACTIVE && erpData && (
            <>
              <DataLine label="Modelo" value={erpData.modelo} highlight />
              <DataLine label="Altura mástil" value={`${erpData.altura_max_interm ?? '—'} mm`} />

              {timer5minDisplay === null ? (
                <>
                  <p className="text-[9px] text-logisnext-slate leading-relaxed">
                    Posiciona el mástil. Espera validación de visión y arranca el cronómetro.
                  </p>
                  <div className={`flex items-center gap-1.5 py-1 px-2 rounded-md mt-1 text-[9px] font-bold ${visionOk ? 'bg-green-900/30 text-green-400' : 'bg-[#0a0f12] text-logisnext-slate'}`}>
                    {visionOk ? <CheckCircle2 size={10} /> : <Loader2 size={10} className="animate-spin" />}
                    {visionOk ? 'Visión OK — listo para iniciar' : 'Esperando OK de visión…'}
                  </div>
                  <div className="flex gap-1.5 mt-1">
                    {!visionOk && (
                      <ActionBtn onClick={() => setVisionOk(true)} variant="secondary">
                        Simular OK visión
                      </ActionBtn>
                    )}
                    <ActionBtn onClick={startTimer5min} disabled={!visionOk} variant="primary">
                      <Timer size={12} /> Iniciar 5 min
                    </ActionBtn>
                  </div>
                </>
              ) : (
                <>
                  <div className={`text-center font-mono text-3xl font-black mt-1 mb-2 ${timer5min <= 30 ? 'text-red-400 animate-pulse' : timer5min <= 60 ? 'text-yellow-400' : 'text-logisnext-magenta'}`}>
                    {timer5minDisplay}
                  </div>
                  {timer5min === 0 && (
                    <ActionBtn onClick={() => markOk(2)} variant="success">
                      <CheckCircle2 size={12} /> Prueba completada
                    </ActionBtn>
                  )}
                </>
              )}
            </>
          )}
          {stepStatus[2] === STEP_STATUS.SKIP && (
            <p className="text-[9px] text-yellow-500/80">
              Modelo <strong>{erpData?.modelo}</strong> → no es Mx/XL. Paso omitido.
            </p>
          )}
          {stepStatus[2] === STEP_STATUS.OK && (
            <p className="text-[9px] text-green-400">Prueba de 5 minutos superada ✓</p>
          )}
        </StepCard>

        {/* ── PASO 4: Test CON CARGA ───────────────────────────────────────── */}
        <StepCard num={4} icon={Weight} title="Test con carga" status={stepStatus[3]} canSkip onToggleSkip={() => toggleSkip(3)}>
          {stepStatus[3] === STEP_STATUS.ACTIVE && erpData && (
            <>
              <DataLine label="Carga ref." value={erpData.capac_interm_1 != null ? `${erpData.capac_interm_1} kg` : '—'} highlight />
              <DataLine label="Elevac. min" value={ds2s(erpData.tpo_elevac_min)} />
              <DataLine label="Elevac. max" value={ds2s(erpData.tpo_elevac_max)} />
              <DataLine label="Descenso min" value={ds2s(erpData.tpo_descenso_min)} />
              <DataLine label="Descenso max" value={ds2s(erpData.tpo_descenso_max)} />
              <p className="text-[9px] text-logisnext-slate leading-relaxed mt-1">
                Carga la carretilla con la capacidad indicada y ejecuta ciclos de elevación y descenso dentro de los tiempos de tolerancia.
              </p>
              <ActionBtn onClick={() => markOk(3)} variant="primary">
                <CheckCircle2 size={12} /> Test con carga OK
              </ActionBtn>
            </>
          )}
          {(stepStatus[3] === STEP_STATUS.PENDING) && (
            <div className="flex items-center gap-1.5 text-[9px] text-logisnext-slate">
              <Lock size={10} /> Pendiente paso anterior
            </div>
          )}
          {stepStatus[3] === STEP_STATUS.OK && erpData && (
            <>
              <DataLine label="Carga" value={`${erpData.capac_interm_1 ?? '—'} kg ✓`} highlight />
              <DataLine label="Rango elevac." value={`${ds2s(erpData.tpo_elevac_min)} — ${ds2s(erpData.tpo_elevac_max)}`} />
            </>
          )}
        </StepCard>

        {/* ── PASO 5: Test SIN CARGA ───────────────────────────────────────── */}
        <StepCard num={5} icon={ArrowUpDown} title="Test sin carga" status={stepStatus[4]} canSkip onToggleSkip={() => toggleSkip(4)}>
          {stepStatus[4] === STEP_STATUS.ACTIVE && erpData && (
            <>
              <DataLine label="Elevac. min" value={ds2s(erpData.tpo_elev_min_scarga)} />
              <DataLine label="Elevac. max" value={ds2s(erpData.tpo_elev_max_scarga)} />
              <DataLine label="Descenso min" value={ds2s(erpData.tpo_desc_min_scarga)} />
              <DataLine label="Descenso max" value={ds2s(erpData.tpo_desc_max_scarga)} />
              <p className="text-[9px] text-logisnext-slate leading-relaxed mt-1">
                Retira la carga. Ejecuta ciclos de elevación y descenso sin carga dentro de los tiempos de tolerancia.
              </p>
              <ActionBtn onClick={() => markOk(4)} variant="success">
                <CheckCircle2 size={12} /> Test sin carga OK
              </ActionBtn>
            </>
          )}
          {(stepStatus[4] === STEP_STATUS.PENDING) && (
            <div className="flex items-center gap-1.5 text-[9px] text-logisnext-slate">
              <Lock size={10} /> Pendiente paso anterior
            </div>
          )}
          {stepStatus[4] === STEP_STATUS.OK && (
            <DataLine label="Estado" value="Completado ✓" highlight />
          )}
        </StepCard>

      </div>

      {/* ── PANEL DE FINALIZACIÓN ───────────────────────────────────────── */}
      {isSequenceFinished && (
        <div className="mx-4 mb-4 p-4 rounded-xl border border-green-500/50 bg-green-900/10 flex flex-col items-center animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 size={32} className="text-green-400 mb-2" />
          <p className="text-[11px] font-black text-green-400 uppercase tracking-widest mb-3 text-center">
            Secuencia Completada
          </p>
          <button
            onClick={() => {
              if (pruebaId) {
                fetch(`${API_BASE}/pruebas/${pruebaId}/resultado`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ tiempo_real: 0, estado: 'FINALIZADO_OK' })
                }).catch(e => console.error("Error saving test state", e));
              }
              resetSequence();
            }}
            className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-black text-[11px] uppercase tracking-widest shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-colors active:scale-95"
          >
            Guardar y Cerrar
          </button>
        </div>
      )}

      {/* Footer — progreso global */}
      <div className="px-4 py-3 border-t border-[#2e404a] bg-[#0a0f12]/80 shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] text-logisnext-slate uppercase tracking-widest font-bold">Progreso</span>
          <span className="text-[9px] text-logisnext-lightslate font-mono">
            {stepStatus.filter(s => s === STEP_STATUS.OK || s === STEP_STATUS.SKIP).length} / 5
          </span>
        </div>
        <div className="flex gap-1">
          {stepStatus.map((s, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${
              s === STEP_STATUS.OK    ? 'bg-green-500' :
              s === STEP_STATUS.SKIP  ? 'bg-yellow-600' :
              s === STEP_STATUS.ACTIVE ? 'bg-logisnext-magenta animate-pulse' :
              s === STEP_STATUS.ERROR  ? 'bg-red-500' :
              'bg-[#1d2930]'
            }`} />
          ))}
        </div>
      </div>
    </aside>
  );
};

export default Sequencer;
