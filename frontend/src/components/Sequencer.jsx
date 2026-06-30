import React, { useState, useEffect, useRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import {
  Layers, Barcode, ArrowUpDown, Timer, Weight,
  CheckCircle2, AlertTriangle, SkipForward, Loader2,
  RotateCcw, Ruler, Lock, Hash, Database, XCircle, Play, X
} from 'lucide-react';
import { useLanguage } from '../LanguageContext';


const API_BASE = 'http://127.0.0.1:8001';

// ─── Helpers ────────────────────────────────────────────────────────────────

const ds2s = (v) => (v != null ? `${(v / 100).toFixed(1).replace('.', ',')} s` : '—');
const formatDuration = (secs) => {
  if (secs == null) return '—';
  if (secs < 60) return `${secs} s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m} min ${s} s`;
};
const isMxXL = (modelo) => {
  if (!modelo) return false;
  const m = modelo.trim().toUpperCase();
  return m.startsWith('MX') || m.startsWith('XL');
};

const getPlcVal = (plc, keyLower) => {
  if (!plc) return null;
  const foundKey = Object.keys(plc).find(k => k.toLowerCase() === keyLower.toLowerCase());
  return foundKey ? plc[foundKey] : null;
};

const translatePayload = (payload, isSimulation) => {
  if (isSimulation) return payload;
  const mappingStr = localStorage.getItem('plcVarMapping');
  if (!mappingStr) return payload;
  try {
    const mapping = JSON.parse(mappingStr);
    const newPayload = {};
    if (payload.is_force !== undefined) {
      newPayload.is_force = payload.is_force;
    }
    Object.entries(payload).forEach(([key, value]) => {
      if (key === 'is_force') return;
      const found = Object.entries(mapping).find(([k, v]) => v.appVar === key);
      if (found) {
        newPayload[found[0]] = value;
      } else {
        newPayload[key] = value;
      }
    });
    return newPayload;
  } catch (e) {
    return payload;
  }
};

// ─── Componentes de paso ─────────────────────────────────────────────────────

const STEP_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  OK: 'ok',
  SKIP: 'skip',
  ERROR: 'error',
};

const statusStyle = {
  pending: { ring: 'border-[#2e404a]/50', bg: 'bg-[#0d1a20]', num: 'bg-[#1d2930] text-gray-400', label: 'text-gray-500' },
  active: { ring: 'border-logisnext-magenta/80', bg: 'bg-[#1d2930]/80', num: 'bg-logisnext-magenta text-white shadow-[0_0_10px_#dd2876]', label: 'text-white' },
  ok: { ring: 'border-green-500/50', bg: 'bg-green-900/10', num: 'bg-green-600 text-white', label: 'text-green-400' },
  skip: { ring: 'border-gray-800/50', bg: 'bg-[#0a0f12] opacity-50 grayscale', num: 'bg-[#1d2930] text-gray-600', label: 'text-gray-600 line-through' },
  error: { ring: 'border-red-500/60', bg: 'bg-red-900/10', num: 'bg-red-700 text-white', label: 'text-red-400' },
};

const StatusIcon = ({ status }) => {
  if (status === STEP_STATUS.OK) return <CheckCircle2 size={14} className="text-green-400" />;
  if (status === STEP_STATUS.SKIP) return <XCircle size={14} className="text-gray-600" />;
  if (status === STEP_STATUS.ERROR) return <AlertTriangle size={14} className="text-red-400" />;
  if (status === STEP_STATUS.ACTIVE) return <Loader2 size={14} className="animate-spin text-logisnext-magenta" />;
  return null;
};

const StepCard = ({ num, icon: Icon, title, status, children, action, canSkip, onToggleSkip }) => {
  const { t } = useLanguage();
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
              title={status === STEP_STATUS.SKIP ? t('restaurar_etapa') : t('deshabilitar_etapa')}
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

// ─── Modal de previsualización ERP (pantalla completa horizontal) ────────────
const ds2sP = (v) => v != null ? `${(v / 100).toFixed(1).replace('.', ',')} s` : '—';

const MF = ({ label, value, unit, highlight, size = 'xl' }) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-[13px] font-black text-[#6b8fa3] uppercase tracking-[0.2em] leading-none">{label}</span>
    <div className="flex items-baseline gap-2">
      <span className={`font-black leading-none ${size === 'lg' ? 'text-[42px]' : 'text-3xl'} ${highlight ? 'text-logisnext-magenta' : 'text-white'}`}>
        {value ?? '—'}
      </span>
      {unit && <span className="text-xl text-[#6b8fa3] font-bold">{unit}</span>}
    </div>
  </div>
);

const STitle = ({ icon, label }) => (
  <div className="flex items-center gap-3 mb-6">
    <span className="text-logisnext-magenta text-2xl">{icon}</span>
    <span className="text-lg font-black text-logisnext-magenta uppercase tracking-[0.2em]">{label}</span>
    <div className="flex-1 h-[2px] bg-[#2e404a]" />
  </div>
);

const ErpPreviewCard = ({ data, onConfirm, onCancel, iniciarPlcTime, error }) => {
  const { t } = useLanguage();

  const handleTrigger = () => {
    if (iniciarPlcTime === null) {
      onConfirm();
    }
  };

  const displayTime = iniciarPlcTime;

  return createPortal(
  <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
    <div className="w-[98vw] h-[92vh] max-w-none bg-[#0a0f12] rounded-3xl border-2 border-[#2e404a] shadow-[0_0_120px_rgba(0,0,0,1)] flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <div className="px-10 pt-8 pb-6 border-b-2 border-[#2e404a] bg-[#111c24] flex items-center justify-between shrink-0">
        <div>
          <div className="text-7xl font-black text-logisnext-magenta tracking-widest leading-none mb-3">
            {data.bastidor}
          </div>
          <div className="text-3xl text-[#8ba8b8] font-bold tracking-widest uppercase">
            {data.modelo} &nbsp;<span className="text-[#4a6b7c]">|</span>&nbsp; {t('mastil_header')} {data.mastil}
          </div>
        </div>
        <button onClick={onCancel} className="text-[#6b8fa3] hover:text-white transition-all p-4 rounded-xl hover:bg-white/10 active:scale-95 bg-black/20">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* ── Body: 4 columnas (más horizontal) ── */}
      <div className="p-10 grid grid-cols-4 gap-12 divide-x-2 divide-[#2e404a] flex-1 overflow-y-auto">

        {/* COL 1: Identificación */}
        <div className="pr-6 flex flex-col gap-8">
          <STitle icon="⊟" label={t('identificacion')} />
          <div className="flex flex-col gap-7">
            <MF label={t('bastidor')} value={data.bastidor} highlight size="lg" />
            <MF label={t('secuencia')} value={data.secuencia} size="lg" />
            <MF label={t('modelo')} value={data.modelo} size="lg" />
            <MF label={t('mastil_ref')} value={data.mastil} size="lg" />
            <MF label={t('fec_montaje')} value={data.fecha_montaje} size="lg" />
          </div>
        </div>

        {/* COL 2: Geometría + Capacidades */}
        <div className="px-8 flex flex-col gap-10">
          {data.altura_max_interm != null && (
            <div>
              <STitle icon="⟋" label={t('geometria')} />
              <div className="mb-4">
                <MF label={t('alt_max_interm')} value={data.altura_max_interm} unit="mm" size="lg" />
              </div>
            </div>
          )}
          {(data.peso_pruebas != null || data.capac_interm_1 != null || data.capac_interm_2 != null) && (
            <div>
              <STitle icon="⚖" label={t('cargas_y_capacidades')} />
              <div className="flex flex-col gap-7">
                {data.peso_pruebas != null && (
                  <MF label={t('peso_pruebas')} value={data.peso_pruebas} unit="kg" size="lg" highlight />
                )}
                <MF label={t('capac_interm_1')} value={data.capac_interm_1 ?? 0} unit="kg" size="lg" />
                <MF label={t('capac_interm_2')} value={data.capac_interm_2 ?? 0} unit="kg" size="lg" />
                {data.capac_interm_3 != null && (
                  <MF label={t('capac_interm_3')} value={data.capac_interm_3} unit="kg" size="lg" />
                )}
              </div>
            </div>
          )}
        </div>

        {/* COL 3: Tiempos Con Carga */}
        <div className="px-8 flex flex-col gap-8">
          {data.tpo_elevac_min != null && (
            <div>
              <STitle icon="⏱" label={t('tpo_con_carga')} />
              <div className="flex flex-col gap-7">
                <MF label={t('elevacion_min')} value={ds2sP(data.tpo_elevac_min)} size="lg" />
                <MF label={t('elevacion_max')} value={ds2sP(data.tpo_elevac_max)} size="lg" />
                <MF label={t('descenso_min')} value={ds2sP(data.tpo_descenso_min)} size="lg" />
                <MF label={t('descenso_max')} value={ds2sP(data.tpo_descenso_max)} size="lg" />
              </div>
            </div>
          )}
        </div>

        {/* COL 4: Tiempos Sin Carga */}
        <div className="pl-8 flex flex-col gap-8">
          {data.tpo_elev_min_scarga != null && (
            <div>
              <STitle icon="↺" label={t('tpo_sin_carga')} />
              <div className="flex flex-col gap-7">
                <MF label={t('elevacion_min')} value={ds2sP(data.tpo_elev_min_scarga)} size="lg" />
                <MF label={t('elevacion_max')} value={ds2sP(data.tpo_elev_max_scarga)} size="lg" />
                <MF label={t('descenso_min')} value={ds2sP(data.tpo_desc_min_scarga)} size="lg" />
                <MF label={t('descenso_max')} value={ds2sP(data.tpo_desc_max_scarga)} size="lg" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="px-10 py-6 border-t-2 border-[#2e404a] bg-[#111c24] flex items-center justify-between shrink-0">
        <button
          onClick={onCancel}
          className="text-2xl font-black uppercase tracking-[0.2em] text-[#6b8fa3] hover:text-white transition-all px-8 py-4 rounded-xl hover:bg-white/10 active:scale-95"
        >
          {t('cancelar')}
        </button>
        {error && (
          <div className="text-red-500 font-black text-xl px-6 py-3 border-2 border-red-500/30 bg-red-500/10 rounded-xl flex items-center gap-2 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.15)] shrink-0">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
        <button
          onClick={handleTrigger}
          disabled={displayTime !== null && displayTime > 0}
          className={`flex items-center justify-center gap-4 px-16 py-6 rounded-2xl text-white font-black text-3xl uppercase tracking-widest transition-all shadow-[0_0_50px_rgba(221,40,118,0.5)] border-2 min-w-[400px]
            ${displayTime !== null && displayTime > 0 
              ? 'bg-logisnext-magenta/50 border-logisnext-magenta/30 cursor-wait'
              : 'bg-logisnext-magenta hover:bg-logisnext-magenta/80 active:scale-95 border-pink-400/50'
            }`}
        >
          {displayTime !== null && displayTime > 0 ? (
            <>
              <Timer size={32} className="animate-pulse" />
              {t('cargar_secuencia_display').replace('{displayTime}', displayTime)}
            </>
          ) : (
            <>{t('cargar_secuencia_btn')} <span className="text-4xl translate-y-[-2px]">&gt;</span></>
          )}
        </button>
      </div>
    </div>
  </div>,
  document.body
);
};





const ActionBtn = ({ onClick, children, disabled = false, variant = 'primary', className = '' }) => {
  const base = 'w-full py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5';
  const variants = {
    primary: 'bg-logisnext-magenta/90 hover:bg-logisnext-magenta text-white shadow-[0_0_12px_rgba(221,40,118,0.3)]',
    secondary: 'bg-[#1d2930] hover:bg-[#2e404a] text-logisnext-lightslate border border-[#2e404a]',
    success: 'bg-green-700/80 hover:bg-green-600 text-white',
    danger: 'bg-red-700/80 hover:bg-red-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.3)]',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
};

// ─── Componente LED de la Cámara ─────────────────────────────────────────────
const CameraLED = ({ state, blinkTick }) => {
  let color = 'bg-gray-500';
  let shadow = '';
  let isBlinking = false;

  if (state === 'standby') {
    color = 'bg-red-500';
    shadow = 'shadow-[0_0_10px_rgba(239,68,68,0.8)]';
    isBlinking = true;
  } else if (state === 'standby-ok' || state === 'active') {
    color = 'bg-green-500';
    shadow = 'shadow-[0_0_10px_rgba(34,197,94,0.8)]';
    isBlinking = true;
  } else if (state === 'ok') {
    color = 'bg-green-500';
    shadow = 'shadow-[0_0_15px_rgba(34,197,94,0.9)]';
    isBlinking = false;
  } else if (state === 'nok') {
    color = 'bg-red-500';
    shadow = 'shadow-[0_0_15px_rgba(239,68,68,0.9)]';
    isBlinking = false;
  }


  const opacity = (isBlinking && !blinkTick) ? 'opacity-30' : 'opacity-100';

  return (
    <div className={`w-3.5 h-3.5 rounded-full ${color} ${shadow} ${opacity} transition-opacity duration-200 border border-white/20`} />
  );
};

// ─── Componente principal ────────────────────────────────────────────────────

const Sequencer = ({ erpData, onErpData, onOpenErp, palletState, setPalletState, plcState, setStep2Overlay, setTestHUDOverlay, setWaitingForIniciar, sequencerRef, onSequenceEnd, onStepChange, operario, isSimulation, isAnyModalOpen, iniciarPlcTime, telemetry, setFenceAlarmActive, setFenceReposoAlarmActive }) => {
  const { t } = useLanguage();
  const [stepStatus, setStepStatus] = useState([
    STEP_STATUS.ACTIVE,
    STEP_STATUS.PENDING,
    STEP_STATUS.PENDING,
    STEP_STATUS.PENDING,
    STEP_STATUS.PENDING,
  ]);
  const [fenceState, setFenceState] = useState('idle'); // idle | lowering | down | raising
  const [fenceTimer, setFenceTimer] = useState(0);
  const [stepStarted, setStepStarted] = useState([true, false, false, false, false]);
  // Timestamps (ms) de cuando cada paso empieza y termina
  const [stepStartTime, setStepStartTime] = useState([null, null, null, null, null]);
  const [stepDurations, setStepDurations] = useState([null, null, null, null, null]); // segundos
  // Posición real de la pegatina (mm)
  const [pegatinaPosicion, setPegatinaPosicion] = useState(null);
  const [iniciarCountdown, setIniciarCountdown] = useState(null);
  const [abortarCountdown, setAbortarCountdown] = useState(null);
  const [pegatinaCountdown, setPegatinaCountdown] = useState(null);
  const [repetirCountdown, setRepetirCountdown] = useState(null);
  const currentStep = stepStatus.findIndex(s => s === STEP_STATUS.ACTIVE);
  const isSequenceFinished = stepStatus[0] === STEP_STATUS.OK && !stepStatus.includes(STEP_STATUS.ACTIVE) && !stepStatus.includes(STEP_STATUS.PENDING);

  // Helper para determinar la distancia de prueba (1m vs 2m)
  const is1mTest = (() => {
    const mastilStr = erpData?.mastil;
    if (!mastilStr) return false;
    const str = String(mastilStr).trim().toUpperCase();
    if (str.startsWith('2F')) return true;
    const match = str.match(/\d{3,}/);
    if (match) return parseInt(match[0], 10) < 400;
    return false;
  })();

  // Guardar datos específicos de etapas para el log global
  const stageDataRef = useRef({
    3: { elev: null, desc: null },
    4: { elev: null, desc: null, cargaGet: null },
    5: { altura_inicial: null, altura_final: null, diff: null }
  });

  const stepInitRef = useRef({});
  const step3PalletTriggeredRef = useRef(false); // evita bucle animating→picked_up→animating en etapa 3
  const step4PalletTriggeredRef = useRef(false); // evita bucle animating→picked_up→animating en etapa 4

  const lastStep2OverlayRef = useRef(null);
  const updateStep2Overlay = (newValue) => {
    if (!setStep2Overlay) return;
    const isSame = JSON.stringify(lastStep2OverlayRef.current) === JSON.stringify(newValue);
    if (!isSame) {
      lastStep2OverlayRef.current = newValue;
      setStep2Overlay(newValue);
    }
  };

  const lastTestHUDOverlayRef = useRef(null);
  const updateTestHUDOverlay = (newValue) => {
    if (!setTestHUDOverlay) return;
    const isSame = JSON.stringify(lastTestHUDOverlayRef.current) === JSON.stringify(newValue);
    if (!isSame) {
      lastTestHUDOverlayRef.current = newValue;
      setTestHUDOverlay(newValue);
    }
  };

  useEffect(() => {
    if (onStepChange) onStepChange(currentStep);
  }, [currentStep, onStepChange]);

  // Timer para parpadeo de LEDs (1s)
  const [blinkTick, setBlinkTick] = useState(true);
  useEffect(() => {
    const intv = setInterval(() => setBlinkTick(b => !b), 1000);
    return () => clearInterval(intv);
  }, []);

  const [seqInput, setSeqInput] = useState('');
  const [seqLoading, setSeqLoading] = useState(false);
  const [seqError, setSeqError] = useState('');
  const [scannedSeq, setScannedSeq] = useState(null);
  const [inputMode, setInputMode] = useState('scanner'); // 'scanner' | 'manual'
  const [manualDigits, setManualDigits] = useState('');
  const [manualBastidor, setManualBastidor] = useState('');
  const [erpPreview, setErpPreview] = useState(null); // ERP data pending user confirmation
  const previewConfirmedRef = useRef(null); // bastidor del último preview confirmado
  const [timer5min, setTimer5min] = useState(null);
  const [test5mState, setTest5mState] = useState('idle'); // 'idle' | 'stabilizing' | 'running' | 'ok' | 'nok'
  const [test5mConfig, setTest5mConfig] = useState({
    duration: parseInt(localStorage.getItem('test5mDuration')) || 300,
    tolerancia: parseInt(localStorage.getItem('test5mTolerancia')) || 10
  });
  
  const [cotaInicial, setCotaInicial] = useState(() => parseInt(localStorage.getItem('cotaInicialPruebas')) || 1500);
  const [syncTrigger, setSyncTrigger] = useState(0);

  // Refs para lógica de la etapa 5
  const stage5InitialHeightRef = useRef(null);
  const stage5StableStartRef = useRef(null);
  const stage5TimerStartRef = useRef(null);

  const timer5minRef = useRef(null);

  // Estado para la prueba de cámara
  // Estados: 'standby' | 'esperando_1500' | 'ascenso' | 'espera_arriba' | 'descenso' | 'ok' | 'nok'
  const [cameraTestState, setCameraTestState] = useState('standby');
  const [testAlarm, setTestAlarm] = useState(null); // 'ascenso_incompleto', 'descenso_incompleto'
  const [simTimers, setSimTimers] = useState({ elev: null, desc: null, finishedElev: false, finishedDesc: false, pendingReadDesc: false });

  const [waitCountdown, setWaitCountdown] = useState(null); // cuenta atrás 3-2-1 en espera_arriba
  const waitCountdownRef = useRef(null);

  // Modal para repetir prueba
  const [repeatModal, setRepeatModal] = useState({
    show: false,
    log: null,
    selections: [true, true, true, true]
  });

  const plcStateRef = useRef(plcState);
  useEffect(() => { plcStateRef.current = plcState; }, [plcState]);

  const resetStartsInPlc = () => {
    const payload = {
      inicia_temporizador_ascenso: false,
      inicia_temporizador_descenso: false,
      is_force: isSimulation
    };
    fetch(`${API_BASE}/plc/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(translatePayload(payload, isSimulation))
    }).catch(err => console.error("Error resetting PLC starts:", err));
  };

  useEffect(() => {
    resetStartsInPlc();
  }, [currentStep, isSimulation]);

  const testLoopStateRef = useRef({
    tStartElev: null,
    tStartDesc: null,
    lastH: null,
    lastHChangeTime: null,
    tTopReachTime: null,
    hTopReach: null,
    prevH: null
  });

  // ── Temporizadores simulados y máquina de estados (válido para ambos modos) ──
  useEffect(() => {
    if (cameraTestState === 'standby' || cameraTestState === 'esperando_1500') {
      if (cameraTestState === 'standby') {
        setSimTimers({ elev: null, desc: null, finishedElev: false, finishedDesc: false, pendingReadDesc: false });
        setWaitCountdown(null);
        setTestAlarm(null);
      }
      testLoopStateRef.current = {
        tStartElev: null,
        tStartDesc: null,
        lastH: null,
        lastHChangeTime: Date.now(),
        tTopReachTime: null,
        hTopReach: null,
        prevH: null
      };
      if (cameraTestState === 'standby') return;
    }

    let reqId;

    const getH = () => {
      // h siempre en metros para que sea consistente con cotaM
      const fastPlc = isSimulation 
        ? { ...(window.__fastRawPlcState || {}), Ob_Estado_Automatico: true }
        : (window.__fastPlcState || {});
      
      const currentPlc = (Object.keys(fastPlc).length > 0) ? fastPlc : (plcStateRef.current || {});

      const raw = isSimulation
        ? (window.__carriageY || 0)                                 // ya está en metros
        : (currentPlc.OR_Altura_Carretilla || 0) / 1000;            // PLC da mm → convertir a m
      return parseFloat(Number(raw).toFixed(3));
    };

    const s = testLoopStateRef.current;
    if (s.lastH === null) {
      s.lastH = getH();
      s.prevH = getH();
      s.lastHChangeTime = Date.now();
    }
    const cotaM = cotaInicial / 1000;

    // The target height difference
    let testDist = is1mTest ? 1.0 : 2.0;

    const loop = () => {
      const h = getH();


      // ── ESTADO: esperando_1500 — detectar inicio del test ──
      if (cameraTestState === 'esperando_1500') {
        // Para empezar el temporizador, siempre tenemos que estar por debajo de la cota
        // y detectar el cruce hacia arriba (h > cotaM y el valor anterior estaba por debajo o igual)
        if (h > cotaM && s.prevH !== null && s.prevH <= cotaM) {
          setCameraTestState('ascenso');
          s.prevH = h;
          reqId = requestAnimationFrame(loop);
          return;
        }
        s.prevH = h;
        reqId = requestAnimationFrame(loop);
        return;
      }

      // Control de parada incompleta (2 segundos sin variación > 0.01m)
      if (Math.abs(h - s.lastH) > 0.01) {
        s.lastH = h;
        s.lastHChangeTime = Date.now();
      }

      if (cameraTestState === 'ascenso') {

        if (isSimulation) {
          // SIMULACIÓN: detectar fin de ascenso por altura y medir con Date.now()
          const isAscentFinished = h >= cotaM + testDist;
          if (isAscentFinished && !simTimersRef.current.finishedElev) {
            const finalElev = Math.floor((Date.now() - (s.tStartElev || Date.now())) / 10);
            setSimTimers(prev => ({ ...prev, finishedElev: true, elev: finalElev }));
            fetch(`${API_BASE}/plc/write`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ or_tiempo_elevacion: finalElev * 10, OW_Tiempo_Elevacion: finalElev * 10, is_force: true })
            }).catch(console.error);
            setCameraTestState('espera_arriba');
            setWaitCountdown(3);
            s.tTopReachTime = null;
          } else if (!s.tStartElev) {
            s.tStartElev = Date.now();
          }
        }
        // PLC REAL: el fin del ascenso lo detecta el flanco 0→1 de Ob_Ready_Temporizador.
        // El useEffect del flanco captura el tiempo y transiciona a 'espera_arriba'.
        // Este loop solo gestiona la alarma de ascenso incompleto.
      } else if (cameraTestState === 'espera_arriba') {
        if (!s.tTopReachTime) {
          s.tTopReachTime = Date.now();
          s.hTopReach = h;
        }

        const waited = Date.now() - s.tTopReachTime;
        if (waited < 3000) {
          // Antes de los 3s: si la carretilla varía más de 10mm (+/- 0.01m), reiniciar el contador
          if (Math.abs(h - s.hTopReach) > 0.01) {
            s.tTopReachTime = Date.now();
            s.hTopReach = h;
          }
          const remaining = Math.ceil((3000 - (Date.now() - s.tTopReachTime)) / 1000);
          const val = Math.max(1, remaining);
          if (waitCountdownRef.current !== val) {
            waitCountdownRef.current = val;
            setWaitCountdown(val);
          }
        } else {
          // 3 segundos completados — mostrar GO! hasta que el operario baje
          if (waitCountdownRef.current !== 0) {
            waitCountdownRef.current = 0;
            setWaitCountdown(0);
          }
          // Arrancar descenso solo si notamos variación real de bajada > 10mm (0.01m)
          if (h <= s.hTopReach - 0.01) {
            if (waitCountdownRef.current !== null) {
              waitCountdownRef.current = null;
              setWaitCountdown(null);
            }
            setCameraTestState('descenso');
            s.tStartDesc = null;
          }
        }
      } else if (cameraTestState === 'descenso') {

        if (isSimulation) {
          // SIMULACIÓN: detectar fin de descenso por altura y evaluar directamente
          const isDescentFinished = h <= s.hTopReach - testDist;
          if (isDescentFinished && !simTimersRef.current.finishedDesc) {
            const isSinCarga = currentStep === 2;
            const minElev = isSinCarga ? erpData?.tpo_elev_min_scarga : erpData?.tpo_elevac_min;
            const maxElev = isSinCarga ? erpData?.tpo_elev_max_scarga : erpData?.tpo_elevac_max;
            const minDesc = isSinCarga ? erpData?.tpo_desc_min_scarga : erpData?.tpo_descenso_min;
            const maxDesc = isSinCarga ? erpData?.tpo_desc_max_scarga : erpData?.tpo_descenso_max;
            const finalElev = simTimersRef.current.elev;
            const finalDesc = Math.floor((Date.now() - (s.tStartDesc || Date.now())) / 10);
            setSimTimers(prev => ({ ...prev, finishedDesc: true, desc: finalDesc }));
            fetch(`${API_BASE}/plc/write`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ or_tiempo_descenso: finalDesc * 10, OW_Tiempo_Descenso: finalDesc * 10, is_force: true })
            }).catch(console.error);
            const isElevOk = Number(finalElev) >= Number(minElev) && Number(finalElev) <= Number(maxElev);
            const isDescOk = Number(finalDesc) >= Number(minDesc) && Number(finalDesc) <= Number(maxDesc);
            if (!isElevOk || !isDescOk) {
              setTestAlarm('fuera_tolerancia');
              setCameraTestState('nok');
            } else {
              setTestAlarm(null);
              setCameraTestState('ok');
            }
          } else if (!s.tStartDesc) {
            s.tStartDesc = Date.now();
          }
        }
        // PLC REAL: el fin del descenso lo detecta el flanco 0→1 de Ob_Ready_Temporizador.
        // El useEffect del flanco lee OW_Tiempo_Descenso y evalúa el resultado.
      }

      reqId = requestAnimationFrame(loop);
    };

    reqId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(reqId);
  }, [isSimulation, cameraTestState, erpData, currentStep, cotaInicial]);

  const inputRef = useRef(null);

  // Tolerancias
  const [tolerancias, setTolerancias] = useState({
    positiva: parseInt(localStorage.getItem('toleranciaPositiva')) || 50,
    negativa: parseInt(localStorage.getItem('toleranciaNegativa')) || 50
  });

  useEffect(() => {
    const handleTolerancia = () => {
      setTolerancias({
        positiva: parseInt(localStorage.getItem('toleranciaPositiva')) || 50,
        negativa: parseInt(localStorage.getItem('toleranciaNegativa')) || 50
      });
    };
    const handle5mConfig = () => {
      setTest5mConfig({
        duration: parseInt(localStorage.getItem('test5mDuration')) || 300,
        tolerancia: parseInt(localStorage.getItem('test5mTolerancia')) || 10
      });
    };
    const handleCota = () => {
      setCotaInicial(parseInt(localStorage.getItem('cotaInicialPruebas')) || 1500);
      setSyncTrigger(prev => prev + 1);
    };
    const handleMappingChange = () => {
      setSyncTrigger(prev => prev + 1);
    };
    window.addEventListener('toleranciaChanged', handleTolerancia);
    window.addEventListener('test5mConfigChanged', handle5mConfig);
    window.addEventListener('toleranciaChanged', handleCota);
    window.addEventListener('plcVarMappingChanged', handleMappingChange);
    return () => {
      window.removeEventListener('toleranciaChanged', handleTolerancia);
      window.removeEventListener('test5mConfigChanged', handle5mConfig);
      window.removeEventListener('toleranciaChanged', handleCota);
      window.removeEventListener('plcVarMappingChanged', handleMappingChange);
    };
  }, []);

  // ── Guardar Log Global ────────────────────────────────────────────────────
  const saveLog = async (overrideStatus) => {
    const startSec = stepStartTime[0] || Date.now();
    const endSec = Date.now();
    const erp = erpDataRef.current;
    const sData = stageDataRef.current;
    const prevLog = repeatModal.log || {};

    // Distancia de prueba para cálculo de AVG (mm/s)
    const testDist = (() => {
      const mastilStr = erp?.mastil;
      if (!mastilStr) return 2;
      const str = String(mastilStr).trim().toUpperCase();
      if (str.startsWith('2F')) return 1;
      const match = str.match(/\d{3,}/);
      if (match) return parseInt(match[0], 10) < 400 ? 1 : 2;
      return 2;
    })();

    // Etapa 1: Multiload
    let estadoMultiload = stepStatus[1] === STEP_STATUS.OK ? 'OK' : 'NOK';
    if (stepStatus[1] === STEP_STATUS.SKIP) estadoMultiload = prevLog.ESTADO_MULTILOAD || 'NO APLICA';

    // Etapa 2: Sin Carga
    const elevSin = sData[3].elev;
    const descSin = sData[3].desc;
    const okElevSin = elevSin !== null && elevSin !== undefined && elevSin >= (erp?.tpo_elev_min_scarga || 0) && elevSin <= (erp?.tpo_elev_max_scarga || 9999);
    const okDescSin = descSin !== null && descSin !== undefined && descSin >= (erp?.tpo_desc_min_scarga || 0) && descSin <= (erp?.tpo_desc_max_scarga || 9999);
    let estadoSinCarga = (okElevSin && okDescSin) ? 'OK' : 'NOK';
    if (stepStatus[2] === STEP_STATUS.ACTIVE || stepStatus[2] === STEP_STATUS.PENDING) estadoSinCarga = 'NO COMPLETADO';
    if (stepStatus[2] === STEP_STATUS.SKIP) estadoSinCarga = prevLog.ESTADO_SINCARGA || 'NO APLICA';

    // Etapa 3: Con Carga
    const elevCar = sData[4].elev;
    const descCar = sData[4].desc;
    const okElevCar = elevCar !== null && elevCar !== undefined && elevCar >= (erp?.tpo_elevac_min || 0) && elevCar <= (erp?.tpo_elevac_max || 9999);
    const okDescCar = descCar !== null && descCar !== undefined && descCar >= (erp?.tpo_descenso_min || 0) && descCar <= (erp?.tpo_descenso_max || 9999);
    let estadoConCarga = (okElevCar && okDescCar) ? 'OK' : 'NOK';
    if (stepStatus[3] === STEP_STATUS.ACTIVE || stepStatus[3] === STEP_STATUS.PENDING) estadoConCarga = 'NO COMPLETADO';
    if (stepStatus[3] === STEP_STATUS.SKIP) estadoConCarga = prevLog.ESTADO_CARGA || 'NO APLICA';

    // Etapa 4: 5 Minutos
    let estado5Min = stepStatus[4] === STEP_STATUS.OK ? 'OK' : 'NOK';
    if (stepStatus[4] === STEP_STATUS.SKIP) estado5Min = prevLog.ESTADO_CARGA_5_MIN || 'NO APLICA';

    let calculatedStatus = 'OK';
    if (estadoMultiload === 'NOK' || estadoSinCarga === 'NOK' || estadoConCarga === 'NOK' || estado5Min === 'NOK') {
      calculatedStatus = 'NOK';
    }
    const finalGlobalStatus = overrideStatus === 'NOK' ? 'NOK' : calculatedStatus;

    const logData = {
      id: prevLog.id || null,
      OPERARIO: operario ? `${operario.NOMBRE || ''} ${operario.APELLIDOS || ''}`.trim() : 'Desconocido',
      FECHA_MONTAJE: erp?.fecha_montaje,
      NSECUENCIA: erp?.secuencia,
      NMODELO: erp?.modelo,
      NBASTIDOR: erp?.bastidor,
      NMASTIL: erp?.mastil,
      ALTURA_MAX_INTERMEDIA: erp?.altura_max_interm,
      ALTURA_CAPTADA: stepStatus[1] === STEP_STATUS.SKIP ? prevLog.ALTURA_CAPTADA : pegatinaPosicion,

      // Etapa 1: Multiload
      FECHA_HORA_INICIO_MULTILOAD: stepStatus[1] === STEP_STATUS.SKIP ? prevLog.FECHA_HORA_INICIO_MULTILOAD : (stepStartTime[1] ? new Date(stepStartTime[1]).toISOString() : null),
      FECHA_HORA_FIN_MULTILOAD: stepStatus[1] === STEP_STATUS.SKIP ? prevLog.FECHA_HORA_FIN_MULTILOAD : (stepStartTime[1] && stepDurations[1] ? new Date(stepStartTime[1] + stepDurations[1] * 1000).toISOString() : null),
      ESTADO_MULTILOAD: estadoMultiload,

      // Etapa 2: Sin Carga
      TIEMPO_ELEVACION_MIN_SINCARGA: erp?.tpo_elev_min_scarga != null ? erp.tpo_elev_min_scarga / 100 : null,
      TIEMPO_ELEVACION_MAX_SINCARGA: erp?.tpo_elev_max_scarga != null ? erp.tpo_elev_max_scarga / 100 : null,
      TIEMPO_ELEVACION_MEDIDO_SINCARGA: stepStatus[2] === STEP_STATUS.SKIP ? prevLog.TIEMPO_ELEVACION_MEDIDO_SINCARGA : (sData[3].elev != null ? sData[3].elev / 100 : null),
      TIEMPO_DESCENSO_MIN_SINCARGA: erp?.tpo_desc_min_scarga != null ? erp.tpo_desc_min_scarga / 100 : null,
      TIEMPO_DESCENSO_MAX_SINCARGA: erp?.tpo_desc_max_scarga != null ? erp.tpo_desc_max_scarga / 100 : null,
      TIEMPO_DESCENSO_MEDIDO_SINCARGA: stepStatus[2] === STEP_STATUS.SKIP ? prevLog.TIEMPO_DESCENSO_MEDIDO_SINCARGA : (sData[3].desc != null ? sData[3].desc / 100 : null),
      AVG_ELEVACION_SINCARGA: stepStatus[2] === STEP_STATUS.SKIP ? prevLog.AVG_ELEVACION_SINCARGA : (sData[3].elev > 0 ? Number(((testDist * 100000) / sData[3].elev).toFixed(0)) : null),
      AVG_DESCENSO_SINCARGA: stepStatus[2] === STEP_STATUS.SKIP ? prevLog.AVG_DESCENSO_SINCARGA : (sData[3].desc > 0 ? Number(((testDist * 100000) / sData[3].desc).toFixed(0)) : null),
      FECHA_HORA_INICIO_SINCARGA: stepStatus[2] === STEP_STATUS.SKIP ? prevLog.FECHA_HORA_INICIO_SINCARGA : (stepStartTime[2] ? new Date(stepStartTime[2]).toISOString() : null),
      FECHA_HORA_FIN_SINCARGA: stepStatus[2] === STEP_STATUS.SKIP ? prevLog.FECHA_HORA_FIN_SINCARGA : (stepStartTime[2] && stepDurations[2] ? new Date(stepStartTime[2] + stepDurations[2] * 1000).toISOString() : null),
      ESTADO_SINCARGA: estadoSinCarga,

      // Etapa 3: Con Carga
      TIEMPO_ELEVACION_MIN_CARGA: erp?.tpo_elevac_min != null ? erp.tpo_elevac_min / 100 : null,
      TIEMPO_ELEVACION_MAX_CARGA: erp?.tpo_elevac_max != null ? erp.tpo_elevac_max / 100 : null,
      TIEMPO_ELEVACION_MEDIDO_CARGA: stepStatus[3] === STEP_STATUS.SKIP ? prevLog.TIEMPO_ELEVACION_MEDIDO_CARGA : (sData[4].elev != null ? sData[4].elev / 100 : null),
      TIEMPO_DESCENSO_MIN_CARGA: erp?.tpo_descenso_min != null ? erp.tpo_descenso_min / 100 : null,
      TIEMPO_DESCENSO_MAX_CARGA: erp?.tpo_descenso_max != null ? erp.tpo_descenso_max / 100 : null,
      TIEMPO_DESCENSO_MEDIDO_CARGA: stepStatus[3] === STEP_STATUS.SKIP ? prevLog.TIEMPO_DESCENSO_MEDIDO_CARGA : (sData[4].desc != null ? sData[4].desc / 100 : null),
      AVG_ELEVACION_CARGA: stepStatus[3] === STEP_STATUS.SKIP ? prevLog.AVG_ELEVACION_CARGA : (sData[4].elev > 0 ? Number(((testDist * 100000) / sData[4].elev).toFixed(0)) : null),
      AVG_DESCENSO_CARGA: stepStatus[3] === STEP_STATUS.SKIP ? prevLog.AVG_DESCENSO_CARGA : (sData[4].desc > 0 ? Number(((testDist * 100000) / sData[4].desc).toFixed(0)) : null),
      FECHA_HORA_INICIO_CARGA: stepStatus[3] === STEP_STATUS.SKIP ? prevLog.FECHA_HORA_INICIO_CARGA : (stepStartTime[3] ? new Date(stepStartTime[3]).toISOString() : null),
      FECHA_HORA_FIN_CARGA: stepStatus[3] === STEP_STATUS.SKIP ? prevLog.FECHA_HORA_FIN_CARGA : (stepStartTime[3] && stepDurations[3] ? new Date(stepStartTime[3] + stepDurations[3] * 1000).toISOString() : null),
      ESTADO_CARGA: estadoConCarga,
      CARGA_CONSIGNADA: erp?.peso_pruebas,
      CARGA_GET: stepStatus[3] === STEP_STATUS.SKIP ? prevLog.CARGA_GET : sData[4].cargaGet,
      PESO_PRUEBA: stepStatus[3] === STEP_STATUS.SKIP ? prevLog.PESO_PRUEBA : (erp?.peso_pruebas != null ? Math.floor(erp.peso_pruebas / 250) * 250 : null),

      // Etapa 4: 5 Minutos
      ALTURA_INICIAL: stepStatus[4] === STEP_STATUS.SKIP ? prevLog.ALTURA_INICIAL : sData[5].altura_inicial,
      ALTURA_FINAL: stepStatus[4] === STEP_STATUS.SKIP ? prevLog.ALTURA_FINAL : sData[5].altura_final,
      DIFERENCIA_ALTURAS: stepStatus[4] === STEP_STATUS.SKIP ? prevLog.DIFERENCIA_ALTURAS : sData[5].diff,
      FECHA_HORA_INICIO_5MIN: stepStatus[4] === STEP_STATUS.SKIP ? prevLog.FECHA_HORA_INICIO_5MIN : (stepStartTime[4] ? new Date(stepStartTime[4]).toISOString() : null),
      FECHA_HORA_FIN_5MIN: stepStatus[4] === STEP_STATUS.SKIP ? prevLog.FECHA_HORA_FIN_5MIN : (stepStartTime[4] && stepDurations[4] ? new Date(stepStartTime[4] + stepDurations[4] * 1000).toISOString() : null),
      ESTADO_CARGA_5_MIN: estado5Min,

      // Secuencia Global
      REPETICIONES_SECUENCIA: prevLog.REPETICIONES_SECUENCIA ? prevLog.REPETICIONES_SECUENCIA + 1 : 1,
      FECHA_HORA_INICIO_SEC: new Date(startSec).toISOString(),
      FECHA_HORA_FIN_SEC: new Date(endSec).toISOString(),
      DURACION_SEC: formatDuration(Math.floor((endSec - startSec) / 1000)),
      OK_NOK: finalGlobalStatus
    };

    try {
      await fetch(`${API_BASE}/api/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData)
      });
      // Sincronizar también con la referencia en ciclo al terminar
      await fetch(`${API_BASE}/api/cycle/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData)
      });
    } catch (e) { console.error("Error guardando log global:", e); }
  };

  const updateCycleInDb = (fields) => {
    fetch(`${API_BASE}/api/cycle/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    }).catch(err => console.error("Error updating cycle database:", err));
  };

  const resetSequence = (keepRaisingFences = false) => {
    // Reset cycle tracking in DB
    fetch(`${API_BASE}/api/cycle/reset`, { method: 'POST' })
      .catch(err => console.error("Error resetting cycle reference tracking:", err));

    // Si aborta o resetea secuencia, la altura relativa tiene que ser 0 en el PLC
    const payload = {
      altura_relativa: 0,
      is_force: isSimulation
    };
    fetch(`${API_BASE}/plc/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(translatePayload(payload, isSimulation))
    }).catch(err => console.error("Error resetting PLC relative height on reset:", err));

    resetStartsInPlc();

    setStepStatus([STEP_STATUS.ACTIVE, STEP_STATUS.PENDING, STEP_STATUS.PENDING, STEP_STATUS.PENDING, STEP_STATUS.PENDING]);
    setStepStarted([true, false, false, false, false]);
    setStepStartTime([Date.now(), null, null, null, null]);
    setStepDurations([null, null, null, null, null]);
    stageDataRef.current = {
      3: { elev: null, desc: null },
      4: { elev: null, desc: null, cargaGet: null },
      5: { altura_inicial: null, altura_final: null, diff: null }
    };
    stepInitRef.current = {};
    step3PalletTriggeredRef.current = false;
    step4PalletTriggeredRef.current = false;
    setPegatinaPosicion(null);
    setSeqInput('');
    setSeqError('');
    setScannedSeq(null);
    setManualDigits('');
    setTimer5min(null);
    setTest5mState('idle');
    setCameraTestState('standby');
    setTestAlarm(null);
    setWaitCountdown(null);
    setSimTimers({ elev: null, desc: null, finishedElev: false, finishedDesc: false, pendingReadDesc: false });
    setRepeatModal({ show: false, log: null, selections: [true, true, true, true] });
    if (setStep2Overlay) setStep2Overlay(null);
    if (setPalletState) setPalletState('idle');
    if (onErpData) onErpData(null);
    setErpPreview(null);
    previewConfirmedRef.current = null;
    
    if (!keepRaisingFences) {
      setFenceState('idle');
      setFenceTimer(0);
      if (setFenceAlarmActive) setFenceAlarmActive(false);
      if (setFenceReposoAlarmActive) setFenceReposoAlarmActive(false);
      writePlc({ Ib_EV_VALLA_TRABAJO: false, Ib_EV_VALLA_REPOSO: false });
    }
  };

  const handleAbort = () => {
    // Si aborta secuencia la altura relativa tiene que ser 0
    const payload = {
      altura_relativa: 0,
      is_force: isSimulation
    };
    fetch(`${API_BASE}/plc/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(translatePayload(payload, isSimulation))
    }).catch(err => console.error("Error setting relative height to 0 on abort:", err));

    // Levantar vallas inmediatamente por seguridad al abortar si no están en reposo
    const needsToRaise = plcStateRef.current ? plcStateRef.current.Ob_Reposo_Cilindro_Valla_1 !== true : false;

    if (needsToRaise) {
      console.log("Aborted sequence. Fences not in rest position, raising them.");
      setFenceState('raising');
      setFenceTimer(60);
      if (setFenceReposoAlarmActive) setFenceReposoAlarmActive(false);
      writePlc({ Ib_EV_VALLA_REPOSO: true, Ib_EV_VALLA_TRABAJO: false });
    } else {
      console.log("Aborted sequence. Fences already in rest position.");
    }

    if (onSequenceEnd) onSequenceEnd();
    resetSequence(needsToRaise);
  };

  // ── Auto-Reseteo cuando la prueba termina y las vallas vuelven a reposo ────
  useEffect(() => {
    if (isSequenceFinished && plcState) {
      const vallaReposo = plcState.Ob_Reposo_Cilindro_Valla_1 === true;
      if (vallaReposo) {
        if (onSequenceEnd) onSequenceEnd();
        resetSequence();
      }
    }
  }, [isSequenceFinished, plcState?.Ob_Reposo_Cilindro_Valla_1]);



  // ── Reset automático del temporizador fuera de etapas 3 y 4 (UI) ──────────
  // Si el temporizador NO está ready y NO estamos en la etapa 3 o 4 (currentStep 2/3),
  // mantener Ib_Restart_Temporizador = true hasta que Ob_Ready_Temporizador se confirme,
  // y solo entonces enviarlo a false.
  const timerResetHoldingRef = useRef(false); // true mientras mantenemos el reset activo
  useEffect(() => {
    const currentResetVal = telemetry?.mappedPlc?.Ib_Restart_Temporizador ?? plcState?.Ib_Restart_Temporizador;

    // Solo actuar en las etapas de posicionamiento (pasos 1 y 2, que son index 0 y 1)
    if (currentStep !== 0 && currentStep !== 1) {
      // Si salimos de ese rango y el reset está activo (localmente o en el PLC), asegurarse de liberarlo
      if (timerResetHoldingRef.current || currentResetVal === true) {
        timerResetHoldingRef.current = false;
        const targetVar = (!isSimulation)
          ? Object.keys(JSON.parse(localStorage.getItem('plcVarMapping') || '{}')).find(k => JSON.parse(localStorage.getItem('plcVarMapping'))[k].appVar === 'Ib_Restart_Temporizador')
          : 'Ib_Restart_Temporizador';
        if (targetVar) {
          console.log(`[TEMPORIZADORES] Fuera de etapa de posicionamiento (step ${currentStep + 1}) — Liberando Restart=false.`);
          fetch(`${API_BASE}/plc/write`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [targetVar]: false, is_force: isSimulation })
          }).catch(err => console.error('[TEMPORIZADORES] Error liberando reset al salir de posicionamiento:', err));
        }
      }
      return;
    }

    const isReady = telemetry?.mappedPlc?.Ob_Ready_Temporizador ?? plcState?.Ob_Ready_Temporizador;
    const targetVar = (!isSimulation)
      ? Object.keys(JSON.parse(localStorage.getItem('plcVarMapping') || '{}')).find(k => JSON.parse(localStorage.getItem('plcVarMapping'))[k].appVar === 'Ib_Restart_Temporizador')
      : 'Ib_Restart_Temporizador';

    if (!targetVar) return;

    if (isReady === false && !timerResetHoldingRef.current) {
      // Temporizador no listo → activar reset y marcar que estamos en hold
      timerResetHoldingRef.current = true;
      console.log(`[TEMPORIZADORES] Fuera de etapa 3/4, no ready (step ${currentStep + 1}). Manteniendo Restart=true...`);
      fetch(`${API_BASE}/plc/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [targetVar]: true, is_force: isSimulation })
      }).catch(err => console.error('[TEMPORIZADORES] Error activando reset:', err));
    }

    if (isReady === true && (timerResetHoldingRef.current || currentResetVal === true)) {
      // El PLC confirmó que ya está ready (o vemos que el restart está en true en el PLC) → liberar el reset
      timerResetHoldingRef.current = false;
      console.log(`[TEMPORIZADORES] Ready es true (step ${currentStep + 1}). Liberando Restart=false.`);
      fetch(`${API_BASE}/plc/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [targetVar]: false, is_force: isSimulation })
      }).catch(err => console.error('[TEMPORIZADORES] Error liberando reset:', err));
    }
  }, [
    currentStep,
    telemetry?.mappedPlc?.Ob_Ready_Temporizador,
    plcState?.Ob_Ready_Temporizador,
    telemetry?.mappedPlc?.Ib_Restart_Temporizador,
    plcState?.Ib_Restart_Temporizador,
    isSimulation
  ]);

  // ── Auto-Avanzar PASO 1 si se carga desde ERP Modal ───────────────
  useEffect(() => {
    if (!erpData || stepStatus[0] !== STEP_STATUS.ACTIVE || repeatModal.show) return;

    // Mostrar preview si aún no se ha confirmado para este bastidor
    if (!erpPreview && previewConfirmedRef.current !== erpData.bastidor) {
      setErpPreview(erpData);
      return;
    }

    // Preview confirmado: avanzar secuencia
    if (!erpPreview && previewConfirmedRef.current === erpData.bastidor) {
      const advance = async () => {
        setScannedSeq(null);
        setSeqError('');
        try {
          const res = await fetch(`${API_BASE}/api/logs/bastidor/${encodeURIComponent(erpData.bastidor)}`);
          if (res.ok) {
            const log = await res.json();
            if (log) {
              setRepeatModal({
                show: true,
                log: log,
                selections: [
                  log.ESTADO_MULTILOAD !== 'OK' && log.ESTADO_MULTILOAD !== 'NO APLICA',
                  log.ESTADO_SINCARGA !== 'OK' && log.ESTADO_SINCARGA !== 'NO APLICA',
                  log.ESTADO_CARGA !== 'OK' && log.ESTADO_CARGA !== 'NO APLICA',
                  log.ESTADO_CARGA_5_MIN !== 'OK' && log.ESTADO_CARGA_5_MIN !== 'NO APLICA'
                ]
              });
              return;
            }
          }
        } catch (e) {
          console.error('Error fetching previous log', e);
        }
        setStepStatus(prev => {
          const next = [...prev];
          next[0] = STEP_STATUS.OK;
          next[1] = STEP_STATUS.ACTIVE;
          return next;
        });
      };
      advance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [erpData, stepStatus, repeatModal.show, erpPreview]);

  const handleRepeatConfirm = () => {
    setStepStatus(prev => {
      const next = [...prev];
      next[0] = STEP_STATUS.OK; // Paso 1 completado
      next[1] = repeatModal.selections[0] ? STEP_STATUS.PENDING : STEP_STATUS.SKIP;
      next[2] = repeatModal.selections[1] ? STEP_STATUS.PENDING : STEP_STATUS.SKIP;
      next[3] = repeatModal.selections[2] ? STEP_STATUS.PENDING : STEP_STATUS.SKIP;
      next[4] = repeatModal.selections[3] ? STEP_STATUS.PENDING : STEP_STATUS.SKIP;

      // Buscar el siguiente paso que deba estar activo
      for (let i = 1; i < next.length; i++) {
        if (next[i] === STEP_STATUS.PENDING) {
          next[i] = STEP_STATUS.ACTIVE;
          break;
        }
      }
      return next;
    });
    setRepeatModal({ ...repeatModal, show: false });
  };

  // Helper for writing variables to PLC
  const writePlc = (payload) => {
    return fetch(`${API_BASE}/plc/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(translatePayload({ ...payload, is_force: isSimulation }, isSimulation))
    }).catch(err => console.error("Error writing to PLC:", err));
  };

  // ── Abortar prueba en curso si se abre la jaula ───────────────
  useEffect(() => {
    // Solo abortar si las vallas se abren en la etapa 4 o 5 (índices 3 y 4) Y la etapa ya está iniciada Y ya estaban en trabajo (down)
    if (erpData && (currentStep === 3 || currentStep === 4) && stepStarted[currentStep]) {
      const isDownFront = plcState?.Ob_Trabajo_Cilindro_Valla_1 === true;
      const isDownRear = plcState?.Ob_Trabajo_Cilindro_Valla_2 === true;

      if (fenceState === 'down' && (!isDownRear || !isDownFront)) {
        console.warn("Seguridad Comprometida: Vallas abiertas durante el test. Abortando...");
        handleAbort();
      }
    }
  }, [plcState, erpData, currentStep, stepStarted, fenceState]);

  // ── Control de Temporizadores y watchdog de vallas ───────────
  useEffect(() => {
    if (fenceState === 'idle') return;
    
    const intervalId = setInterval(() => {
      setFenceTimer(prev => {
        if (prev <= 1) {
          clearInterval(intervalId);
          if (fenceState === 'lowering') {
            console.warn("Watchdog timeout: Vallas no alcanzaron posición de trabajo en 60 segundos.");
            writePlc({ Ib_EV_VALLA_TRABAJO: false });
            if (setFenceAlarmActive) {
              setFenceAlarmActive(true);
            }
            setFenceState('idle');
          } else if (fenceState === 'raising') {
            console.warn("Watchdog timeout: Vallas no alcanzaron posición de reposo en 60 segundos.");
            writePlc({ Ib_EV_VALLA_REPOSO: false });
            if (setFenceReposoAlarmActive) {
              setFenceReposoAlarmActive(true);
            }
            setFenceState('idle');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [fenceState]);

  // ── Trigger bajar vallas al iniciar Etapa 4 o 5 ──────────────
  useEffect(() => {
    const isStage4or5 = currentStep === 3 || currentStep === 4;
    if (isStage4or5 && stepStarted[currentStep]) {
      if (fenceState === 'idle') {
        const valla1Trabajo = plcState?.Ob_Trabajo_Cilindro_Valla_1 === true;
        const valla2Trabajo = plcState?.Ob_Trabajo_Cilindro_Valla_2 === true;
        
        // Si los detectores ya están en posición de trabajo, no enviamos la orden al PLC
        if (valla1Trabajo && valla2Trabajo) {
          console.log("Fences already in work position. Setting fenceState to down without PLC action.");
          setFenceState('down');
          return;
        }

        console.log(`Starting fence lowering for step ${currentStep}`);
        setFenceState('lowering');
        setFenceTimer(60);
        if (setFenceAlarmActive) setFenceAlarmActive(false);
        if (setFenceReposoAlarmActive) setFenceReposoAlarmActive(false);
        writePlc({ Ib_EV_VALLA_TRABAJO: true, Ib_EV_VALLA_REPOSO: false });
      }
    }
  }, [currentStep, stepStarted, fenceState, plcState?.Ob_Trabajo_Cilindro_Valla_1, plcState?.Ob_Trabajo_Cilindro_Valla_2]);

  // ── Detección de vallas abajo (trabajo) ─────────────────────
  useEffect(() => {
    if (fenceState === 'lowering') {
      const valla1 = plcState?.Ob_Trabajo_Cilindro_Valla_1 === true;
      const valla2 = plcState?.Ob_Trabajo_Cilindro_Valla_2 === true;
      if (valla1 && valla2) {
        console.log("Both fences detected in work position. Deactivating Ib_EV_VALLA_TRABAJO.");
        setFenceState('down');
        writePlc({ Ib_EV_VALLA_TRABAJO: false });
      }
    }
  }, [plcState?.Ob_Trabajo_Cilindro_Valla_1, plcState?.Ob_Trabajo_Cilindro_Valla_2, fenceState]);

  // ── Detección de vallas arriba (reposo) ──────────────────────
  useEffect(() => {
    if (fenceState === 'raising') {
      const valla = plcState?.Ob_Reposo_Cilindro_Valla_1 === true;
      if (valla) {
        console.log("Fences detected in rest position. Deactivating Ib_EV_VALLA_REPOSO.");
        setFenceState('idle');
        writePlc({ Ib_EV_VALLA_REPOSO: false });
      }
    }
  }, [plcState?.Ob_Reposo_Cilindro_Valla_1, fenceState]);

  // ── Auto-iniciar la prueba en Etapa 4 o 5 una vez las vallas están abajo ──
  useEffect(() => {
    if (fenceState === 'down') {
      if (currentStep === 3 && stepStarted[3]) {
        if (cameraTestState === 'standby') {
          console.log("Auto-starting Stage 4 (Con Carga) test since fences are down.");
          setCameraTestState('esperando_1500');
          setSimTimers({ elev: null, desc: null, finishedElev: false, finishedDesc: false, pendingReadDesc: false });
        }
      } else if (currentStep === 4 && stepStarted[4]) {
        if (test5mState === 'idle') {
          console.log("Auto-starting Stage 5 (5 Minutos) test since fences are down.");
          setTest5mState('esperando_elevacion');
        }
      }
    }
  }, [fenceState, currentStep, stepStarted, cameraTestState, test5mState]);

  // ── Trigger subir vallas al finalizar Etapa 4 o 5 ────────────
  useEffect(() => {
    // Subir vallas solo cuando finalice el último proceso de etapas a realizar.
    // Si la Etapa 5 (índice 4) está marcada como SKIP, la última etapa activa será la Etapa 4 (índice 3).
    // Si no está omitida, las vallas permanecerán bajadas y se subirán al terminar la Etapa 5.
    const step3OkAndLast = stepStatus[3] === STEP_STATUS.OK && stepStatus[4] === STEP_STATUS.SKIP;
    const step4Ok = stepStatus[4] === STEP_STATUS.OK;
    if ((step3OkAndLast || step4Ok) && (fenceState === 'down' || fenceState === 'lowering')) {
      console.log("Test finished. Raising fences (watchdog 60s).");
      setFenceState('raising');
      setFenceTimer(60);
      if (setFenceReposoAlarmActive) setFenceReposoAlarmActive(false);
      writePlc({ Ib_EV_VALLA_REPOSO: true, Ib_EV_VALLA_TRABAJO: false });
    }
  }, [stepStatus[3], stepStatus[4], fenceState]);

  // ── Controles de PLC (Botones físicos) ────────────────────────────────────

  // 1. Abortar secuencia — detección robusta con temporizador de 3 segundos
  useEffect(() => {
    if (plcState?.Ob_Abortar_Secuencia === true && stepStatus.some(s => s !== STEP_STATUS.PENDING)) {
      if (abortarCountdown === null) {
        setAbortarCountdown(1);
      } else if (abortarCountdown > 0) {
        const timer = setTimeout(() => setAbortarCountdown(abortarCountdown - 1), 1000);
        return () => clearTimeout(timer);
      } else if (abortarCountdown === 0) {
        console.warn("ABORTAR SECUENCIA (Pulsador PLC)");
        handleAbort();
        setAbortarCountdown(-1);
      }
    } else {
      setAbortarCountdown(null);
    }
  }, [plcState?.Ob_Abortar_Secuencia, abortarCountdown, stepStatus]);

  // 2. Iniciar Secuencia — detección robusta con temporizador de 3 segundos
  const handleIniciarActionRef = useRef();
  useEffect(() => {
    handleIniciarActionRef.current = () => {
      console.log('[INICIAR] Acción ejecutada. currentStep:', currentStep, 'stepStarted:', stepStarted);

      // Permitir confirmación de secuencia (paso 1 / index 0)
      if (currentStep === 0 && erpPreview) {
        const isReposo = plcState ? plcState.Ob_Reposo_Cilindro_Valla_1 === true : true;
        if (!isReposo) {
          console.warn("[INICIAR] Bloqueado: Vallas no están en posición de reposo para iniciar.");
          setSeqError("Error: Las vallas deben estar en reposo para iniciar.");
          return;
        }
        onErpData(erpPreview);
        setErpPreview(null);
        setInputMode('scanner');
        markOk(0);
        return;
      }

      // Si el paso actual (1-4) aún no está iniciado → desbloquearlo
      if (currentStep >= 1 && currentStep <= 4 && !stepStarted[currentStep]) {
        // Bloquear si es etapa 3 o 4 (index 2 y 3) y los temporizadores no están listos
        if (currentStep === 2 || currentStep === 3) {
          const isTimerReady = telemetry?.mappedPlc?.Ob_Ready_Temporizador ?? plcState?.Ob_Ready_Temporizador ?? false;
          if (!isTimerReady) {
            console.warn("[INICIAR] Bloqueado: Temporizadores no están listos (Ob_Ready_Temporizador es False)");
            return;
          }
        }

        // Bloquear si es etapa 3, 4 o 5 (index 2, 3 y 4) y la carretilla no está por debajo de la cota inicial
        if (currentStep === 2 || currentStep === 3 || currentStep === 4) {
          if (!isCarriageBelowCota) {
            console.warn("[INICIAR] Bloqueado: La carretilla debe estar por debajo de la cota inicial para comenzar la secuencia.");
            return;
          }
        }

        // ── VALIDACIÓN DE PESO: Etapa 4 (Con Carga, index 3) y Etapa 5 (5 min, index 4) ──
        // Solo en modo real — en simulación el Digital Twin gestiona el peso automáticamente
        if (!isSimulation && (currentStep === 3 || currentStep === 4)) {
          const currentPallets = isSimulation
            ? (window.__simPallets || 0)
            : (plcState?.OW_Numero_Pallets || 0);
          const targetLoad = erpData?.peso_pruebas || 0;
          const pesoPrueba = Math.floor(targetLoad / 250) * 250;
          const currentLoad = currentPallets * 250;

          if (targetLoad === 0) {
            console.warn("[INICIAR] Bloqueado: No hay peso de pruebas definido en el ERP para esta carretilla.");
            setTestAlarm("No hay peso de pruebas definido en el ERP. Compruebe los datos de la carretilla.");
            return;
          }

          if (currentLoad !== pesoPrueba) {
            console.warn(`[INICIAR] Bloqueado: Carga incorrecta — ${currentLoad}kg actual vs ${pesoPrueba}kg peso de prueba (ERP: ${targetLoad}kg).`);
            setTestAlarm(`Carga incorrecta: ${currentLoad} kg cargados, se requieren ${pesoPrueba} kg (Peso Prueba). Ajuste los pallets antes de iniciar.`);
            return;
          }

          // Peso correcto → limpiar alarma previa
          setTestAlarm(null);
        }

        console.log('[INICIAR] Desbloqueando paso', currentStep);
        setStepStarted(prev => {
          const next = [...prev];
          next[currentStep] = true;
          return next;
        });
        return; // en el mismo pulso no avanzamos, solo desbloqueamos
      }


      // Si ya estaba desbloqueado → ejecutar acción de avance
      if (currentStep >= 1 && currentStep <= 4 && stepStarted[currentStep]) {
        if (stepStatus[2] === STEP_STATUS.ACTIVE && palletState !== 'animating') {
          // NOK: REPETIR / FORZAR
          if (cameraTestState === 'nok') {
            if (window.confirm(t('confirm_camera_sincarga_nok'))) {
              markOk(2);
            } else {
              resetStartsInPlc();
              setCameraTestState('standby');
              setTestAlarm(null);
              setSimTimers({ elev: null, desc: null, finishedElev: false, finishedDesc: false, pendingReadDesc: false });
              setWaitCountdown(null);
              setTimeout(() => {
                setCameraTestState('esperando_1500');
              }, 500);
            }
            return;
          }
          if (cameraTestState === 'standby') {
            setCameraTestState('esperando_1500');
            setSimTimers({ elev: null, desc: null, finishedElev: false, finishedDesc: false, pendingReadDesc: false });
          } else if (cameraTestState === 'ok') {
            markOk(2);
          }
        } else if (stepStatus[3] === STEP_STATUS.ACTIVE && palletState !== 'animating') {
          // Validación de carga
          const currentPallets = plcState?.OW_Numero_Pallets || 0;
          const targetLoad = erpData?.peso_pruebas || 0;
          const pesoPrueba = Math.floor(targetLoad / 250) * 250;
          const currentLoad = currentPallets * 250;

          if (currentLoad !== pesoPrueba) {
            setTestAlarm(`Carga incorrecta: ${currentLoad}kg actual vs ${pesoPrueba}kg peso de prueba (ERP: ${targetLoad}kg). Compruebe los pallets.`);
            return;
          } else {
            setTestAlarm(null);
          }

          // NOK: REPETIR / FORZAR
          if (cameraTestState === 'nok') {
            if (window.confirm(t('confirm_camera_concarga_nok'))) {
              markOk(3);
            } else {
              resetStartsInPlc();
              setCameraTestState('standby');
              setTestAlarm(null);
              setSimTimers({ elev: null, desc: null, finishedElev: false, finishedDesc: false, pendingReadDesc: false });
              setWaitCountdown(null);
              setTimeout(() => {
                setCameraTestState('esperando_1500');
              }, 500);
            }
            return;
          }
          if (cameraTestState === 'standby') {
            // Validar que las vallas estén realmente bajadas para iniciar el movimiento del test
            const isDownFront = plcState?.Ob_Trabajo_Cilindro_Valla_1 === true;
            const isDownRear = plcState?.Ob_Trabajo_Cilindro_Valla_2 === true;
            if (!isDownRear || !isDownFront) {
              console.warn("[INICIAR] Bloqueado: Vallas no en posición de trabajo para realizar la prueba.");
              return;
            }
            setCameraTestState('esperando_1500');
            setSimTimers({ elev: null, desc: null, finishedElev: false, finishedDesc: false, pendingReadDesc: false });
          } else if (cameraTestState === 'ok') {
            markOk(3);
          }
        } else if (stepStatus[4] === STEP_STATUS.ACTIVE) {
          const currentPallets = isSimulation ? (window.__simPallets || 0) : (plcStateRef.current?.OW_Numero_Pallets || 0);
          const targetLoad = erpData?.peso_pruebas || 0;
          const pesoPrueba = Math.floor(targetLoad / 250) * 250;
          const currentLoad = currentPallets * 250;

          if (currentLoad !== pesoPrueba) {
            setTestAlarm(`Carga incorrecta: ${currentLoad}kg actual vs ${pesoPrueba}kg peso de prueba (ERP: ${targetLoad}kg). Compruebe los pallets.`);
            return;
          } else {
            setTestAlarm(null);
          }

          if (test5mState === 'nok') {
            if (window.confirm(t('confirm_5min_nok'))) {
              markOk(4);
            } else {
              setTest5mState('esperando_elevacion');
              setTimer5min(null);
              setTestAlarm(null);
            }
            return;
          }
          if (test5mState === 'ok') {
            markOk(4);
          } else if (test5mState === 'idle') {
            // Validar que las vallas estén realmente bajadas para iniciar el movimiento del test
            const isDownFront = plcState?.Ob_Trabajo_Cilindro_Valla_1 === true;
            const isDownRear = plcState?.Ob_Trabajo_Cilindro_Valla_2 === true;
            if (!isDownRear || !isDownFront) {
              console.warn("[INICIAR] Bloqueado: Vallas no en posición de trabajo para realizar la prueba.");
              return;
            }
            setTest5mState('esperando_elevacion');
          }
        }
      }
    };
  });

  // ── Altura actual en mm (consistente en sim y real) ──────────────────────
  const currentHeightMm = isSimulation
    ? Math.round((window.__carriageY || 0) * 1000)
    : (plcState?.OR_Altura_Carretilla || 0);

  // Carretilla por debajo de la cota inicial (condición de inicio para tests elev/5m)
  const isCarriageBelowCota = currentHeightMm < cotaInicial;

  useEffect(() => {
    let interval;
    const isWaitingPreview = currentStep === 0 && !!erpPreview;
    // La secuencia solo se inicia (y cuenta atrás) si estamos confirmando preview (0) o en etapas 2 a la 5 (currentStep de 1 a 4)
    if (plcState?.Ob_Iniciar_Secuencia === true && (isWaitingPreview || (currentStep >= 1 && currentStep <= 4))) {
      // Para etapas de test (sin carga, con carga, 5 min) bloquear si carretilla no está abajo
      const isTestStep = currentStep >= 2;
      const isTimerReady = (currentStep === 2 || currentStep === 3)
        ? (telemetry?.mappedPlc?.Ob_Ready_Temporizador ?? plcState?.Ob_Ready_Temporizador ?? false)
        : true;
      const blockByHeight = (isTestStep &&
        ((currentStep === 2 || currentStep === 3) ? cameraTestState === 'standby' : test5mState === 'idle')
        && !isCarriageBelowCota) || !isTimerReady;
      if (blockByHeight) {
        if (iniciarCountdown !== null) setIniciarCountdown(null);
        return;
      }

      // ── VALIDACIÓN DE PESO (trigger PLC): Etapas 4 y 5 ──────────────────
      // Solo en modo real — en simulación el peso se gestiona automáticamente
      if (!isSimulation && (currentStep === 3 || currentStep === 4) && !stepStarted[currentStep]) {
        const currentPallets = isSimulation
          ? (window.__simPallets || 0)
          : (plcState?.OW_Numero_Pallets || 0);
        const targetLoad = erpData?.peso_pruebas || 0;
        const pesoPrueba = Math.floor(targetLoad / 250) * 250;
        const currentLoad = currentPallets * 250;
        if (targetLoad === 0 || currentLoad !== pesoPrueba) {
          if (iniciarCountdown !== null) setIniciarCountdown(null);
          return;
        }
      }


      if (iniciarCountdown === null) {
        setIniciarCountdown(1);
      } else if (iniciarCountdown > 0) {
        interval = setTimeout(() => {
          setIniciarCountdown(prev => prev - 1);
        }, 1000);
      } else if (iniciarCountdown === 0) {
        if (handleIniciarActionRef.current) handleIniciarActionRef.current();
        setIniciarCountdown(-1);
      }
    } else {
      if (iniciarCountdown !== null) {
        setIniciarCountdown(null);
      }
    }
    return () => clearTimeout(interval);
  }, [
    plcState?.Ob_Iniciar_Secuencia,
    iniciarCountdown,
    currentStep,
    isCarriageBelowCota,
    cameraTestState,
    telemetry?.mappedPlc?.Ob_Ready_Temporizador,
    plcState?.Ob_Ready_Temporizador
  ]);

  // 3. Pegatina Colocada y Confirmación — detección robusta con temporizador de 3 segundos
  const handlePegatinaActionRef = useRef();
  const isPegatinaActionValidRef = useRef(() => false);

  useEffect(() => {
    isPegatinaActionValidRef.current = () => {
      // Si estamos en Multiload, debe estar en la altura correcta
      if (stepStatus[1] === STEP_STATUS.ACTIVE && erpData && stepStarted[1]) {
        const alturaMax = erpData.altura_max_interm;
        const alturaAct = plcStateRef.current?.OR_Altura_Carretilla || 0;
        const tols = toleranciasRef.current;
        if (alturaMax != null) {
          const isPosOk = alturaAct >= (alturaMax - tols.negativa) && alturaAct <= (alturaMax + tols.positiva);
          if (!isPosOk) return false;
        }
      }
      // Si estamos en NOK, es siempre válido
      if (cameraTestState === 'nok') {
        const activeTestStep = stepStatus[2] === STEP_STATUS.ACTIVE ? 2 : stepStatus[3] === STEP_STATUS.ACTIVE ? 3 : null;
        if (activeTestStep === null) return false;
      } else if (stepStatus[1] !== STEP_STATUS.ACTIVE) {
        return false;
      }
      return true;
    };

    handlePegatinaActionRef.current = () => {
      // a) Pegatina Colocada -> avanzar en Paso 2
      if (stepStatus[1] === STEP_STATUS.ACTIVE && erpData && stepStarted[1]) {
        markOk(1);
      }
      // b) Pegatina Colocada con resultado NOK -> CONTINUAR (avanzar paso sin repetir)
      if (cameraTestState === 'nok' || test5mState === 'nok') {
        const activeTestStep = stepStatus[2] === STEP_STATUS.ACTIVE ? 2 : stepStatus[3] === STEP_STATUS.ACTIVE ? 3 : stepStatus[4] === STEP_STATUS.ACTIVE ? 4 : null;
        if (activeTestStep !== null) markOk(activeTestStep);
      }
    };
  }, [stepStatus, erpData, stepStarted, cameraTestState, test5mState]);

  useEffect(() => {
    if (plcState?.Ob_Poner_Pegatina === true) {
      if (pegatinaCountdown === null) {
        if (isPegatinaActionValidRef.current && isPegatinaActionValidRef.current()) {
          setPegatinaCountdown(1);
        }
      } else if (pegatinaCountdown > 0) {
        const timer = setTimeout(() => setPegatinaCountdown(pegatinaCountdown - 1), 1000);
        return () => clearTimeout(timer);
      } else if (pegatinaCountdown === 0) {
        if (handlePegatinaActionRef.current) handlePegatinaActionRef.current();
        setPegatinaCountdown(-1);
      }
    } else {
      setPegatinaCountdown(null);
    }
  }, [plcState?.Ob_Poner_Pegatina, pegatinaCountdown]);

  // ── Overlay Datos Multiload (Paso 2) ───────────────────────────────────────
  useEffect(() => {
    if (currentStep === 1 && erpData && stepStarted[1]) {
      const alturaMax = erpData.altura_max_interm;
      const actual = plcState?.OR_Altura_Carretilla || 0;
      const min = alturaMax - tolerancias.negativa;
      const max = alturaMax + tolerancias.positiva;
      const isOk = actual >= min && actual <= max;

      updateStep2Overlay({
        active: true,
        actual,
        min,
        max,
        isOk
      });
    } else {
      updateStep2Overlay(null);
    }
  }, [currentStep, erpData, plcState?.OR_Altura_Carretilla, tolerancias, setStep2Overlay]);

  // ── Luces LED de Torre ─────────────────────────────────
  useEffect(() => {
    let luzAzul = false;
    let luzVerde = false;
    let luzRoja = false;
    let luzPulsador1 = false;
    let luzPulsador2 = false;

    if (!plcState?.Ob_Estado_Automatico) {
      // Condiciones iniciales generales NO cumplidas -> Rojo parpadeante
      luzRoja = blinkTick;
    } else if (!erpData) {
      // Sin iniciar prueba -> Azul
      luzAzul = true;
      if (currentStep === 0 && erpPreview) {
        luzPulsador1 = blinkTick;
      }
    } else {
      if (currentStep >= 1 && currentStep <= 4) {
        if (!stepStarted[currentStep]) {
          // Etapa no iniciada explícitamente -> Azul
          luzAzul = true;
          luzPulsador1 = blinkTick; // Parpadeo LED Iniciar Secuencia
        } else {
          // Etapa iniciada
          if (currentStep === 1) { // Paso 2: Multiload
            const altura = erpData?.altura_max_interm || 0;
            const act = plcState?.OR_Altura_Carretilla || 0;
            const posOk = act >= (altura - tolerancias.negativa) && act <= (altura + tolerancias.positiva);

            if (posOk) {
              luzVerde = blinkTick;
              luzPulsador2 = blinkTick; // Parpadeo LED Colocar Pegatina
            } else {
              luzRoja = blinkTick;
            }
          } else if (currentStep === 2 || currentStep === 3) { // Tests de elevación
            if (cameraTestState === 'standby' || cameraTestState === 'esperando_1500') {
              // Condiciones iniciales NO cumplidas → Rojo parpadeante
              luzRoja = blinkTick;
            }
            else if (cameraTestState === 'ascenso') {
              // Si el PLC ha activado el Ready (carretilla arriba), luz azul fija de inmediato
              if (isTimerReadyVal) {
                luzAzul = true;
              } else {
                luzVerde = blinkTick;
              }
            }
            else if (cameraTestState === 'espera_arriba') {
              // Espera arriba durante la cuenta atrás → Luz azul fija
              luzAzul = true;
            }
            else if (cameraTestState === 'descenso') {
              // Descenso en curso → Verde parpadeante
              luzVerde = blinkTick;
            }
            else if (cameraTestState === 'ok') {
              // Prueba superada final (descenso completado) → Verde fijo (original)
              luzVerde = true;
            }
            else if (cameraTestState === 'nok') {
              // Prueba fallida → Rojo fijo
              luzRoja = true;
            }
          }
          // Luces para Etapa 5
          else if (currentStep === 4) {
            if (test5mState === 'idle') {
              luzRoja = blinkTick;
            } else if (test5mState === 'stabilizing') {
              luzAzul = blinkTick; // Parpadeo azul para estabilización
            } else if (test5mState === 'running') {
              luzVerde = blinkTick;
            } else if (test5mState === 'ok') {
              luzVerde = true;
            } else if (test5mState === 'nok') {
              luzRoja = blinkTick;
            }
          }
        }
      } else if (currentStep === 0) {
        luzAzul = true;
        if (erpPreview) {
          luzPulsador1 = blinkTick;
        }
      } else if (isSequenceFinished || currentStep === -1) {
        luzRoja = blinkTick;
      }
    }

    const updateLed = async () => {
      const currentLedState = {
        Ib_LUZ_AZUL: luzAzul,
        Ib_LUZ_VERDE: luzVerde,
        Ib_LUZ_ROJA: luzRoja,
        Ib_LUZ_Pulsador_1: luzPulsador1,
        Ib_LUZ_Pulsador_2: luzPulsador2
      };
      
      const stateKey = JSON.stringify(currentLedState);
      if (window.__lastLedState === stateKey) return;
      window.__lastLedState = stateKey;

      try {
        await fetch(`${API_BASE}/plc/write`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: stateKey
        });
      } catch (e) { console.error("Error setting LEDs:", e); }
    };

    updateLed();
  }, [currentStep, stepStarted, erpData, erpPreview, plcState?.OR_Altura_Carretilla, plcState?.Ob_Estado_Automatico, tolerancias, blinkTick, cameraTestState, test5mState, isSimulation, isSequenceFinished]);

  // Auto-avanzar después de 3s en OK
  useEffect(() => {
    let t;
    if (cameraTestState === 'ok') {
      t = setTimeout(() => {
        if (currentStep === 2) markOk(2);
        if (currentStep === 3) markOk(3);
      }, 3000);
    }
    return () => clearTimeout(t);
  }, [cameraTestState, currentStep]);

  // 3. Confirmar Pegatina (Repetir Secuencia) -> avanzar Paso 2 (Multiload)
  const handleRepetirActionRef = useRef();
  const isRepetirActionValidRef = useRef(() => false);

  useEffect(() => {
    isRepetirActionValidRef.current = () => {
      if (stepStatus[1] === STEP_STATUS.ACTIVE && palletState !== 'animating') {
        const alturaMax = erpData?.altura_max_interm;
        const alturaAct = plcStateRef.current?.OR_Altura_Carretilla || 0;
        const tols = toleranciasRef.current;
        
        if (alturaMax != null) {
          return alturaAct >= (alturaMax - tols.negativa) && alturaAct <= (alturaMax + tols.positiva);
        }
      }
      return false;
    };

    handleRepetirActionRef.current = () => {
      if (isRepetirActionValidRef.current()) {
        markOk(1);
      }
    };
  }, [stepStatus, palletState, erpData]);

  useEffect(() => {
    if (plcState?.Ob_Repetir_Secuencia === true) {
      if (repetirCountdown === null) {
        if (isRepetirActionValidRef.current && isRepetirActionValidRef.current()) {
          setRepetirCountdown(1);
        }
      } else if (repetirCountdown > 0) {
        const timer = setTimeout(() => setRepetirCountdown(repetirCountdown - 1), 1000);
        return () => clearTimeout(timer);
      } else if (repetirCountdown === 0) {
        if (handleRepetirActionRef.current) handleRepetirActionRef.current();
        setRepetirCountdown(-1);
      }
    } else {
      setRepetirCountdown(null);
    }
  }, [plcState?.Ob_Repetir_Secuencia, repetirCountdown]);

  // ── Teclado manual de bastidor (por teclado físico) ─────────────────────────
  const manualBastidorRef = useRef(null);

  const handleConfirmarBastidor = async () => {
    // Leer del DOM directamente para evitar problemas de race condition si se escribe muy rápido y se pulsa Enter
    const bastidor = (manualBastidorRef.current?.value || manualBastidor).trim();
    if (!bastidor) return;
    setSeqLoading(true);
    setSeqError('');
    try {
      const res = await fetch(`${API_BASE}/erp/bastidor/${encodeURIComponent(bastidor)}`);
      const data = await res.json();
      if (res.ok) {
        setErpPreview(data); // Mostrar preview, no cargar directamente
      } else {
        setSeqError(data.detail || `Bastidor '${bastidor}' no encontrado en ERP.`);
      }
    } catch {
      setSeqError('Sin conexión con el servidor.');
    } finally {
      setSeqLoading(false);
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
    if (setStep2Overlay) setStep2Overlay(null);
    setCameraTestState('standby'); // Reset visual test state on step transition

    // Guardar telemetría de fin de etapa según índice y actualizar DB
    const pState = plcStateRef.current;
    const simTimes = simTimersRef.current;
    const testDist = is1mTest ? 1.0 : 2.0;
    let dbUpdate = {};

    if (idx === 1) { // Fin Etapa 2 (Multiload)
      const startT = stepStartTime[1];
      dbUpdate = {
        ALTURA_CAPTADA: pegatinaPosicion,
        FECHA_HORA_INICIO_MULTILOAD: startT ? new Date(startT).toISOString() : null,
        FECHA_HORA_FIN_MULTILOAD: new Date().toISOString(),
        ESTADO_MULTILOAD: 'OK'
      };
    } else if (idx === 2) { // Fin Etapa 3 (Sin Carga)
      stageDataRef.current[3] = {
        elev: simTimes.elev,
        desc: simTimes.desc
      };
      const startT = stepStartTime[2];
      dbUpdate = {
        TIEMPO_ELEVACION_MIN_SINCARGA: erpData?.tpo_elev_min_scarga != null ? erpData.tpo_elev_min_scarga / 100 : null,
        TIEMPO_ELEVACION_MAX_SINCARGA: erpData?.tpo_elev_max_scarga != null ? erpData.tpo_elev_max_scarga / 100 : null,
        TIEMPO_ELEVACION_MEDIDO_SINCARGA: simTimes.elev != null ? simTimes.elev / 100 : null,
        AVG_ELEVACION_SINCARGA: simTimes.elev > 0 ? Number(((testDist * 100000) / simTimes.elev).toFixed(0)) : null,
        TIEMPO_DESCENSO_MIN_SINCARGA: erpData?.tpo_desc_min_scarga != null ? erpData.tpo_desc_min_scarga / 100 : null,
        TIEMPO_DESCENSO_MAX_SINCARGA: erpData?.tpo_desc_max_scarga != null ? erpData.tpo_desc_max_scarga / 100 : null,
        TIEMPO_DESCENSO_MEDIDO_SINCARGA: simTimes.desc != null ? simTimes.desc / 100 : null,
        AVG_DESCENSO_SINCARGA: simTimes.desc > 0 ? Number(((testDist * 100000) / simTimes.desc).toFixed(0)) : null,
        FECHA_HORA_INICIO_SINCARGA: startT ? new Date(startT).toISOString() : null,
        FECHA_HORA_FIN_SINCARGA: new Date().toISOString(),
        ESTADO_SINCARGA: 'OK'
      };
    } else if (idx === 3) { // Fin Etapa 4 (Con Carga)
      const cargaGetVal = pState?.OW_Numero_Pallets ? pState.OW_Numero_Pallets * 250 : null;
      stageDataRef.current[4] = {
        elev: simTimes.elev,
        desc: simTimes.desc,
        cargaGet: cargaGetVal
      };
      const startT = stepStartTime[3];
      dbUpdate = {
        TIEMPO_ELEVACION_MIN_CARGA: erpData?.tpo_elevac_min != null ? erpData.tpo_elevac_min / 100 : null,
        TIEMPO_ELEVACION_MAX_CARGA: erpData?.tpo_elevac_max != null ? erpData.tpo_elevac_max / 100 : null,
        TIEMPO_ELEVACION_MEDIDO_CARGA: simTimes.elev != null ? simTimes.elev / 100 : null,
        AVG_ELEVACION_CARGA: simTimes.elev > 0 ? Number(((testDist * 100000) / simTimes.elev).toFixed(0)) : null,
        TIEMPO_DESCENSO_MIN_CARGA: erpData?.tpo_descenso_min != null ? erpData.tpo_descenso_min / 100 : null,
        TIEMPO_DESCENSO_MAX_CARGA: erpData?.tpo_descenso_max != null ? erpData.tpo_descenso_max / 100 : null,
        TIEMPO_DESCENSO_MEDIDO_CARGA: simTimes.desc != null ? simTimes.desc / 100 : null,
        AVG_DESCENSO_CARGA: simTimes.desc > 0 ? Number(((testDist * 100000) / simTimes.desc).toFixed(0)) : null,
        FECHA_HORA_INICIO_CARGA: startT ? new Date(startT).toISOString() : null,
        FECHA_HORA_FIN_CARGA: new Date().toISOString(),
        ESTADO_CARGA: 'OK',
        CARGA_CONSIGNADA: erpData?.peso_pruebas,
        CARGA_GET: cargaGetVal,
        PESO_PRUEBA: erpData?.peso_pruebas != null ? Math.floor(erpData.peso_pruebas / 250) * 250 : null
      };
    } else if (idx === 4) { // Fin Etapa 5 (5 min)
      const altFinal = pState?.OR_Altura_Carretilla;
      const altInicial = stageDataRef.current[5].altura_inicial || 0;
      const diffVal = Math.abs(altInicial - (altFinal || 0));
      stageDataRef.current[5].altura_final = altFinal;
      stageDataRef.current[5].diff = diffVal;

      const startT = stepStartTime[4];
      dbUpdate = {
        ALTURA_INICIAL: altInicial,
        ALTURA_FINAL: altFinal,
        DIFERENCIA_ALTURAS: diffVal,
        FECHA_HORA_INICIO_5MIN: startT ? new Date(startT).toISOString() : null,
        FECHA_HORA_FIN_5MIN: new Date().toISOString(),
        ESTADO_CARGA_5_MIN: 'OK'
      };
    }

    if (Object.keys(dbUpdate).length > 0) {
      updateCycleInDb(dbUpdate);
    }

    // Registrar duración del paso
    setStepDurations(prev => {
      const next = [...prev];
      const start = stepStartTime[idx];
      next[idx] = start ? Math.round((Date.now() - start) / 1000) : null;
      return next;
    });
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

  // ── Refs para acceso instantáneo al estado actual (para callbacks imperativos) ──
  const stepStatusRef = useRef(stepStatus);
  const stepStartedRef = useRef(stepStarted);
  const currentStepRef = useRef(currentStep);
  const erpDataRef = useRef(erpData);
  const erpPreviewRef = useRef(erpPreview);
  const toleranciasRef = useRef(tolerancias);
  const simTimersRef = useRef(simTimers);
  const cameraTestStateRef = useRef(cameraTestState);
  const prevReadyRef = useRef(null);          // Para detección de flanco 0→1 de Ob_Ready_Temporizador
  const readyFlancosRef = useRef(0);          // Contador de flancos 0→1 dentro del test activo
  const isTimerReadyValRef = useRef(false);   // Valor actual de Ready (para closures de setTimeout)
  const readyConfirmTimeoutRef = useRef(null);// setTimeout pendiente de confirmación de 2s

  useEffect(() => { stepStatusRef.current = stepStatus; }, [stepStatus]);
  useEffect(() => { stepStartedRef.current = stepStarted; }, [stepStarted]);
  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { erpDataRef.current = erpData; }, [erpData]);
  useEffect(() => { erpPreviewRef.current = erpPreview; }, [erpPreview]);
  useEffect(() => { toleranciasRef.current = tolerancias; }, [tolerancias]);
  useEffect(() => { simTimersRef.current = simTimers; }, [simTimers]);
  useEffect(() => { cameraTestStateRef.current = cameraTestState; }, [cameraTestState]);
  // Resetear el contador de flancos cada vez que empieza un ciclo nuevo de prueba.
  useEffect(() => {
    if (cameraTestState === 'esperando_1500' || cameraTestState === 'standby') {
      readyFlancosRef.current = 0;
      // Cancelar cualquier confirmación pendiente al reiniciar el ciclo
      if (readyConfirmTimeoutRef.current) {
        clearTimeout(readyConfirmTimeoutRef.current);
        readyConfirmTimeoutRef.current = null;
      }
    }
  }, [cameraTestState]);


  // ── Detección de flanco 0→1 de Ob_Ready_Temporizador con confirmación de 2s (solo PLC real) ──
  // El PLC pone Ready=False al iniciar temporizador (ascenso/descenso) y True al acabar.
  //   1er flanco → esperar 2s con Ready=True → leer OR_Tiempo_Elevacion → espera_arriba + countdown 3s
  //   2º flanco  → esperar 2s con Ready=True → leer OR_Tiempo_Descenso → evaluar resultado
  const isTimerReadyVal = telemetry?.mappedPlc?.Ob_Ready_Temporizador ?? plcState?.Ob_Ready_Temporizador ?? false;
  // Mantener ref siempre actualizado (evita stale closure en setTimeout)
  useEffect(() => { isTimerReadyValRef.current = isTimerReadyVal; }, [isTimerReadyVal]);

  useEffect(() => {
    if (isSimulation) {
      prevReadyRef.current = isTimerReadyVal;
      return;
    }
    const prevReady = prevReadyRef.current;
    prevReadyRef.current = isTimerReadyVal;

    // ── Caída 1→0: cancelar la confirmación pendiente (flanco espúreo) ──
    if (prevReady === true && isTimerReadyVal === false) {
      if (readyConfirmTimeoutRef.current) {
        clearTimeout(readyConfirmTimeoutRef.current);
        readyConfirmTimeoutRef.current = null;
        console.log('[FLANCO READY] Ready bajó antes de los 2s — confirmación cancelada');
      }
      return;
    }

    // ── Flanco 0→1 detectado ──
    if (prevReady === false && isTimerReadyVal === true) {
      const step = currentStepRef.current;
      if (step !== 2 && step !== 3) return;   // Solo en etapas sin/con carga

      const testState = cameraTestStateRef.current;
      // Ignorar flancos fuera del ascenso o descenso activo
      if (testState !== 'ascenso' && testState !== 'descenso') {
        console.log(`[FLANCO READY↑] Ignorado flanco 0→1 porque el estado actual es '${testState}'`);
        return;
      }


      console.log(`[FLANCO READY↑] Detectado flanco 0→1 en estado '${testState}' (step ${step + 1}) — esperando 3s confirmación...`);

      // Cancelar cualquier timeout anterior antes de crear uno nuevo
      if (readyConfirmTimeoutRef.current) {
        clearTimeout(readyConfirmTimeoutRef.current);
      }

      // Esperar 3 segundos con Ready=True para confirmar que el valor es estable
      readyConfirmTimeoutRef.current = setTimeout(() => {
        readyConfirmTimeoutRef.current = null;

        // Verificar que Ready sigue a True tras los 3 segundos
        if (!isTimerReadyValRef.current) {
          console.log(`[FLANCO READY↑] Estado '${testState}' — Ready cayó durante los 3s, descartado`);
          return;
        }

        const timers = simTimersRef.current;
        const erp = erpDataRef.current;
        const isSinCarga = currentStepRef.current === 2;

        console.log(`[FLANCO READY↑] Flanco confirmado en estado '${testState}' — leyendo valor...`);

        // Usamos testState (capturado en el flanco) para decidir la rama de evaluación
        if (testState === 'ascenso') {
          // ─ Fin del ascenso ─
          if (timers.finishedElev) return;
          const raw = getPlcVal(plcStateRef.current, 'OR_Tiempo_Elevacion')
                   ?? getPlcVal(plcStateRef.current, 'OW_Tiempo_Elevacion')
                   ?? 0;
          const finalElev = Math.floor(raw / 10);
          console.log(`[FLANCO READY↑] Elevación confirmada: ${finalElev} cs (raw=${raw})`);
          setSimTimers(prev => ({ ...prev, finishedElev: true, elev: finalElev }));
          
          setCameraTestState('espera_arriba');
          setWaitCountdown(3);

        } else if (testState === 'descenso') {
          // ─ Fin del descenso ─ (la UI ya está en 'ok', aquí evaluamos los tiempos)
          if (timers.finishedDesc) return;
          const rawDesc = getPlcVal(plcStateRef.current, 'OR_Tiempo_Descenso')
                       ?? getPlcVal(plcStateRef.current, 'OW_Tiempo_Descenso')
                       ?? 0;
          const finalElev = timers.elev;
          const finalDesc = Math.floor(rawDesc / 10);
          console.log(`[FLANCO READY↑] Descenso confirmado: ${finalDesc} cs (raw=${rawDesc})`);
          const minElev = isSinCarga ? erp?.tpo_elev_min_scarga : erp?.tpo_elevac_min;
          const maxElev = isSinCarga ? erp?.tpo_elev_max_scarga : erp?.tpo_elevac_max;
          const minDesc = isSinCarga ? erp?.tpo_desc_min_scarga : erp?.tpo_descenso_min;
          const maxDesc = isSinCarga ? erp?.tpo_desc_max_scarga : erp?.tpo_descenso_max;
          setSimTimers(prev => ({ ...prev, finishedDesc: true, desc: finalDesc, pendingReadDesc: false }));
          const isElevOk = Number(finalElev) >= Number(minElev) && Number(finalElev) <= Number(maxElev);
          const isDescOk = Number(finalDesc) >= Number(minDesc) && Number(finalDesc) <= Number(maxDesc);
          if (!isElevOk || !isDescOk) {
            setTestAlarm('fuera_tolerancia');
            setCameraTestState('nok'); // Corregir a NOK si los tiempos no cumplen
          } else {
            setTestAlarm(null);
            setCameraTestState('ok');
          }
        }
      }, 3000); // 3 segundos de confirmación
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimerReadyVal, isSimulation, cotaInicial, is1mTest]);




  // Registrar timestamp de inicio cuando un paso se activa
  useEffect(() => {
    if (currentStep >= 0 && currentStep <= 4) {
      setStepStartTime(prev => {
        const next = [...prev];
        if (!next[currentStep]) next[currentStep] = Date.now(); // solo si no se ha iniciado ya
        return next;
      });
      // Actualizar etapa actual en base de datos (1 a 5)
      updateCycleInDb({ ETAPA_ACTUAL: currentStep + 1 });
    }
  }, [currentStep]);

  // ── Handlers directos (llamados desde botones sin pasar por WebSocket) ────────
  const handleIniciarSecuenciaDirecto = () => {
    // Si el modal de previsualización está abierto, iniciar_secuencia confirma la carga
    if (erpPreviewRef.current) {
      console.log('[DIRECTO] Confirmando previsualización de ERP');
      const data = erpPreviewRef.current;
      
      // Iniciar el seguimiento del ciclo en la base de datos
      const opName = operario ? `${operario.NOMBRE || ''} ${operario.APELLIDOS || ''}`.trim() : 'Desconocido';
      fetch(`${API_BASE}/api/cycle/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referencia: data.bastidor,
          operario: opName,
          fecha_montaje: data.fecha_montaje || '0',
          nsecuencia: data.secuencia || '0',
          nmodelo: data.modelo || '0',
          nbastidor: data.bastidor || '0',
          nmastil: data.mastil || '0',
          altura_max_intermedia: data.altura_max_interm != null ? Number(data.altura_max_interm) : 0.0
        })
      }).catch(err => console.error("Error starting cycle tracking:", err));

      onErpData(data);
      setErpPreview(null);
      setSeqInput('');
      markOk(0);
      return;
    }

    const step = currentStepRef.current;
    const started = stepStartedRef.current;
    const statuses = stepStatusRef.current;
    const pState = plcStateRef.current;
    console.log('[DIRECTO] Iniciar Secuencia. step:', step, 'started:', started);

    if (step >= 1 && step <= 4 && !started[step]) {
      // Bloquear si es etapa 3 o 4 (index 2 y 3) y los temporizadores no están listos
      if (step === 2 || step === 3) {
        const isTimerReady = telemetry?.mappedPlc?.Ob_Ready_Temporizador ?? pState?.Ob_Ready_Temporizador ?? false;
        if (!isTimerReady) {
          console.warn("[DIRECTO] Bloqueado: Temporizadores no están ready");
          return;
        }
      }

      // Bloquear si es etapa 3, 4 o 5 (index 2, 3 y 4) y la carretilla no está por debajo de la cota inicial
      if (step === 2 || step === 3 || step === 4) {
        if (!isCarriageBelowCota) {
          console.warn("[DIRECTO] Bloqueado: La carretilla debe estar por debajo de la cota inicial para comenzar la secuencia.");
          return;
        }
      }

      // Bloquear si es etapa 4 o 5 (index 3 y 4) y la carga no coincide
      if (step === 3 || step === 4) {
        const currentPallets = pState?.OW_Numero_Pallets || 0;
        const targetLoad = erpDataRef.current?.peso_pruebas || 0;
        const pesoPrueba = Math.floor(targetLoad / 250) * 250;
        const currentLoad = currentPallets * 250;

        if (currentLoad !== pesoPrueba) {
          console.warn(`[DIRECTO] Bloqueado: Carga incorrecta (${currentLoad}kg vs ${pesoPrueba}kg).`);
          setTestAlarm(`Carga incorrecta: ${currentLoad}kg actual vs ${pesoPrueba}kg peso de prueba (ERP: ${targetLoad}kg). Compruebe los pallets.`);
          return;
        } else {
          setTestAlarm(null);
        }
      }

      // Desbloquear etapa
      console.log('[DIRECTO] Desbloqueando paso', step);
      setStepStarted(prev => {
        const next = [...prev];
        next[step] = true;
        return next;
      });
      return;
    }
    // Ya desbloqueada — avanzar
    if (step >= 1 && step <= 4 && started[step]) {
      if (statuses[2] === STEP_STATUS.ACTIVE && pState?.palletState !== 'animating') {
        if (cameraTestState === 'nok') {
          if (window.confirm(t('confirm_camera_sincarga_nok'))) {
            markOk(2);
          } else {
            resetStartsInPlc();
            setCameraTestState('standby');
            setTestAlarm(null);
            setSimTimers({ elev: null, desc: null, finishedElev: false, finishedDesc: false, pendingReadDesc: false });
            setWaitCountdown(null);
            setTimeout(() => {
              setCameraTestState('esperando_1500');
            }, 500);
          }
          return;
        }
        if (cameraTestState === 'standby') {
          setCameraTestState('esperando_1500');
          setSimTimers({ elev: null, desc: null, finishedElev: false, finishedDesc: false, pendingReadDesc: false });
        } else if (cameraTestState === 'ok') markOk(2);
      } else if (statuses[3] === STEP_STATUS.ACTIVE && pState?.palletState !== 'animating') {
        const currentPallets = pState?.OW_Numero_Pallets || 0;
        const targetLoad = erpDataRef.current?.peso_pruebas || 0;
        const pesoPrueba = Math.floor(targetLoad / 250) * 250;
        const currentLoad = currentPallets * 250;

        if (currentLoad !== pesoPrueba) {
          setTestAlarm(`Carga incorrecta: ${currentLoad}kg actual vs ${pesoPrueba}kg peso de prueba (ERP: ${targetLoad}kg). Compruebe los pallets.`);
          setCameraTestState('nok');
          return;
        } else {
          setTestAlarm(null);
        }

        if (cameraTestState === 'nok') {
          if (window.confirm(t('confirm_camera_concarga_nok'))) {
            markOk(3);
          } else {
            resetStartsInPlc();
            setCameraTestState('standby');
            setTestAlarm(null);
            setSimTimers({ elev: null, desc: null, finishedElev: false, finishedDesc: false, pendingReadDesc: false });
            setWaitCountdown(null);
            setTimeout(() => {
              setCameraTestState('esperando_1500');
            }, 500);
          }
          return;
        }
        if (cameraTestState === 'standby') {
          // Validar que las vallas estén realmente bajadas para iniciar el movimiento del test
          const isDownFront = pState?.Ob_Trabajo_Cilindro_Valla_1 === true;
          const isDownRear = pState?.Ob_Trabajo_Cilindro_Valla_2 === true;
          if (!isDownRear || !isDownFront) {
            console.warn("[DIRECTO] Bloqueado: Vallas no en posición de trabajo para realizar la prueba.");
            return;
          }
          setCameraTestState('esperando_1500');
          setSimTimers({ elev: null, desc: null, finishedElev: false, finishedDesc: false, pendingReadDesc: false });
        } else if (cameraTestState === 'ok') markOk(3);
      } else if (statuses[4] === STEP_STATUS.ACTIVE) {
        if (test5mState === 'nok') {
          if (window.confirm(t('confirm_5min_nok'))) {
            markOk(4);
          } else {
            setTest5mState('esperando_elevacion');
            setTestAlarm(null);
            setTimer5min(null);
          }
          return;
        }
        if (test5mState === 'ok') {
          markOk(4);
        } else if (test5mState === 'idle') {
          // Validar que las vallas estén realmente bajadas para iniciar el movimiento del test
          const isDownFront = pState?.Ob_Trabajo_Cilindro_Valla_1 === true;
          const isDownRear = pState?.Ob_Trabajo_Cilindro_Valla_2 === true;
          if (!isDownRear || !isDownFront) {
            console.warn("[DIRECTO] Bloqueado: Vallas no en posición de trabajo para realizar la prueba.");
            return;
          }
          setTest5mState('esperando_elevacion');
        }
      }
    }
  };

  const handlePegatinaDireto = () => {
    const started = stepStartedRef.current;
    const statuses = stepStatusRef.current;
    const erp = erpDataRef.current;
    const tols = toleranciasRef.current;
    const pState = plcStateRef.current;

    if (cameraTestState === 'nok') {
      const activeTestStep = statuses[2] === STEP_STATUS.ACTIVE ? 2 : statuses[3] === STEP_STATUS.ACTIVE ? 3 : null;
      if (activeTestStep !== null) {
        const confirmKey = activeTestStep === 2 ? 'confirm_camera_sincarga_nok_short' : 'confirm_camera_concarga_nok_short';
        if (window.confirm(t(confirmKey))) {
          markOk(activeTestStep);
        }
      }
      return;
    }

    if (statuses[1] === STEP_STATUS.ACTIVE && erp && started[1]) {
      const altura = erp.altura_max_interm;
      const act = pState?.OR_Altura_Carretilla || 0;
      const posOk = act >= (altura - tols.negativa) && act <= (altura + tols.positiva);
      console.log('[DIRECTO] Pegatina. posOk:', posOk, 'act:', act, 'rango:', altura - tols.negativa, '-', altura + tols.positiva);
      if (posOk) {
        setPegatinaPosicion(act); // guardar posición real de pegatina
        markOk(1);
      }
    }
  };

  // Exponer funciones al padre via ref
  useImperativeHandle(sequencerRef, () => ({
    onIniciarSecuencia: handleIniciarSecuenciaDirecto,
    onPegatina: handlePegatinaDireto,
    onAbortar: handleAbort,
    setPreview: (data) => setErpPreview(data)
  }));


  // ── PASO 1A: El lector envía el código → buscar en ERP → mostrar preview
  const handleLeerSecuencia = async () => {
    // Leer del DOM directamente para evitar problemas de race condition con escáneres rápidos
    const raw = (inputRef.current?.value || seqInput).trim();
    if (!raw) return;
    setSeqInput('');
    if (inputRef.current) inputRef.current.value = '';
    setSeqLoading(true);
    setSeqError('');
    try {
      const res = await fetch(`${API_BASE}/erp/qr/${encodeURIComponent(raw)}`);
      const data = await res.json();
      if (res.ok) {
        setErpPreview(data);
      } else {
        setSeqError(data.detail || `QR '${raw}' no encontrado en ERP.`);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    } catch {
      setSeqError('Sin conexión con el servidor.');
      setTimeout(() => inputRef.current?.focus(), 100);
    } finally {
      setSeqLoading(false);
    }
  };

  // Mantener el focus del escáner activo agresivamente (hack para HMIs industriales)
  useEffect(() => {
    if (inputMode === 'scanner' && stepStatus[0] === STEP_STATUS.ACTIVE && !erpPreview && !seqLoading && !isAnyModalOpen) {
      inputRef.current?.focus();
      const focusInterval = setInterval(() => {
        if (document.activeElement !== inputRef.current) {
          inputRef.current?.focus();
        }
      }, 300);
      return () => clearInterval(focusInterval);
    }
  }, [inputMode, stepStatus, erpPreview, seqLoading, isAnyModalOpen]);

  // ── PASO 1B: Confirmar preview → cargar en ERP data y avanzar
  const handleConfirmPreview = () => {
    if (!erpPreview) return;

    // Para iniciar la carga de la secuencia, las vallas tienen que estar en reposo
    const isReposo = plcStateRef.current ? plcStateRef.current.Ob_Reposo_Cilindro_Valla_1 === true : true;
    if (!isReposo) {
      setSeqError("Error: Las vallas deben estar en reposo para iniciar.");
      console.warn("Bloqueado: Intento de confirmación de secuencia con vallas fuera de reposo.");
      return;
    }

    const data = erpPreview;
    
    // Iniciar el seguimiento del ciclo en la base de datos
    const opName = operario ? `${operario.NOMBRE || ''} ${operario.APELLIDOS || ''}`.trim() : 'Desconocido';
    fetch(`${API_BASE}/api/cycle/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referencia: data.bastidor,
        operario: opName,
        fecha_montaje: data.fecha_montaje || '0',
        nsecuencia: data.secuencia || '0',
        nmodelo: data.modelo || '0',
        nbastidor: data.bastidor || '0',
        nmastil: data.mastil || '0',
        altura_max_intermedia: data.altura_max_interm != null ? Number(data.altura_max_interm) : 0.0
      })
    }).catch(err => console.error("Error starting cycle tracking:", err));

    previewConfirmedRef.current = data.bastidor; // marcar como confirmado ANTES de limpiar
    setErpPreview(null);
    setManualBastidor('');
    setSeqError('');
    onErpData(data);
    // El useEffect comprobará previewConfirmedRef y avanzará el paso
  };


  // Cancelar preview → volver al modo de entrada
  const handleCancelarLectura = () => {
    setErpPreview(null);
    setScannedSeq(null);
    setSeqInput('');
    setSeqError('');
    setManualBastidor('');
    if (erpData) onErpData(null); // Limpiar si venía del modal ERP
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Foco automático — siempre que el paso 1 esté activo y no haya preview pendiente
  useEffect(() => {
    if (currentStep === 0 && stepStatus[0] === STEP_STATUS.ACTIVE && !scannedSeq && !erpPreview) {
      inputRef.current?.focus();
    }
  }, [currentStep, stepStatus, scannedSeq, erpPreview]);

  // Re-foco si el usuario hace clic fuera
  const handleStepClick = () => {
    if (stepStatus[0] === STEP_STATUS.ACTIVE && !scannedSeq && !erpPreview) inputRef.current?.focus();
  };


  // ── PASO 2: Multiload — decidir automáticamente al entrar ─────────────────
  useEffect(() => {
    if (currentStep === 1 && stepStatus[1] === STEP_STATUS.ACTIVE && erpData && !stepInitRef.current[1]) {
      stepInitRef.current[1] = true;
      const altura = erpData.altura_max_interm;
      if (!altura || altura === 0) {
        // Sin multiload → saltar
        setTimeout(() => toggleSkip(1), 600);
      } else if (palletState === 'idle') {
        setPalletState('animating');
      }
    }
  }, [currentStep, stepStatus, erpData, palletState, setPalletState]);

  // ── PASO 3: Test sin carga — preparar estado inicial ────────────
  useEffect(() => {
    if (currentStep === 2 && stepStatus[2] === STEP_STATUS.ACTIVE && erpData && !stepInitRef.current[2]) {
      stepInitRef.current[2] = true;
      setCameraTestState('standby');
      if (isSimulation) {
        // Bajar la carga abajo automáticamente para iniciar la prueba
        fetch(`${API_BASE}/plc/write`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ OR_Altura_Carretilla: 0 })
        }).catch(console.error);
      }
    }
  }, [currentStep, stepStatus, erpData, isSimulation]);

  // ── PASO 3: Recoger pallet (sin carga) — se dispara en cuanto el palletState es válido ──
  // Separado del init para que funcione aunque el palletState llegue tarde (ej. al saltar multiload)
  // Sin condición isSimulation: la animación del Digital Twin es visual y funciona en ambos modos
  useEffect(() => {
    if (
      currentStep === 2 &&
      stepStatus[2] === STEP_STATUS.ACTIVE &&
      erpData &&
      !step3PalletTriggeredRef.current &&
      (palletState === 'idle' || palletState === 'picked_up')
    ) {
      step3PalletTriggeredRef.current = true;
      setPalletState('animating');
    }
  }, [currentStep, stepStatus, erpData, palletState, setPalletState]);

  // ── PASO 3: Auto-arrancar cámara cuando el operario pulsa INICIAR (stepStarted[2]=true) ──
  useEffect(() => {
    if (currentStep === 2 && stepStatus[2] === STEP_STATUS.ACTIVE && stepStarted[2]) {
      if (cameraTestState === 'standby') {
        setCameraTestState('esperando_1500');
        setSimTimers({ elev: null, desc: null, finishedElev: false, finishedDesc: false, pendingReadDesc: false });
      }
    }
  }, [currentStep, stepStatus, stepStarted, cameraTestState]);

  // ── PASO 4: Test con carga ────────────────────────────────────────────
  useEffect(() => {
    if (currentStep === 3 && stepStatus[3] === STEP_STATUS.ACTIVE && erpData) {
      // Init de cámara: solo una vez al activar el paso
      if (!stepInitRef.current[3]) {
        stepInitRef.current[3] = true;
        step4PalletTriggeredRef.current = false; // reset guardia del pallet al entrar
        setCameraTestState('standby');
      }
      // Animación de recogida de carga pesada: disparar solo una vez por activación
      // Se dispara cuando el pallet está listo (idle o picked_up del paso anterior)
      if (!step4PalletTriggeredRef.current && (palletState === 'idle' || palletState === 'picked_up')) {
        step4PalletTriggeredRef.current = true;
        setPalletState('animating');
      }
    }
  }, [currentStep, stepStatus, erpData, palletState, setPalletState]);




  // ── PASO 5: Test con carga máxima altura ─────────────────────────────
  useEffect(() => {
    if (currentStep === 4 && stepStatus[4] === STEP_STATUS.ACTIVE && erpData && !stepInitRef.current[4]) {
      stepInitRef.current[4] = true;
      setTest5mState('idle');
      setTimer5min(null);
      if (isSimulation) {
        // Recoger la carga (pallets pesados) si venimos directo, aunque normalmente ya los tenemos de la etapa 4
        if (palletState === 'idle' || palletState === 'picked_up') setPalletState('animating');
      }
    }
  }, [currentStep, stepStatus, erpData, isSimulation, palletState, setPalletState]);

  // ── Auto-Save y Luces Rojas al Finalizar ──
  const hasAutoSaved = useRef(false);

  useEffect(() => {
    if (isSequenceFinished && !hasAutoSaved.current) {
      hasAutoSaved.current = true;
      saveLog('OK');
      if (onSequenceEnd) onSequenceEnd();
      
      const vallaTrabajo = plcStateRef.current?.Ob_Trabajo_Cilindro_Valla_1 || plcStateRef.current?.Ob_Trabajo_Cilindro_Valla_2;
      if (vallaTrabajo) {
        fetch('http://localhost:8001/plc/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ Ib_LUZ_ROJA: true, is_force: isSimulation })
        }).catch(err => console.error('Error encendiendo luz roja al finalizar:', err));
      }
    } else if (!isSequenceFinished) {
      hasAutoSaved.current = false;
    }
  }, [isSequenceFinished, isSimulation, onSequenceEnd]);


  // ── Sincronizar overlay de status panel (cota + estado) para steps 2-4 ──
  useEffect(() => {
    if (!setStep2Overlay) return;
    const is5mActive = currentStep === 4 && stepStatus[4] === STEP_STATUS.ACTIVE && erpData && stepStarted[4];

    if (is5mActive) {
      updateStep2Overlay({
        active: true,
        mode: 'test_5m',
        actual: currentHeightMm,
        cotaInicial,
        test5mState,
        timer5min,
        testAlarm,
        isAbove: currentHeightMm >= cotaInicial,
      });
    } else if (currentStep === 1 && stepStatus[1] === STEP_STATUS.ACTIVE && erpData) {
      // Mantener el panel de multiload (lo gestiona el useEffect de multiload overlay)
    } else {
      updateStep2Overlay(null);
    }
  }, [
    currentStep, stepStatus, erpData, stepStarted, currentHeightMm, cotaInicial,
    cameraTestState, waitCountdown, test5mState, timer5min, testAlarm, is1mTest
  ]);

  // ── Sincronizar overlay de HUD ───────────────────────────────────────────
  useEffect(() => {
    if (setTestHUDOverlay) {
      if ((currentStep === 2 || currentStep === 3) && stepStatus[currentStep] === STEP_STATUS.ACTIVE && erpData) {
        let ledState = 'standby';
        const elevMeters = isSimulation ? (window.__carriageY || 0) : (plcState?.OR_Altura_Carretilla || 0) / 1000;

        if (cameraTestState === 'standby') {
          ledState = 'standby'; // rojo parpadeante
        }
        else if (cameraTestState === 'esperando_1500') {
          ledState = 'standby'; // rojo parpadeante — esperando cruzar 1500mm
        }
        else if (cameraTestState === 'ascenso' || cameraTestState === 'espera_arriba' || cameraTestState === 'descenso') {
          ledState = 'active'; // verde parpadeante — prueba en progreso
        }
        else if (cameraTestState === 'ok') ledState = 'ok';
        else if (cameraTestState === 'nok') ledState = 'nok';

        const isSinCarga = currentStep === 2;
        const minElev = isSinCarga ? erpData.tpo_elev_min_scarga : erpData.tpo_elevac_min;
        const maxElev = isSinCarga ? erpData.tpo_elev_max_scarga : erpData.tpo_elevac_max;
        const minDesc = isSinCarga ? erpData.tpo_desc_min_scarga : erpData.tpo_descenso_min;
        const maxDesc = isSinCarga ? erpData.tpo_desc_max_scarga : erpData.tpo_descenso_max;

        // Solo mostrar tiempos si han finalizado (hasta ese momento mostrar guion)
        const rawElev = simTimers.elev;
        const rawDesc = simTimers.desc;
        
        const realElev = simTimers.finishedElev ? rawElev : null;
        const realDesc = simTimers.finishedDesc ? rawDesc : null;

        updateTestHUDOverlay({
          title: isSinCarga ? 'TEST SIN CARGA' : 'TEST CON CARGA',
          subtitle: `PRUEBA ${is1mTest ? '1m' : '2m'}${!isSinCarga ? ` | ${erpData.peso_pruebas ?? '—'} kg` : ''}`,
          cameraTestState,
          ledState,
          minElev: ds2s(minElev),
          maxElev: ds2s(maxElev),
          minDesc: ds2s(minDesc),
          maxDesc: ds2s(maxDesc),
          realElev: ds2s(realElev),
          realDesc: ds2s(realDesc),
          // Valores raw (centisegundos) para comparación en el HUD
          _rawElev: realElev,
          _rawDesc: realDesc,
          _minElev: minElev,
          _maxElev: maxElev,
          _minDesc: minDesc,
          _maxDesc: maxDesc,
          waitCountdown,
          testAlarm,
          testDist: is1mTest ? 1.0 : 2.0
        });
      } else if (currentStep === 4 && stepStatus[4] === STEP_STATUS.ACTIVE && erpData) {
        updateTestHUDOverlay({
          title: 'ESTABILIDAD 5 MINUTOS',
          subtitle: `CAÍDA MÁXIMA ${test5mConfig.tolerancia}mm`,
          test5mState,
          testAlarm,
          is5mTest: true
        });
      } else {
        updateTestHUDOverlay(null);
      }
    }
  }, [currentStep, stepStatus, erpData, cameraTestState, waitCountdown, setTestHUDOverlay, isSimulation, simTimers, test5mState, testAlarm]);

  // Notificar al LED parpadeante si estamos esperando que el usuario pulse INICIAR SECUENCIA
  useEffect(() => {
    if (!setWaitingForIniciar) return;
    const isWaitingToStart = (currentStep === 0 && !!erpPreview) || 
                             (currentStep >= 1 && currentStep <= 4 && stepStatus[currentStep] === STEP_STATUS.ACTIVE && !stepStarted[currentStep]);
    setWaitingForIniciar(isWaitingToStart);
  }, [currentStep, erpPreview, stepStatus, stepStarted, setWaitingForIniciar]);

  // ── Sincronizar Inicia temporizador ascenso y descenso con el PLC ──
  useEffect(() => {
    const isTesting = (currentStep === 2 || currentStep === 3);
    const iniciaAscenso = isTesting && ['esperando_1500', 'ascenso'].includes(cameraTestState);
    const iniciaDescenso = isTesting && ['descenso'].includes(cameraTestState);

    const payload = {
      inicia_temporizador_ascenso: iniciaAscenso,
      inicia_temporizador_descenso: iniciaDescenso,
      is_force: isSimulation
    };

    if (cameraTestState === 'esperando_1500') {
      payload.OW_Tiempo_Elevacion = 0;
      payload.OW_Tiempo_Descenso = 0;
      payload.or_tiempo_elevacion = 0;
      payload.or_tiempo_descenso = 0;
    }

    const payloadKey = JSON.stringify({ 
      iniciaAscenso, 
      iniciaDescenso, 
      cameraTestState, 
      connected: telemetry?.opcua_connected,
      currentStep 
    });
    if (window.__lastTimerControlState === payloadKey) return;
    window.__lastTimerControlState = payloadKey;

    fetch(`${API_BASE}/plc/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(translatePayload(payload, isSimulation))
    }).catch(err => console.error("Error setting PLC timer controls:", err));

  }, [cameraTestState, currentStep, isSimulation, telemetry?.opcua_connected]);

  // ── Sincronizar consigna_posicion_altura al cargar la aplicación y al cambiar de cota ──
  useEffect(() => {
    const payload = {
      consigna_posicion_altura: cotaInicial,
      is_force: isSimulation
    };

    fetch(`${API_BASE}/plc/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(translatePayload(payload, isSimulation))
    }).catch(err => console.error("Error setting PLC height reference:", err));
  }, [cotaInicial, isSimulation, syncTrigger, telemetry?.opcua_connected]);

  // ── Sincronizar altura relativa únicamente cuando se cargue la referencia (erpData) ──
  useEffect(() => {
    if (!erpData) return;

    const testDistValue = is1mTest ? 1 : 2;
    const payload = {
      altura_relativa: testDistValue,
      is_force: isSimulation
    };

    fetch(`${API_BASE}/plc/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(translatePayload(payload, isSimulation))
    }).catch(err => console.error("Error setting PLC relative height:", err));

  }, [erpData, is1mTest, isSimulation, syncTrigger, telemetry?.opcua_connected]);

  // ── PASO 5: 5 minutos — decidir automáticamente al entrar ─────────────────
  useEffect(() => {
    if (currentStep === 4 && stepStatus[4] === STEP_STATUS.ACTIVE && erpData) {
      if (!isMxXL(erpData.modelo)) {
        setTimeout(() => toggleSkip(4), 600);
      }
    }
  }, [currentStep, stepStatus, erpData]);

  // ── Etapa 5: Bucle Automático de Prueba de 5 Minutos ──────────────────────
  useEffect(() => {
    if (currentStep !== 4 || stepStatus[4] !== STEP_STATUS.ACTIVE || !stepStarted[4]) return;

    let reqId;
    const loop = () => {
      const currentHeight = isSimulation 
        ? parseFloat(((window.__carriageY || 0) * 1000).toFixed(0))
        : parseFloat(Number(plcStateRef.current?.OR_Altura_Carretilla || 0).toFixed(0));

      const currentPallets = plcStateRef.current?.OW_Numero_Pallets || 0;
      const targetLoad = erpDataRef.current?.peso_pruebas || 0;
      const pesoPrueba = Math.floor(targetLoad / 250) * 250;
      const currentLoad = currentPallets * 250;

      setTest5mState(prevState => {
        let nextState = prevState;
        const toleranceM = test5mConfig.tolerancia / 1000; // 10mm = 0.01m

        if (prevState === 'esperando_elevacion') {
          // cotaInicial está en mm, currentHeight en mm. 
          // Esperamos que esté por encima de cotaInicial.
          if (currentHeight >= cotaInicial && currentLoad === pesoPrueba) {
            nextState = 'stabilizing';
            stage5StableStartRef.current = Date.now();
            stage5InitialHeightRef.current = currentHeight;
          }
        } else if (prevState === 'stabilizing') {
          if (currentHeight < cotaInicial) {
            nextState = 'idle';
          } else {
            // Si fluctúa mucho (> 30mm), reseteamos estabilización
            if (Math.abs(currentHeight - stage5InitialHeightRef.current) > 30) {
              stage5StableStartRef.current = Date.now();
              stage5InitialHeightRef.current = currentHeight;
            }
            if (Date.now() - stage5StableStartRef.current >= 3000) {
              nextState = 'running';
              stage5TimerStartRef.current = Date.now();
              stage5InitialHeightRef.current = currentHeight;
              // Guardar la cota inicial final para el reporte
              stageDataRef.current[5] = { ...stageDataRef.current[5], altura_inicial: currentHeight };
            }
          }
        } else if (prevState === 'running') {
          const elapsedSeconds = Math.floor((Date.now() - stage5TimerStartRef.current) / 1000);
          const remaining = Math.max(0, test5mConfig.duration - elapsedSeconds);
          if (timer5minRef.current !== remaining) {
            timer5minRef.current = remaining;
            setTimer5min(remaining);
          }

          // Comprobar variación > tolerancia requerida (test5mConfig.tolerancia) en mm
          if (Math.abs(currentHeight - stage5InitialHeightRef.current) > test5mConfig.tolerancia) {
            nextState = 'nok';
            setTestAlarm(`Caída de cota excedida. Variación: ${Math.abs(currentHeight - stage5InitialHeightRef.current).toFixed(0)} mm (> ${test5mConfig.tolerancia} mm)`);
            stageDataRef.current[5] = {
              ...stageDataRef.current[5],
              altura_final: currentHeight,
              diff: Math.abs(currentHeight - stage5InitialHeightRef.current)
            };
          } else if (remaining === 0) {
            nextState = 'ok';
            stageDataRef.current[5] = {
              ...stageDataRef.current[5],
              altura_final: currentHeight,
              diff: Math.abs(currentHeight - stage5InitialHeightRef.current)
            };
            // Avanzar automáticamente cuando pasa el test
            setTimeout(() => markOk(4), 500);
          }
        }


        return nextState;
      });

      reqId = requestAnimationFrame(loop);
    };

    reqId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(reqId);
  }, [currentStep, stepStatus, stepStarted, test5mConfig, isSimulation, cotaInicial]);

  const timer5minDisplay = timer5min !== null
    ? `${String(Math.floor(timer5min / 60)).padStart(2, '0')}:${String(timer5min % 60).padStart(2, '0')}`
    : null;

  const handleRepetirCameraTest = () => {
    resetStartsInPlc();
    setCameraTestState('standby');
    setTestAlarm(null);
    setSimTimers({ elev: null, desc: null, finishedElev: false, finishedDesc: false, pendingReadDesc: false });
    setWaitCountdown(null);
    setTimeout(() => {
      setCameraTestState('esperando_1500');
    }, 500);
  };

  const handleContinuarCameraTest = (stepIdx) => {
    const confirmKey = stepIdx === 2 ? 'confirm_camera_sincarga_nok_short' : 'confirm_camera_concarga_nok_short';
    if (window.confirm(t(confirmKey))) {
      markOk(stepIdx);
    }
  };

  const handleRepetir5m = () => {
    setTest5mState('esperando_elevacion');
    setTimer5min(null);
    setTestAlarm(null);
  };

  const handleContinuar5m = () => {
    // Avanzar forzadamente a pesar del fallo con confirmación previa
    if (window.confirm(t('confirm_5min_nok_short'))) {
      markOk(4);
    }
  };


  // ─────────────────────────────────────────────────────────────────────────
  return (
    <aside className="w-80 bg-gradient-to-b from-[#151f25] to-[#0a0f12] h-full flex flex-col border-l border-[#2e404a] z-10 shrink-0 relative">

      {/* Overlays de cuenta atrás unificados */}
      {(!repeatModal.show && test5mState !== 'nok' && cameraTestState !== 'nok') && (iniciarCountdown > 0 || abortarCountdown > 0 || pegatinaCountdown > 0 || repetirCountdown > 0) && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
          <div className="text-center flex flex-col items-center">
            {iniciarCountdown > 0 && (
              <span className="text-[12rem] leading-none font-black text-logisnext-magenta tracking-tighter animate-pulse drop-shadow-[0_0_40px_#dd2876]">
                {iniciarCountdown}
              </span>
            )}
            {abortarCountdown > 0 && (
              <span className="text-[12rem] leading-none font-black text-red-500 tracking-tighter animate-pulse drop-shadow-[0_0_40px_rgba(239,68,68,0.8)]">
                {abortarCountdown}
              </span>
            )}
            {pegatinaCountdown > 0 && (
              <span className="text-[12rem] leading-none font-black text-blue-500 tracking-tighter animate-pulse drop-shadow-[0_0_40px_rgba(59,130,246,0.8)]">
                {pegatinaCountdown}
              </span>
            )}
            {repetirCountdown > 0 && (
              <span className="text-[12rem] leading-none font-black text-yellow-500 tracking-tighter animate-pulse drop-shadow-[0_0_40px_rgba(234,179,8,0.8)]">
                {repetirCountdown}
              </span>
            )}
          </div>
        </div>,
        document.body
      )}
      <div className="p-5 bg-[#1d2930]/80 backdrop-blur-md border-b border-[#2e404a] flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-logisnext-slate/20 rounded-md border border-logisnext-slate/40 text-logisnext-lightslate">
            <Layers size={18} />
          </div>
          <div className="flex flex-col">
            <h2 className="font-black text-white uppercase tracking-widest text-sm">SECUENCIA</h2>
            <span className="text-[9px] text-logisnext-lightslate font-bold uppercase tracking-widest">
              Protocolo de Prueba
            </span>
            {operario && (
              <span className="text-[9px] text-logisnext-magenta font-black uppercase tracking-widest mt-0.5">
                Op: {`${operario.NOMBRE || ''} ${operario.APELLIDOS || ''}`.trim()}
              </span>
            )}
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

        {/* Banner de seguridad: Vallas no en posición */}
        {(erpData && (currentStep === 3 || currentStep === 4) && (!plcState?.Ob_Trabajo_Cilindro_Valla_1 || !plcState?.Ob_Trabajo_Cilindro_Valla_2)) && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-3 py-2 rounded-lg flex items-center justify-center gap-2 font-black tracking-widest text-xs shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <AlertTriangle size={16} className="text-red-500" />
            VALLAS NO EN POSICIÓN
          </div>
        )}

        {/* ── PREVIEW: datos ERP encontrados → confirmar ── */}
        {erpPreview && (
          <ErpPreviewCard
            data={erpPreview}
            iniciarPlcTime={iniciarPlcTime}
            onConfirm={handleConfirmPreview}
            onCancel={handleCancelarLectura}
            error={seqError}
          />
        )}

        {/* ── PASO 1: Leer código de barras / secuencia ────────────────────── */}
        <StepCard num={1} icon={Barcode} title="Identificar carretilla" status={stepStatus[0]}>
          {stepStatus[0] === STEP_STATUS.ACTIVE && !erpPreview && (
            <>
              {/* ── Selector de modo ── */}
              {!seqLoading && (
                <div className="flex rounded-lg overflow-hidden border border-[#2e404a] mb-2">
                  <button
                    onClick={() => { setInputMode('scanner'); setManualDigits(''); setSeqError(''); setTimeout(() => inputRef.current?.focus(), 50); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${inputMode === 'scanner'
                      ? 'bg-logisnext-magenta/20 text-logisnext-magenta border-r border-logisnext-magenta/30'
                      : 'bg-transparent text-logisnext-slate hover:text-white border-r border-[#2e404a]'
                      }`}
                  >
                    <Barcode size={10} /> Escáner
                  </button>
                  <button
                    onClick={() => { setInputMode('manual'); setSeqInput(''); setSeqError(''); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${inputMode === 'manual'
                          ? 'bg-logisnext-magenta/20 text-logisnext-magenta border-r border-logisnext-magenta/30'
                          : 'bg-transparent text-logisnext-slate hover:text-white border-r border-[#2e404a]'
                          }`}
                      >
                        <Hash size={10} /> Manual
                      </button>
                      <button
                        onClick={() => { if (onOpenErp) onOpenErp(); }}
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
                        defaultValue=""
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

                  {/* ── Modo Escáner: esperando lectura ── */}
                  {inputMode === 'scanner' && !seqLoading && (
                    <div
                      onClick={handleStepClick}
                      className={`relative flex flex-col items-center justify-center gap-3 py-5 px-4 rounded-xl border-2 border-dashed cursor-text transition-all ${seqError
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
                          {seqInput}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Modo Manual: campo de bastidor ── */}
                  {inputMode === 'manual' && !seqLoading && (
                    <div className="flex flex-col gap-3">
                      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border bg-[#0a0f12] shadow-inner ${seqError ? 'border-red-500/50' : 'border-logisnext-magenta/40'}`}>
                        <Hash size={14} className="text-logisnext-slate shrink-0" />
                        <input
                          ref={manualBastidorRef}
                          type="text"
                          value={manualBastidor}
                          onChange={e => { setManualBastidor(e.target.value.toUpperCase()); setSeqError(''); }}
                          onKeyDown={e => { if (e.key === 'Enter') handleConfirmarBastidor(); }}
                          placeholder="Escribe el bastidor…"
                          autoFocus
                          className="flex-1 bg-transparent text-white font-mono text-lg font-bold placeholder-[#3a5060] outline-none tracking-widest uppercase"
                        />
                        {manualBastidor && (
                          <button onClick={() => setManualBastidor('')} className="text-logisnext-slate hover:text-white transition-colors">
                            <X size={13} />
                          </button>
                        )}
                      </div>
                      {seqError && (
                        <div className="flex items-center gap-1.5 text-red-400 px-1">
                          <AlertTriangle size={11} />
                          <span className="text-[10px] font-medium">{seqError}</span>
                        </div>
                      )}
                      <button
                        onClick={handleConfirmarBastidor}
                        disabled={!manualBastidor.trim()}
                        className="w-full py-2.5 rounded-xl bg-logisnext-magenta hover:bg-logisnext-magenta/80 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(221,40,118,0.3)] active:scale-95"
                      >
                        Buscar en ERP
                      </button>
                      <p className="text-[9px] text-logisnext-slate/60 text-center">
                        Escribe el número de bastidor y pulsa Enter
                      </p>
                    </div>
                  )}

                  {/* Buscando... */}
                  {seqLoading && (
                    <div className="flex flex-col items-center gap-3 py-6">
                      <Loader2 size={28} className="animate-spin text-logisnext-magenta" />
                      <span className="text-[10px] text-logisnext-magenta font-bold uppercase tracking-widest">
                        Buscando en ERP…
                      </span>
                    </div>
                  )}
            </>
          )}
          {stepStatus[0] === STEP_STATUS.OK && erpData && (
            <>
              <DataLine label="Bastidor" value={erpData.bastidor} highlight />
              <DataLine label="Secuencia" value={erpData.secuencia} />
              <DataLine label="Modelo" value={erpData.modelo} />
              <DataLine label="Mástil" value={erpData.mastil} />
            </>
          )}
        </StepCard>



        {/* ── PASO 2: Multiload — poner mástil en posición ────────────────── */}
        <StepCard num={2} icon={Ruler} title="Posición multiload" status={stepStatus[1]} canSkip onToggleSkip={() => toggleSkip(1)}>
          {stepStatus[1] === STEP_STATUS.ACTIVE && erpData && (() => {
            const alturaMax = erpData.altura_max_interm;
            const alturaAct = plcState?.OR_Altura_Carretilla || 0;
            const isPosOk = alturaAct >= (alturaMax - tolerancias.negativa) && alturaAct <= (alturaMax + tolerancias.positiva);

            return (
              <>
                <DataLine label="Altura máx" value={`${alturaMax} mm`} highlight />
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-logisnext-slate font-bold uppercase tracking-widest mb-1">Tolerancia</span>
                    <div className="flex gap-2">
                      <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/30">+{tolerancias.positiva}</span>
                      <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30">-{tolerancias.negativa}</span>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-logisnext-slate font-bold uppercase tracking-widest mb-1">Actual</span>
                    <span className={`text-[12px] font-black ${isPosOk ? 'text-green-400' : 'text-blue-400'}`}>{alturaAct} mm</span>
                  </div>
                </div>

                {!stepStarted[1] ? (
                  <div className="flex items-center gap-2 text-yellow-400 font-bold bg-yellow-400/10 p-2 mt-2 rounded border border-yellow-400/20 text-[9px]">
                    <AlertTriangle size={12} /> ESPERANDO: Pulse INICIAR SECUENCIA
                  </div>
                ) : (
                  <>
                    <p className="text-[9px] text-logisnext-slate leading-relaxed mt-2">
                      Coloca la pegatina. El mástil debe estar en la altura correcta para confirmar.
                    </p>
                    {palletState === 'animating' && (
                      <div className="flex items-center gap-2 mt-2 py-1.5 px-2 bg-logisnext-magenta/10 border border-logisnext-magenta/30 rounded text-[9px] text-logisnext-magenta">
                        <Loader2 size={12} className="animate-spin" /> Animación de recogida del palet en curso...
                      </div>
                    )}
                    {!isPosOk && (
                      <div className="flex items-center gap-2 mt-2 py-1.5 px-2 bg-red-500/10 border border-red-500/30 rounded text-[9px] text-red-400">
                        <AlertTriangle size={12} /> Altura incorrecta. Posiciona el mástil dentro del rango.
                      </div>
                    )}
                    <ActionBtn onClick={() => markOk(1)} variant="primary" disabled={palletState === 'animating' || !isPosOk}>
                      <CheckCircle2 size={12} /> Pegatina Posicionada
                    </ActionBtn>
                  </>
                )}
              </>
            );
          })()}
          {stepStatus[1] === STEP_STATUS.SKIP && (
            <p className="text-[9px] text-yellow-500/80">
              Altura máx = 0 → <strong>Sin multiload</strong>. Paso omitido.
            </p>
          )}
          {stepStatus[1] === STEP_STATUS.OK && (
            <div className="flex flex-col gap-1">
              <DataLine label="Pos. pegatina" value={pegatinaPosicion != null ? `${pegatinaPosicion} mm` : `${erpData?.altura_max_interm ?? '—'} mm`} highlight />
              <DataLine label="Duración" value={formatDuration(stepDurations[1])} />
            </div>
          )}
        </StepCard>

        {/* ── PASO 3: Test SIN CARGA ───────────────────────────────────────── */}
        <StepCard
          num={3}
          icon={ArrowUpDown}
          title={`Test sin carga - PRUEBA ${erpData ? (is1mTest ? '1m' : '2m') : '—'}`}
          status={stepStatus[2]}
          canSkip
          onToggleSkip={() => toggleSkip(2)}
        >
          {stepStatus[2] === STEP_STATUS.ACTIVE && erpData && (() => {
            const minElev = erpData.tpo_elev_min_scarga;
            const maxElev = erpData.tpo_elev_max_scarga;
            const minDesc = erpData.tpo_desc_min_scarga;
            const maxDesc = erpData.tpo_desc_max_scarga;

            const realElev = simTimers.elev;
            const realDesc = simTimers.desc;

            // Derivación del estado del LED
            let ledState = 'standby';
            if (cameraTestState === 'standby') {
              const actualElev = isSimulation ? (window.__carriageY || 0) : (plcState?.OR_Altura_Carretilla || 0);
              const isAtBottom = isSimulation ? (actualElev <= 0.1) : (actualElev <= 50);
              ledState = isAtBottom ? 'standby-ok' : 'standby';
            }
            else if (cameraTestState === 'ascenso') {
              const actualElev = isSimulation ? (window.__carriageY || 0) : (plcState?.OR_Altura_Carretilla || 0);
              const isTiming = isSimulation ? (actualElev >= cotaInicial / 1000) : (actualElev >= cotaInicial);
              ledState = isTiming ? 'active' : 'standby';
            }
            else if (cameraTestState === 'espera_arriba' || cameraTestState === 'descenso') {
              ledState = 'active';
            }
            else if (cameraTestState === 'ok') ledState = 'ok';
            else if (cameraTestState === 'nok') ledState = 'nok';

            return (
              <>
                <div className="flex items-center justify-between bg-[#0a0f12] p-2 rounded-lg border border-[#2e404a] mb-2">
                  <span className="text-[10px] text-logisnext-slate font-bold uppercase tracking-widest flex items-center gap-1.5">
                    Temporizadores PLC
                  </span>
                  <div className="flex items-center gap-2">
                    {!(telemetry?.mappedPlc?.Ob_Ready_Temporizador ?? plcState?.Ob_Ready_Temporizador) && (
                      <button
                        onClick={() => {
                          const targetVar = (!isSimulation) 
                            ? Object.keys(JSON.parse(localStorage.getItem('plcVarMapping') || '{}')).find(k => JSON.parse(localStorage.getItem('plcVarMapping'))[k].appVar === 'Ib_Restart_Temporizador') 
                            : 'Ib_Restart_Temporizador';
                          if (targetVar) {
                            fetch(`${API_BASE}/plc/write`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ [targetVar]: true, is_force: isSimulation })
                            }).then(() => {
                              setTimeout(() => {
                                fetch(`${API_BASE}/plc/write`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ [targetVar]: false, is_force: isSimulation })
                                }).catch(console.error);
                              }, 500);
                            }).catch(console.error);
                          }
                        }}
                        className="text-[8px] bg-red-950/40 hover:bg-red-950/80 border border-red-500/30 text-red-400 px-1 rounded hover:text-white transition-colors"
                      >
                        RESTART
                      </button>
                    )}
                    <span className="text-[9px] text-gray-400 font-mono">
                      {(telemetry?.mappedPlc?.Ob_Ready_Temporizador ?? plcState?.Ob_Ready_Temporizador) ? 'READY' : 'NOT READY'}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${(telemetry?.mappedPlc?.Ob_Ready_Temporizador ?? plcState?.Ob_Ready_Temporizador) ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse'}`} />
                  </div>
                </div>

                {!isSimulation && (
                  <div className="flex items-center justify-between bg-[#0a0f12] p-2 rounded-lg border border-[#2e404a] mb-2">
                    <span className="text-[10px] text-logisnext-slate font-bold uppercase tracking-widest flex items-center gap-1.5">
                      Cámara Basler
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-gray-400 font-mono">
                        {cameraTestState === 'standby' && 'ESPERANDO CONDICIONES'}
                        {cameraTestState === 'ascenso' && 'ASCENSO ACTIVO'}
                        {cameraTestState === 'espera_arriba' && 'ESPERANDO ARRIBA'}
                        {cameraTestState === 'descenso' && 'DESCENSO ACTIVO'}
                        {cameraTestState === 'ok' && 'ELEVACION FINALIZADA'}
                        {cameraTestState === 'nok' && 'PRUEBA NOK'}
                      </span>
                      <CameraLED state={ledState} blinkTick={blinkTick} />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="bg-[#1d2930]/50 p-2 rounded border border-[#2e404a] flex flex-col justify-between">
                    <span className="text-[8px] text-logisnext-slate uppercase tracking-widest block mb-1">Ascenso (s)</span>
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-mono font-black text-white">{ds2s(realElev)}</span>
                      <span className="text-[8px] font-mono text-gray-500">[{ds2s(minElev)} - {ds2s(maxElev)}]</span>
                    </div>
                    {realElev > 0 && (
                      <div className="mt-1 pt-1 border-t border-[#2e404a] flex justify-between items-center">
                        <span className="text-[8px] text-gray-500">AVG:</span>
                        <span className="text-[10px] font-mono font-bold text-gray-300">{(((is1mTest ? 1 : 2) * 100000) / realElev).toFixed(0)} mm/s</span>
                      </div>
                    )}
                  </div>
                  <div className="bg-[#1d2930]/50 p-2 rounded border border-[#2e404a] flex flex-col justify-between">
                    <span className="text-[8px] text-logisnext-slate uppercase tracking-widest block mb-1">Descenso (s)</span>
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-mono font-black text-white">{ds2s(realDesc)}</span>
                      <span className="text-[8px] font-mono text-gray-500">[{ds2s(minDesc)} - {ds2s(maxDesc)}]</span>
                    </div>
                    {realDesc > 0 && (
                      <div className="mt-1 pt-1 border-t border-[#2e404a] flex justify-between items-center">
                        <span className="text-[8px] text-gray-500">AVG:</span>
                        <span className="text-[10px] font-mono font-bold text-gray-300">{(((is1mTest ? 1 : 2) * 100000) / realDesc).toFixed(0)} mm/s</span>
                      </div>
                    )}
                  </div>
                </div>

                {!stepStarted[2] ? (
                  <div className="flex flex-col gap-2">
                    {!isCarriageBelowCota && (
                      <div className="flex items-center justify-between p-2 mt-1 rounded-lg border text-[9px] bg-red-900/20 border-red-500/40 text-red-400">
                        <span className="font-bold uppercase tracking-wider flex items-center gap-1">
                          <AlertTriangle size={11}/>
                          Baje por debajo de {cotaInicial} mm para iniciar
                        </span>
                        <span className="font-mono font-black">{currentHeightMm} mm</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-yellow-400 font-bold bg-yellow-400/10 p-2 mt-1 rounded border border-yellow-400/20 text-[9px]">
                      <AlertTriangle size={12} /> ESPERANDO: Pulse INICIAR SECUENCIA
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Panel de cota — condición previa */}
                    {(cameraTestState === 'standby' || cameraTestState === 'esperando_1500') && (
                      <div className={`flex items-center justify-between p-2 mt-1 rounded-lg border text-[9px] ${
                        isCarriageBelowCota
                          ? 'bg-green-900/20 border-green-500/40 text-green-400'
                          : 'bg-red-900/20 border-red-500/40 text-red-400'
                      }`}>
                        <span className="font-bold uppercase tracking-wider flex items-center gap-1">
                          {isCarriageBelowCota ? <CheckCircle2 size={11}/> : <AlertTriangle size={11}/>}
                          {isCarriageBelowCota ? 'Listo para iniciar' : `Baje por debajo de ${cotaInicial} mm`}
                        </span>
                        <span className="font-mono font-black">{currentHeightMm} mm</span>
                      </div>
                    )}
                    <p className="text-[9px] text-logisnext-slate leading-relaxed mt-1">
                      Retira la carga y ejecuta la prueba. La cámara registrará los tiempos de ciclo.
                    </p>
                    {palletState === 'animating' && (
                      <div className="flex items-center gap-2 mt-2 py-1.5 px-2 bg-logisnext-magenta/10 border border-logisnext-magenta/30 rounded text-[9px] text-logisnext-magenta">
                        <Loader2 size={12} className="animate-spin" /> Animación de recogida del palet en curso...
                      </div>
                    )}
                    {cameraTestState === 'ok' && (
                      <div className="flex items-center justify-center gap-2 mt-2 py-2 px-3 bg-blue-500/15 border border-blue-400/50 rounded-lg animate-pulse">
                        <CheckCircle2 size={14} className="text-blue-400 shrink-0" />
                        <span className="text-[11px] font-black uppercase tracking-widest text-blue-300">Elevación Finalizada</span>
                      </div>
                    )}
                    {cameraTestState === 'nok' && (
                      <div className="flex flex-col gap-2 mt-2">
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-2 rounded text-[10px] font-bold">
                          <AlertTriangle size={12} className="inline mr-1" />
                          {testAlarm || 'Fallo de prueba de cámara sin carga.'}
                        </div>
                        <div className="flex gap-2">
                          <ActionBtn onClick={handleRepetirCameraTest} variant="secondary" className="flex-1">
                            <RotateCcw size={12} /> Repetir Prueba
                          </ActionBtn>
                          <ActionBtn onClick={() => handleContinuarCameraTest(2)} variant="primary" className="flex-1">
                            Continuar <CheckCircle2 size={12} />
                          </ActionBtn>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            );
          })()}
          {(stepStatus[2] === STEP_STATUS.PENDING) && (
            <div className="flex items-center gap-1.5 text-[9px] text-logisnext-slate">
              <Lock size={10} /> Pendiente paso anterior
            </div>
          )}
          {stepStatus[2] === STEP_STATUS.OK && (
            <DataLine label="Duración" value={formatDuration(stepDurations[2])} highlight />
          )}
        </StepCard>

        {/* ── PASO 4: Test CON CARGA ───────────────────────────────────────── */}
        <StepCard num={4} icon={Weight} title={`Test con carga - PRUEBA ${erpData ? (is1mTest ? '1m' : '2m') : '—'}`} status={stepStatus[3]} canSkip onToggleSkip={() => toggleSkip(3)}>
          {stepStatus[3] === STEP_STATUS.ACTIVE && erpData && (() => {
            const minElev = erpData.tpo_elevac_min;
            const maxElev = erpData.tpo_elevac_max;
            const minDesc = erpData.tpo_descenso_min;
            const maxDesc = erpData.tpo_descenso_max;

            const realElev = simTimers.elev;
            const realDesc = simTimers.desc;

            // Derivación del estado del LED
            let ledState = 'standby';
            if (cameraTestState === 'standby' || cameraTestState === 'esperando_1500') {
              const actualElev = isSimulation ? (window.__carriageY || 0) : (plcState?.OR_Altura_Carretilla || 0);
              const isAtBottom = isSimulation ? (actualElev <= 0.1) : (actualElev <= 50);
              ledState = isAtBottom ? 'standby-ok' : 'standby';
            }
            else if (cameraTestState === 'ascenso') {
              const actualElev = isSimulation ? (window.__carriageY || 0) : (plcState?.OR_Altura_Carretilla || 0);
              const isTiming = isSimulation ? (actualElev >= cotaInicial / 1000) : (actualElev >= cotaInicial);
              ledState = isTiming ? 'active' : 'standby';
            }
            else if (cameraTestState === 'espera_arriba' || cameraTestState === 'descenso') {
              ledState = 'active';
            }
            else if (cameraTestState === 'ok') ledState = 'ok';
            else if (cameraTestState === 'nok') ledState = 'nok';

            return (
              <>
                <div className="flex flex-col gap-1 border border-[#2e404a] p-2 rounded-lg bg-[#0a0f12]">
                  <DataLine label="PESO ERP" value={erpData.peso_pruebas != null ? `${erpData.peso_pruebas} kg` : '—'} highlight />
                  <DataLine label="PESO PRUEBA" value={erpData.peso_pruebas != null ? `${Math.floor(erpData.peso_pruebas / 250) * 250} kg` : '—'} highlight />
                  <DataLine label="CARGA ACTUAL" value={plcState?.OW_Numero_Pallets ? `${plcState.OW_Numero_Pallets * 250} kg` : '0 kg'} highlight={false} />
                  {plcState?.OW_Numero_Pallets > 0 && (
                    <span className="text-[8px] text-logisnext-slate ml-auto -mt-1 mb-1 block">
                      ({plcState.OW_Numero_Pallets} pallet{plcState.OW_Numero_Pallets !== 1 ? 's' : ''} × 250kg)
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between bg-[#0a0f12] p-2 rounded-lg border border-[#2e404a] mb-2 mt-2">
                  <span className="text-[10px] text-logisnext-slate font-bold uppercase tracking-widest flex items-center gap-1.5">
                    Temporizadores PLC
                  </span>
                  <div className="flex items-center gap-2">
                    {!(telemetry?.mappedPlc?.Ob_Ready_Temporizador ?? plcState?.Ob_Ready_Temporizador) && (
                      <button
                        onClick={() => {
                          const targetVar = (!isSimulation) 
                            ? Object.keys(JSON.parse(localStorage.getItem('plcVarMapping') || '{}')).find(k => JSON.parse(localStorage.getItem('plcVarMapping'))[k].appVar === 'Ib_Restart_Temporizador') 
                            : 'Ib_Restart_Temporizador';
                          if (targetVar) {
                            fetch(`${API_BASE}/plc/write`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ [targetVar]: true, is_force: isSimulation })
                            }).then(() => {
                              setTimeout(() => {
                                fetch(`${API_BASE}/plc/write`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ [targetVar]: false, is_force: isSimulation })
                                }).catch(console.error);
                              }, 500);
                            }).catch(console.error);
                          }
                        }}
                        className="text-[8px] bg-red-950/40 hover:bg-red-950/80 border border-red-500/30 text-red-400 px-1 rounded hover:text-white transition-colors"
                      >
                        RESTART
                      </button>
                    )}
                    <span className="text-[9px] text-gray-400 font-mono">
                      {(telemetry?.mappedPlc?.Ob_Ready_Temporizador ?? plcState?.Ob_Ready_Temporizador) ? 'READY' : 'NOT READY'}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${(telemetry?.mappedPlc?.Ob_Ready_Temporizador ?? plcState?.Ob_Ready_Temporizador) ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse'}`} />
                  </div>
                </div>

                {!isSimulation && (
                  <div className="flex items-center justify-between bg-[#0a0f12] p-2 rounded-lg border border-[#2e404a] mb-2 mt-2">
                    <span className="text-[10px] text-logisnext-slate font-bold uppercase tracking-widest flex items-center gap-1.5">
                      Cámara Basler
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-gray-400 font-mono">
                        {cameraTestState === 'standby' && 'ESPERANDO CONDICIONES'}
                        {cameraTestState === 'esperando_1500' && `ESPERANDO ASCENSO (>${cotaInicial / 1000}M)`}
                        {cameraTestState === 'ascenso' && 'ASCENSO ACTIVO'}
                        {cameraTestState === 'espera_arriba' && 'ESPERANDO ARRIBA'}
                        {cameraTestState === 'descenso' && 'DESCENSO ACTIVO'}
                        {cameraTestState === 'ok' && 'ELEVACION FINALIZADA'}
                        {cameraTestState === 'nok' && 'PRUEBA NOK'}
                      </span>
                      <CameraLED state={ledState} blinkTick={blinkTick} />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mb-2 mt-2">
                  <div className="bg-[#1d2930]/50 p-2 rounded border border-[#2e404a] flex flex-col justify-between">
                    <span className="text-[8px] text-logisnext-slate uppercase tracking-widest block mb-1">Ascenso (s)</span>
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-mono font-black text-white">{ds2s(realElev)}</span>
                      <span className="text-[8px] font-mono text-gray-500">[{ds2s(minElev)} - {ds2s(maxElev)}]</span>
                    </div>
                    {realElev > 0 && (
                      <div className="mt-1 pt-1 border-t border-[#2e404a] flex justify-between items-center">
                        <span className="text-[8px] text-gray-500">AVG:</span>
                        <span className="text-[10px] font-mono font-bold text-gray-300">{(((is1mTest ? 1 : 2) * 100000) / realElev).toFixed(0)} mm/s</span>
                      </div>
                    )}
                  </div>
                  <div className="bg-[#1d2930]/50 p-2 rounded border border-[#2e404a] flex flex-col justify-between">
                    <span className="text-[8px] text-logisnext-slate uppercase tracking-widest block mb-1">Descenso (s)</span>
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-mono font-black text-white">{ds2s(realDesc)}</span>
                      <span className="text-[8px] font-mono text-gray-500">[{ds2s(minDesc)} - {ds2s(maxDesc)}]</span>
                    </div>
                    {realDesc > 0 && (
                      <div className="mt-1 pt-1 border-t border-[#2e404a] flex justify-between items-center">
                        <span className="text-[8px] text-gray-500">AVG:</span>
                        <span className="text-[10px] font-mono font-bold text-gray-300">{(((is1mTest ? 1 : 2) * 100000) / realDesc).toFixed(0)} mm/s</span>
                      </div>
                    )}
                  </div>
                </div>

                {!stepStarted[3] ? (
                  <div className="flex flex-col gap-2">
                    {!isCarriageBelowCota && (
                      <div className="flex items-center justify-between p-2 mt-1 rounded-lg border text-[9px] bg-red-900/20 border-red-500/40 text-red-400">
                        <span className="font-bold uppercase tracking-wider flex items-center gap-1">
                          <AlertTriangle size={11}/>
                          Baje por debajo de {cotaInicial} mm para iniciar
                        </span>
                        <span className="font-mono font-black">{currentHeightMm} mm</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-yellow-400 font-bold bg-yellow-400/10 p-2 mt-1 rounded border border-yellow-400/20 text-[9px]">
                      <AlertTriangle size={12} /> ESPERANDO: Pulse INICIAR SECUENCIA
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Panel de cota — condición previa */}
                    {(cameraTestState === 'standby' || cameraTestState === 'esperando_1500') && (
                      <div className={`flex items-center justify-between p-2 mt-1 rounded-lg border text-[9px] ${
                        isCarriageBelowCota
                          ? 'bg-green-900/20 border-green-500/40 text-green-400'
                          : 'bg-red-900/20 border-red-500/40 text-red-400'
                      }`}>
                        <span className="font-bold uppercase tracking-wider flex items-center gap-1">
                          {isCarriageBelowCota ? <CheckCircle2 size={11}/> : <AlertTriangle size={11}/>}
                          {isCarriageBelowCota ? 'Listo para iniciar' : `Baje por debajo de ${cotaInicial} mm`}
                        </span>
                        <span className="font-mono font-black">{currentHeightMm} mm</span>
                      </div>
                    )}
                    <p className="text-[9px] text-logisnext-slate leading-relaxed mt-1">
                      Carga la carretilla con la capacidad indicada ({erpData.peso_pruebas} kg) y ejecuta la prueba. La cámara registrará los tiempos de ciclo.
                    </p>
                    {palletState === 'animating' && (
                      <div className="flex items-center gap-2 mt-2 py-1.5 px-2 bg-logisnext-magenta/10 border border-logisnext-magenta/30 rounded text-[9px] text-logisnext-magenta">
                        <Loader2 size={12} className="animate-spin" /> Animación de palet en curso...
                      </div>
                    )}
                    {cameraTestState === 'ok' && (
                      <div className="flex items-center justify-center gap-2 mt-2 py-2 px-3 bg-blue-500/15 border border-blue-400/50 rounded-lg animate-pulse">
                        <CheckCircle2 size={14} className="text-blue-400 shrink-0" />
                        <span className="text-[11px] font-black uppercase tracking-widest text-blue-300">Elevación Finalizada</span>
                      </div>
                    )}
                    {cameraTestState === 'nok' && (
                      <div className="flex flex-col gap-2 mt-2">
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-2 rounded text-[10px] font-bold">
                          <AlertTriangle size={12} className="inline mr-1" />
                          {testAlarm || 'Fallo de prueba de cámara con carga.'}
                        </div>
                        <div className="flex gap-2">
                          <ActionBtn onClick={handleRepetirCameraTest} variant="secondary" className="flex-1">
                            <RotateCcw size={12} /> Repetir Prueba
                          </ActionBtn>
                          <ActionBtn onClick={() => handleContinuarCameraTest(3)} variant="primary" className="flex-1">
                            Continuar <CheckCircle2 size={12} />
                          </ActionBtn>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            );
          })()}
          {(stepStatus[3] === STEP_STATUS.PENDING) && (
            <div className="flex items-center gap-1.5 text-[9px] text-logisnext-slate">
              <Lock size={10} /> Pendiente paso anterior
            </div>
          )}
          {stepStatus[3] === STEP_STATUS.OK && erpData && (
            <div className="flex flex-col gap-1">
              <DataLine label="PESO ERP" value={`${erpData.peso_pruebas ?? '—'} kg`} />
              <DataLine label="PESO PRUEBA" value={`${Math.floor((erpData.peso_pruebas ?? 0) / 250) * 250} kg ✓`} highlight />
              <DataLine label="Duración" value={formatDuration(stepDurations[3])} />
            </div>
          )}
        </StepCard>

        {/* ── PASO 5: Prueba 5 minutos (solo Mx / XL) ─────────────────────── */}
        <StepCard num={5} icon={Timer} title="Prueba 5 minutos" status={stepStatus[4]} canSkip onToggleSkip={() => toggleSkip(4)}>
          {stepStatus[4] === STEP_STATUS.ACTIVE && erpData && (
            <>
              <DataLine label="Modelo" value={erpData.modelo} highlight />
              <DataLine label="Altura mástil" value={`${erpData.altura_max_interm ?? '—'} mm`} />

              <div className="flex flex-col gap-1 border border-[#2e404a] p-2 rounded-lg bg-[#0a0f12] mt-2 mb-2">
                <DataLine label="PESO ERP" value={erpData.peso_pruebas != null ? `${erpData.peso_pruebas} kg` : '—'} highlight />
                <DataLine label="PESO PRUEBA" value={erpData.peso_pruebas != null ? `${Math.floor(erpData.peso_pruebas / 250) * 250} kg` : '—'} highlight />
                <DataLine label="CARGA ACTUAL" value={plcState?.OW_Numero_Pallets ? `${plcState.OW_Numero_Pallets * 250} kg` : '0 kg'} highlight={false} />
                {plcState?.OW_Numero_Pallets > 0 && (
                  <span className="text-[8px] text-logisnext-slate ml-auto -mt-1 mb-1 block">
                    ({plcState.OW_Numero_Pallets} pallet{plcState.OW_Numero_Pallets !== 1 ? 's' : ''} × 250kg)
                  </span>
                )}
              </div>

              {!stepStarted[4] ? (
                <div className="flex flex-col gap-2">
                  {!isCarriageBelowCota && (
                    <div className="flex items-center justify-between p-2 mt-1 rounded-lg border text-[9px] bg-red-900/20 border-red-500/40 text-red-400">
                      <span className="font-bold uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle size={11}/>
                        Baje por debajo de {cotaInicial} mm para iniciar
                      </span>
                      <span className="font-mono font-black">{currentHeightMm} mm</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-yellow-400 font-bold bg-yellow-400/10 p-2 mt-1 mb-2 rounded border border-yellow-400/20 text-[9px]">
                    <AlertTriangle size={12} /> ESPERANDO: Pulse INICIAR SECUENCIA
                  </div>
                </div>
              ) : test5mState === 'esperando_elevacion' ? (
                <div className="flex items-center justify-between p-2 mt-1 mb-2 rounded-lg border text-[9px] bg-amber-900/20 border-amber-500/40 text-amber-400">
                  <span className="font-bold uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle size={11}/>
                    {`Eleve por encima de ${cotaInicial} mm`}
                  </span>
                  <span className="font-mono font-black">{currentHeightMm} mm</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between bg-[#0a0f12] p-2 rounded-lg border border-[#2e404a] my-2">
                    <span className="text-[10px] text-logisnext-slate font-bold uppercase tracking-widest flex items-center gap-1.5">
                      Estado Prueba
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono font-bold tracking-wider" style={{
                        color: (test5mState === 'idle' || test5mState === 'esperando_elevacion') ? '#ef4444' :
                          test5mState === 'stabilizing' ? '#3b82f6' :
                            test5mState === 'running' ? '#22c55e' :
                              test5mState === 'ok' ? '#22c55e' : '#ef4444'
                      }}>
                        {test5mState === 'idle' && 'ESPERANDO INICIO'}
                        {test5mState === 'esperando_elevacion' && 'ESPERANDO: ALTURA >1.5M'}
                        {test5mState === 'stabilizing' && 'ESTABILIZANDO (3s)...'}
                        {test5mState === 'running' && 'PRUEBA EN CURSO'}
                        {test5mState === 'ok' && 'PRUEBA OK'}
                        {test5mState === 'nok' && 'PRUEBA NOK'}
                      </span>
                      <CameraLED
                        state={(test5mState === 'idle' || test5mState === 'esperando_elevacion') ? 'standby' :
                          test5mState === 'stabilizing' ? 'standby' :
                            test5mState === 'running' ? 'active' :
                              test5mState === 'ok' ? 'ok' : 'nok'}
                        blinkTick={blinkTick}
                      />
                    </div>
                  </div>

                  {test5mState === 'idle' && (
                    <p className="text-[9px] text-logisnext-slate leading-relaxed">
                      Verifique que la carga actual coincida con la requerida y eleve el mástil por encima de {cotaInicial} mm. La prueba comenzará automáticamente una vez estabilizado.
                    </p>
                  )}

                  {(test5mState === 'running' || test5mState === 'ok' || test5mState === 'nok') && (
                    <>
                      <div className={`text-center font-mono text-4xl font-black my-2 tracking-widest ${test5mState === 'nok' ? 'text-red-500' :
                          timer5min <= 30 && test5mState === 'running' ? 'text-red-400 animate-pulse' :
                            timer5min <= 60 && test5mState === 'running' ? 'text-yellow-400' :
                              'text-logisnext-magenta'
                        }`}>
                        {timer5minDisplay || '00:00'}
                      </div>
                      <div className="flex justify-between items-center bg-[#1d2930]/50 p-2 rounded border border-[#2e404a] text-[9px] mb-2">
                        <span className="text-logisnext-lightslate">Altura inicial: {stage5InitialHeightRef.current?.toFixed(0)} mm</span>
                        <span className="text-logisnext-lightslate">Tolerancia: ±{test5mConfig.tolerancia} mm</span>
                      </div>
                    </>
                  )}

                  {test5mState === 'nok' && (
                    <div className="flex flex-col gap-2 mt-2">
                      <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-2 rounded text-[10px] font-bold">
                        <AlertTriangle size={12} className="inline mr-1" />
                        {testAlarm || 'Fallo de prueba: variación de altura excedida.'}
                      </div>
                      <div className="flex gap-2">
                        <ActionBtn onClick={handleRepetir5m} variant="secondary" className="flex-1">
                          <RotateCcw size={12} /> Repetir Prueba
                        </ActionBtn>
                        <ActionBtn onClick={handleContinuar5m} variant="primary" className="flex-1">
                          Continuar <CheckCircle2 size={12} />
                        </ActionBtn>
                      </div>
                    </div>
                  )}
                </>
              )}

            </>
          )}
          {stepStatus[4] === STEP_STATUS.SKIP && (
            <p className="text-[9px] text-yellow-500/80">
              Modelo <strong>{erpData?.modelo}</strong> → no es Mx/XL. Paso omitido.
            </p>
          )}
          {stepStatus[4] === STEP_STATUS.OK && erpData && (
            <div className="flex flex-col gap-1">
              <p className="text-[9px] text-green-400">Prueba de 5 minutos superada ✓</p>
              <DataLine label="PESO ERP" value={`${erpData.peso_pruebas ?? '—'} kg`} />
              <DataLine label="PESO PRUEBA" value={`${Math.floor((erpData.peso_pruebas ?? 0) / 250) * 250} kg ✓`} highlight />
              <DataLine label="Duración" value={formatDuration(stepDurations[4])} />
            </div>
          )}
        </StepCard>

      </div>

      {/* ── PANEL DE FINALIZACIÓN ───────────────────────────────────────── */}
      {isSequenceFinished && (
        <div className="mx-4 mb-4 p-4 rounded-xl border border-green-500/50 bg-green-900/10 flex flex-col items-center animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 size={32} className="text-green-400 mb-2" />
          <p className="text-[11px] font-black text-green-400 uppercase tracking-widest mb-1 text-center">
            Secuencia Completada
          </p>
          <p className="text-[10px] text-green-300/80 uppercase tracking-wider text-center">
            Log guardado automáticamente.<br/>Vuelva al origen. Precaución: Vallas en trabajo (Baliza Roja).
          </p>
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
            <div key={i} className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${s === STEP_STATUS.OK ? 'bg-green-500' :
              s === STEP_STATUS.SKIP ? 'bg-yellow-600' :
                s === STEP_STATUS.ACTIVE ? 'bg-logisnext-magenta animate-pulse' :
                  s === STEP_STATUS.ERROR ? 'bg-red-500' :
                    'bg-[#1d2930]'
              }`} />
          ))}
        </div>
      </div>

      {/* ── Modal de Repetición ────────────────────────────────────────── */}
      {repeatModal.show && (
        <div className="fixed inset-0 bg-[#0d1a20]/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
          <div className="w-[600px] max-w-[95vw] bg-[#1d2930] rounded-xl border border-[#2e404a] shadow-[0_0_60px_rgba(0,0,0,0.6)] p-8 relative">
            <button 
              onClick={() => resetSequence()}
              className="absolute top-4 right-4 text-logisnext-slate hover:text-red-400 p-2 rounded hover:bg-[#2e404a]/50 transition-colors"
              title="Cancelar prueba"
            >
              <X size={24} />
            </button>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center text-yellow-400">
                <AlertTriangle size={32} />
              </div>
            </div>
            <h3 className="text-white text-xl font-black tracking-widest uppercase mb-2">
              Secuencia Repetida
            </h3>
            <p className="text-sm text-logisnext-slate mb-6 leading-relaxed px-4">
              El bastidor <span className="text-logisnext-magenta font-mono text-base">{erpData?.bastidor}</span> ya fue probado.<br /><br />
              Selecciona qué etapas repetir (las no superadas se marcan por defecto).
            </p>

            <div className="space-y-3 mb-8 text-left bg-[#0a0f12] p-5 rounded-lg border border-[#2e404a] mx-4">
              {[
                { label: 'Paso 2: Multiload', idx: 0, old: repeatModal.log?.ESTADO_MULTILOAD },
                { label: 'Paso 3: Sin Carga', idx: 1, old: repeatModal.log?.ESTADO_SINCARGA },
                { label: 'Paso 4: Con Carga', idx: 2, old: repeatModal.log?.ESTADO_CARGA },
                { label: 'Paso 5: Prueba 5M', idx: 3, old: repeatModal.log?.ESTADO_CARGA_5_MIN },
              ].map(item => (
                <label key={item.idx} className={`flex items-center gap-3 text-sm uppercase font-bold tracking-wider cursor-pointer p-3 rounded transition-colors ${repeatModal.selections[item.idx] ? 'bg-logisnext-magenta/10 text-white border border-logisnext-magenta/30 shadow-inner' : 'text-logisnext-slate border border-transparent hover:bg-[#1d2930]'}`}>
                  <input
                    type="checkbox"
                    checked={repeatModal.selections[item.idx]}
                    onChange={() => {
                      const newSels = [...repeatModal.selections];
                      newSels[item.idx] = !newSels[item.idx];
                      setRepeatModal(prev => ({ ...prev, selections: newSels }));
                    }}
                    className="accent-logisnext-magenta w-5 h-5 cursor-pointer"
                  />
                  {item.label}
                  <span className={`ml-auto text-xs font-mono px-2 py-1 rounded ${item.old === 'OK' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                    {item.old || 'PEND'}
                  </span>
                </label>
              ))}
            </div>

            <ActionBtn 
              onClick={handleRepeatConfirm} 
              variant="primary" 
              disabled={!repeatModal.selections.some(Boolean)}
              className="py-4 text-base w-64 mx-auto font-black shadow-[0_0_20px_rgba(221,40,118,0.4)] hover:shadow-[0_0_30px_rgba(221,40,118,0.6)] disabled:shadow-none"
            >
              Continuar <CheckCircle2 size={18} className="ml-2" />
            </ActionBtn>
          </div>
        </div>
      )}
      {/* ── MENSAJE FLOTANTE: INICIAR SECUENCIA ────────────────────────── */}
      {(currentStep >= 1 && currentStep <= 4 && !stepStarted[currentStep]) && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[90] pointer-events-none">
          <div className="px-10 py-6 rounded-2xl border-2 border-yellow-500/80 bg-yellow-900/80 backdrop-blur-lg shadow-[0_0_50px_rgba(234,179,8,0.5)] flex items-center gap-6 animate-pulse">
            <div className="h-6 w-6 rounded-full bg-yellow-400 shadow-[0_0_20px_rgba(234,179,8,1)]" />
            <p className="text-3xl font-black text-yellow-400 uppercase tracking-widest drop-shadow-lg">
              Pulse INICIAR SECUENCIA para continuar
            </p>
          </div>
        </div>
      )}
    </aside>
  );
};

Sequencer.displayName = 'Sequencer';

export default Sequencer;
