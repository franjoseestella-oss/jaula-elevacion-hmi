import React, { useState, useEffect, useRef, useImperativeHandle } from 'react';
import {
  Layers, Barcode, ArrowUpDown, Timer, Weight,
  CheckCircle2, AlertTriangle, SkipForward, Loader2,
  RotateCcw, Ruler, Lock, Hash, Database, XCircle, Play
} from 'lucide-react';


const API_BASE = 'http://localhost:8001';

// ─── Helpers ────────────────────────────────────────────────────────────────

const ds2s = (v) => (v != null ? `${(v / 100).toFixed(2).replace('.', ',')} s` : '—');
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
    primary: 'bg-logisnext-magenta/90 hover:bg-logisnext-magenta text-white shadow-[0_0_12px_rgba(221,40,118,0.3)]',
    secondary: 'bg-[#1d2930] hover:bg-[#2e404a] text-logisnext-lightslate border border-[#2e404a]',
    success: 'bg-green-700/80 hover:bg-green-600 text-white',
    danger: 'bg-red-700/80 hover:bg-red-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.3)]',
  };
  return (
    <button className={`${base} ${variants[variant]}`} onClick={onClick} disabled={disabled}>
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

const Sequencer = ({ erpData, onErpData, onOpenErp, palletState, setPalletState, plcState, setStep2Overlay, setTestHUDOverlay, sequencerRef, onSequenceEnd, onStepChange, operario, isSimulation }) => {
  const [stepStatus, setStepStatus] = useState([
    STEP_STATUS.ACTIVE,
    STEP_STATUS.PENDING,
    STEP_STATUS.PENDING,
    STEP_STATUS.PENDING,
    STEP_STATUS.PENDING,
  ]);
  const [stepStarted, setStepStarted] = useState([true, false, false, false, false]);
  // Timestamps (ms) de cuando cada paso empieza y termina
  const [stepStartTime, setStepStartTime] = useState([null, null, null, null, null]);
  const [stepDurations, setStepDurations] = useState([null, null, null, null, null]); // segundos
  // Posición real de la pegatina (mm)
  const [pegatinaPosicion, setPegatinaPosicion] = useState(null);
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
  const [manualDigits, setManualDigits] = useState('');    // dígitos teclados a mano
  const [timer5min, setTimer5min] = useState(null);
  const [visionOk, setVisionOk] = useState(false);
  
  // Estado para la prueba de cámara
  // Estados: 'standby' | 'esperando_1500' | 'ascenso' | 'espera_arriba' | 'descenso' | 'ok' | 'nok'
  const [cameraTestState, setCameraTestState] = useState('standby');
  const [testAlarm, setTestAlarm] = useState(null); // 'ascenso_incompleto', 'descenso_incompleto'
  const [simTimers, setSimTimers] = useState({ elev: 0, desc: 0, finishedElev: false, finishedDesc: false });
  const [waitCountdown, setWaitCountdown] = useState(null); // cuenta atrás 3-2-1 en espera_arriba

  // ── Temporizadores simulados basados en altura (window.__carriageY) ──
  useEffect(() => {
    if (!isSimulation) return;
    if (cameraTestState === 'standby') {
      setSimTimers({ elev: 0, desc: 0, finishedElev: false, finishedDesc: false });
      setWaitCountdown(null);
      setTestAlarm(null);
      return;
    }
    
    let reqId;
    let tStartElev = null;
    let tStartDesc = null;
    
    let lastH = window.__carriageY || 0;
    let lastHChangeTime = Date.now();
    let tTopReachTime = null;
    // Para detectar el cruce de 1500 mm (1.5 m) SOLO en ascenso (viniendo de abajo)
    let prevH = window.__carriageY || 0;
    // Flag: solo permite disparar si la carretilla estuvo por debajo de 1.5m en algún momento
    // Si al iniciar ya está por encima, hay que bajar primero
    let hasBeenBelow1500 = (window.__carriageY || 0) < 1.5;

    const testDist = is1mTest ? 1.0 : 2.0;

    const loop = () => {
      const h = window.__carriageY || 0;


      // ── ESTADO: esperando_1500 — detectar cruce ascendente de 1.5m ──
      if (cameraTestState === 'esperando_1500') {
        // Registrar si en algún momento bajamos por debajo de 1.5m
        if (h < 1.5) hasBeenBelow1500 = true;

        // Solo disparar si venimos de abajo (hasBeenBelow1500 = true)
        // y cruzamos 1.5m de forma ascendente (prevH < 1.5 → h >= 1.5)
        if (hasBeenBelow1500 && prevH < 1.5 && h >= 1.5) {
          setCameraTestState('ascenso');
          prevH = h;
          reqId = requestAnimationFrame(loop);
          return;
        }
        prevH = h;
        reqId = requestAnimationFrame(loop);
        return;
      }

      // Control de parada incompleta (2 segundos sin variación de cota)
      if (Math.abs(h - lastH) > 0.01) {
        lastH = h;
        lastHChangeTime = Date.now();
      }

      if (cameraTestState === 'ascenso' && h > 0.1 && h < 1.5 + testDist) {
        if (Date.now() - lastHChangeTime > 2000) {
          setTestAlarm('ascenso_incompleto');
          setCameraTestState('nok');
          return;
        }
      }

      if (cameraTestState === 'descenso' && h < 1.5 + testDist - 0.05 && h > 1.5) {
        if (Date.now() - lastHChangeTime > 2000) {
          setTestAlarm('descenso_incompleto');
          setCameraTestState('nok');
          return;
        }
      }
      


      // ── Ascenso: detectar llegada arriba ──────────────────────────────────
      if (cameraTestState === 'ascenso' && h >= 1.5 + testDist && !simTimers.finishedElev) {
        // Marcar ascenso completo y pasar a espera_arriba
        setSimTimers(prev => ({ ...prev, finishedElev: true, elev: prev.elev }));
        setCameraTestState('espera_arriba');
        setWaitCountdown(3);
        tTopReachTime = null; // resetear para que se inicialice en espera_arriba
      } else if (cameraTestState === 'ascenso') {
        // Acumular timer ascenso
        setSimTimers(prev => {
          if (prev.finishedElev) return prev;
          if (h >= 1.5) {
            if (!tStartElev) tStartElev = Date.now();
            return { ...prev, elev: Math.floor((Date.now() - tStartElev) / 10) };
          }
          return prev;
        });
      } else if (cameraTestState === 'espera_arriba') {
        if (!tTopReachTime) tTopReachTime = Date.now();

        const waited = Date.now() - tTopReachTime;

        if (waited < 3000) {
          // Antes de los 3s: si la carretilla baja, reiniciar el contador
          if (h < 1.5 + testDist - 0.05) {
            tTopReachTime = Date.now();
          }
          const remaining = Math.ceil((3000 - (Date.now() - tTopReachTime)) / 1000);
          setWaitCountdown(Math.max(1, remaining));
        } else {
          // 3 segundos completados — mostrar GO! hasta que el operario baje
          setWaitCountdown(0);
          if (h < 1.5 + testDist - 0.05) {
            setWaitCountdown(null);
            setCameraTestState('descenso');
            tStartDesc = null; // resetear para inicializar al entrar en descenso
          }
        }
      } else if (cameraTestState === 'descenso') {
        // ── Descenso completado: h vuelve a bajar de 1.5m ─────────────────
        if (h <= 1.5 && !simTimers.finishedDesc) {
          const elapsed = tStartDesc ? Math.floor((Date.now() - tStartDesc) / 10) : 0;
          // Leer tolerancias ERP
          const isSinCarga = currentStep === 2;
          const minElev = isSinCarga ? erpData?.tpo_elev_min_scarga : erpData?.tpo_elevac_min;
          const maxElev = isSinCarga ? erpData?.tpo_elev_max_scarga : erpData?.tpo_elevac_max;
          const minDesc = isSinCarga ? erpData?.tpo_desc_min_scarga : erpData?.tpo_descenso_min;
          const maxDesc = isSinCarga ? erpData?.tpo_desc_max_scarga : erpData?.tpo_descenso_max;

          // Guardar tiempo final de descenso
          setSimTimers(prev => ({ ...prev, finishedDesc: true, desc: elapsed }));

          // Evaluar OK / NOK
          const isElevOk = simTimers.elev >= minElev && simTimers.elev <= maxElev;
          const isDescOk = elapsed >= minDesc && elapsed <= maxDesc;
          setCameraTestState(isElevOk && isDescOk ? 'ok' : 'nok');
        } else if (!simTimers.finishedDesc) {
          // Acumular timer descenso
          setSimTimers(prev => {
            if (h <= 1.5 + testDist) {
              if (!tStartDesc) tStartDesc = Date.now();
              return { ...prev, desc: Math.floor((Date.now() - tStartDesc) / 10) };
            }
            return prev;
          });
        }
      }

      reqId = requestAnimationFrame(loop);
    };

    reqId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(reqId);
  }, [isSimulation, cameraTestState, erpData, currentStep]);

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
    window.addEventListener('toleranciaChanged', handleTolerancia);
    return () => window.removeEventListener('toleranciaChanged', handleTolerancia);
  }, []);

  // ── Guardar Log Global ────────────────────────────────────────────────────
  const saveLog = async (globalStatus) => {
    const startSec = stepStartTime[0] || Date.now();
    const endSec = Date.now();
    const erp = erpDataRef.current;
    const sData = stageDataRef.current;

    const logData = {
      FECHA_MONTAJE: erp?.fecha_montaje,
      NSECUENCIA: erp?.secuencia,
      NMODELO: erp?.modelo,
      NBASTIDOR: erp?.bastidor,
      NMASTIL: erp?.mastil,
      ALTURA_MAX_INTERMEDIA: erp?.altura_max_interm,
      CARGA_CONSIGNADA: erp?.capac_interm_1,
      TIEMPO_ELEVACION_MIN_SINCARGA: erp?.tpo_elev_min_scarga,
      TIEMPO_ELEVACION_MAX_SINCARGA: erp?.tpo_elev_max_scarga,
      TIEMPO_DESCENSO_MIN_SINCARGA: erp?.tpo_desc_min_scarga,
      TIEMPO_DESCENSO_MAX_SINCARGA: erp?.tpo_desc_max_scarga,
      TIEMPO_ELEVACION_MIN_CARGA: erp?.tpo_elevac_min,
      TIEMPO_ELEVACION_MAX_CARGA: erp?.tpo_elevac_max,
      TIEMPO_DESCENSO_MIN_CARGA: erp?.tpo_descenso_min,
      TIEMPO_DESCENSO_MAX_CARGA: erp?.tpo_descenso_max,

      ALTURA_CAPTADA: pegatinaPosicion,
      FECHA_HORA_INICIO_MULTILOAD: stepStartTime[1] ? new Date(stepStartTime[1]).toLocaleString() : null,
      FECHA_HORA_FIN_MULTILOAD: stepStartTime[1] && stepDurations[1] ? new Date(stepStartTime[1] + stepDurations[1]*1000).toLocaleString() : null,
      ESTADO_MULTILOAD: stepStatus[1] === STEP_STATUS.OK ? 'OK' : (stepStatus[1] === STEP_STATUS.SKIP ? 'NO APLICA' : 'NOK'),

      TIEMPO_ELEVACION_MEDIDO_SINCARGA: sData[3].elev,
      TIEMPO_DESCENSO_MEDIDO_SINCARGA: sData[3].desc,
      FECHA_HORA_INICIO_SINCARGA: stepStartTime[2] ? new Date(stepStartTime[2]).toLocaleString() : null,
      FECHA_HORA_FIN_SINCARGA: stepStartTime[2] && stepDurations[2] ? new Date(stepStartTime[2] + stepDurations[2]*1000).toLocaleString() : null,
      ESTADO_SINCARGA: stepStatus[2] === STEP_STATUS.OK ? 'OK' : (stepStatus[2] === STEP_STATUS.SKIP ? 'NO APLICA' : 'NOK'),

      TIEMPO_ELEVACION_MEDIDO_CARGA: sData[4].elev,
      TIEMPO_DESCENSO_MEDIDO_CARGA: sData[4].desc,
      FECHA_HORA_INICIO_CARGA: stepStartTime[3] ? new Date(stepStartTime[3]).toLocaleString() : null,
      FECHA_HORA_FIN_CARGA: stepStartTime[3] && stepDurations[3] ? new Date(stepStartTime[3] + stepDurations[3]*1000).toLocaleString() : null,
      ESTADO_DESCENSO_CARGA: stepStatus[3] === STEP_STATUS.OK ? 'OK' : (stepStatus[3] === STEP_STATUS.SKIP ? 'NO APLICA' : 'NOK'),
      CARGA_GET: sData[4].cargaGet,

      ALTURA_INICIAL: sData[5].altura_inicial,
      ALTURA_FINAL: sData[5].altura_final,
      DIFERENCIA_ALTURAS: sData[5].diff,
      FECHA_HORA_INICIO_5MIN: stepStartTime[4] ? new Date(stepStartTime[4]).toLocaleString() : null,
      FECHA_HORA_FIN_5MIN: stepStartTime[4] && stepDurations[4] ? new Date(stepStartTime[4] + stepDurations[4]*1000).toLocaleString() : null,
      ESTADO_CARGA_5_MIN: stepStatus[4] === STEP_STATUS.OK ? 'OK' : (stepStatus[4] === STEP_STATUS.SKIP ? 'NO APLICA' : 'NOK'),

      OK_NOK: globalStatus,
      REPETICIONES_SECUENCIA: 1,
      FECHA_HORA_INICIO_SEC: new Date(startSec).toLocaleString(),
      FECHA_HORA_FIN_SEC: new Date(endSec).toLocaleString(),
      OPERARIO: operario ? `${operario.NOMBRE || ''} ${operario.APELLIDOS || ''}`.trim() : 'Desconocido'
    };

    try {
      await fetch(`${API_BASE}/api/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData)
      });
    } catch (e) { console.error("Error guardando log global:", e); }
  };

  const resetSequence = () => {
    setStepStatus([STEP_STATUS.ACTIVE, STEP_STATUS.PENDING, STEP_STATUS.PENDING, STEP_STATUS.PENDING, STEP_STATUS.PENDING]);
    setStepStarted([true, false, false, false, false]);
    setStepStartTime([Date.now(), null, null, null, null]);
    setStepDurations([null, null, null, null, null]);
    stageDataRef.current = {
      3: { elev: null, desc: null },
      4: { elev: null, desc: null, cargaGet: null },
      5: { altura_inicial: null, altura_final: null, diff: null }
    };
    setPegatinaPosicion(null);
    setSeqInput('');
    setSeqError('');
    setScannedSeq(null);
    setManualDigits('');
    setTimer5min(null);
    setVisionOk(false);
    if (setStep2Overlay) setStep2Overlay(null);
    if (setPalletState) setPalletState('idle');
    if (onErpData) onErpData(null);
  };

  const handleAbort = async () => {
    await saveLog('NOK');
    if (onSequenceEnd) onSequenceEnd();
    resetSequence();
  };

  // ── Auto-Avanzar PASO 1 si se carga desde ERP Modal ───────────────
  useEffect(() => {
    if (erpData && stepStatus[0] === STEP_STATUS.ACTIVE) {
      setScannedSeq(null);
      setSeqError('');
      markOk(0); // Avanzar a Paso 2 (Iniciar prueba)

    }
  }, [erpData, stepStatus, plcState]);

  // ── Abortar prueba en curso si se abre la jaula ───────────────
  useEffect(() => {
    // Solo abortar si las vallas se abren en la etapa 4 o 5 (índices 3 y 4) Y la etapa ya está iniciada
    if (erpData && (currentStep === 3 || currentStep === 4) && stepStarted[currentStep]) {
      const isDownRear = plcState?.Ob_Dtec_Valla_1_trabajo_LH === true;
      const isDownFront = plcState?.Ob_Dtec_Valla_2_trabajo_RH === true;

      if (!isDownRear || !isDownFront) {
        console.warn("Seguridad Comprometida: Vallas abiertas durante el test. Abortando...");
        handleAbort();
      }
    }
  }, [plcState, erpData, currentStep, stepStarted]);

  // ── Controles de PLC (Botones físicos) ────────────────────────────────────

  // 1. Abortar secuencia
  useEffect(() => {
    if (plcState?.Ob_Abortar_Secuancia === true) {
      if (stepStatus.some(s => s !== STEP_STATUS.PENDING)) {
        console.warn("ABORTAR SECUENCIA (Pulsador PLC)");
        handleAbort();
      }
    }
  }, [plcState?.Ob_Abortar_Secuancia]);

  // 2. Iniciar Secuencia — detección robusta de flanco de subida
  const prevInciarRef = useRef(false);
  useEffect(() => {
    const curr = plcState?.Ob_Inciar_Secuencia === true;
    const risingEdge = curr && !prevInciarRef.current;
    prevInciarRef.current = curr;

    if (!risingEdge) return;

    console.log('[INICIAR] Rising edge detectado. currentStep:', currentStep, 'stepStarted:', stepStarted);

    // Si el paso actual (1-4) aún no está iniciado → desbloquearlo
    if (currentStep >= 1 && currentStep <= 4 && !stepStarted[currentStep]) {
      // Bloquear el inicio de etapas 4 y 5 si las vallas no están en trabajo
      if (currentStep === 3 || currentStep === 4) {
        const isDownRear = plcState?.Ob_Dtec_Valla_1_trabajo_LH === true;
        const isDownFront = plcState?.Ob_Dtec_Valla_2_trabajo_RH === true;
        if (!isDownRear || !isDownFront) {
          console.warn("[INICIAR] Bloqueado: Vallas no en posición para etapa", currentStep);
          return;
        }
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
        // NOK: REPETIR — reiniciar la prueba desde 'esperando_1500'
        if (cameraTestState === 'nok') {
          setCameraTestState('esperando_1500');
          setTestAlarm(null);
          setSimTimers({ tStart: null, tEndElev: null, tStartDesc: null, tEndDesc: null, finishedElev: false, finishedDesc: false });
          setWaitCountdown(null);
          return;
        }
        if (isSimulation && cameraTestState === 'standby') {
          setCameraTestState('ascenso');
        } else if (!isSimulation || cameraTestState === 'ok') {
          markOk(2);
        }
      } else if (stepStatus[3] === STEP_STATUS.ACTIVE && palletState !== 'animating') {
        // NOK: REPETIR — reiniciar la prueba desde 'esperando_1500'
        if (cameraTestState === 'nok') {
          setCameraTestState('esperando_1500');
          setTestAlarm(null);
          setSimTimers({ tStart: null, tEndElev: null, tStartDesc: null, tEndDesc: null, finishedElev: false, finishedDesc: false });
          setWaitCountdown(null);
          return;
        }
        if (isSimulation && cameraTestState === 'standby') {
          setCameraTestState('ascenso');
        } else if (!isSimulation || cameraTestState === 'ok') {
          markOk(3);
        }
      } else if (stepStatus[4] === STEP_STATUS.ACTIVE) {
        if (timer5min === 0) {
          markOk(4);
        } else if (timer5min === null && visionOk) {
          startTimer5min();
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plcState?.Ob_Inciar_Secuencia]);

  // 3. Pegatina Colocada -> avanzar en Paso 2
  useEffect(() => {
    if (plcState?.Ob_Pegatina_Colocada === true && stepStatus[1] === STEP_STATUS.ACTIVE && erpData && stepStarted[1]) {
      const altura = erpData.altura_max_interm;
      const act = plcState?.OW_Altura_Elevacion || 0;
      const posOk = act >= (altura - tolerancias.negativa) && act <= (altura + tolerancias.positiva);

      if (posOk) {
        markOk(1);
      }
    }
  }, [plcState?.Ob_Pegatina_Colocada, stepStatus[1], erpData, tolerancias]);

  // 3b. Pegatina Colocada con resultado NOK → CONTINUAR (avanzar paso sin repetir)
  useEffect(() => {
    if (plcState?.Ob_Pegatina_Colocada !== true) return;
    if (cameraTestState !== 'nok') return;
    const activeTestStep = stepStatus[2] === STEP_STATUS.ACTIVE ? 2
      : stepStatus[3] === STEP_STATUS.ACTIVE ? 3 : null;
    if (activeTestStep === null) return;
    // Avanzar al siguiente paso (marcar NOK y continuar)
    markOk(activeTestStep);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plcState?.Ob_Pegatina_Colocada]);

  // ── Overlay Datos Multiload (Paso 2) ───────────────────────────────────────
  useEffect(() => {
    if (currentStep === 1 && erpData && stepStarted[1]) {
      const alturaMax = erpData.altura_max_interm;
      const actual = plcState?.OW_Altura_Elevacion || 0;
      const min = alturaMax - tolerancias.negativa;
      const max = alturaMax + tolerancias.positiva;
      const isOk = actual >= min && actual <= max;

      if (setStep2Overlay) {
        setStep2Overlay({
          active: true,
          actual,
          min,
          max,
          isOk
        });
      }
    } else {
      if (setStep2Overlay) setStep2Overlay(null);
    }
  }, [currentStep, erpData, plcState?.OW_Altura_Elevacion, tolerancias, setStep2Overlay]);

  // ── Luces LED de Torre ─────────────────────────────────
  useEffect(() => {
    let luzAzul = false;
    let luzVerde = false;
    let luzRoja = false;

    if (!erpData) {
      // Sin iniciar prueba -> Azul
      luzAzul = true;
    } else {
      if (currentStep >= 1 && currentStep <= 4) {
        if (!stepStarted[currentStep]) {
          // Etapa no iniciada explícitamente -> Azul
          luzAzul = true;
        } else {
          // Etapa iniciada
          if (currentStep === 1) { // Paso 2: Multiload
            const altura = erpData?.altura_max_interm || 0;
            const act = plcState?.OW_Altura_Elevacion || 0;
            const posOk = act >= (altura - tolerancias.negativa) && act <= (altura + tolerancias.positiva);
            
            if (posOk) {
              luzVerde = blinkTick;
            } else {
              luzRoja = blinkTick;
            }
          } else if (currentStep === 2 || currentStep === 3) { // Tests de elevación
            if (cameraTestState === 'standby' || cameraTestState === 'esperando_1500') {
               // Condiciones iniciales NO cumplidas → Rojo parpadeante
               luzRoja = blinkTick;
            }
            else if (cameraTestState === 'ascenso' || cameraTestState === 'espera_arriba' || cameraTestState === 'descenso') {
               // Prueba en curso → Verde parpadeante
               luzVerde = blinkTick;
            }
            else if (cameraTestState === 'ok') {
               // Prueba superada → Verde fijo
               luzVerde = true;
            }
            else if (cameraTestState === 'nok') {
               // Prueba fallida → Rojo fijo
               luzRoja = true;
            }
          }
          // Para etapas 4,5 se podrían añadir lógicas similares si fuera necesario.
        }
      } else if (currentStep === 0) {
        luzAzul = true;
      }
    }

    const updateLed = async () => {
      try {
        await fetch(`${API_BASE}/plc/write`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            Ob_LUZ_AZUL: luzAzul,
            Ob_LUZ_VERDE: luzVerde,
            Ob_LUZ_ROJA: luzRoja
          })
        });
      } catch (e) { console.error("Error setting LEDs:", e); }
    };

    updateLed();
  }, [currentStep, stepStarted, erpData, plcState?.OW_Altura_Elevacion, tolerancias, blinkTick, cameraTestState, isSimulation]);

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
  useEffect(() => {
    if (plcState?.Ob_Repetir_Secuencia === true) {
      if (stepStatus[1] === STEP_STATUS.ACTIVE && palletState !== 'animating') {
        markOk(1);
      }
    }
  }, [plcState?.Ob_Repetir_Secuencia]);

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
    if (setStep2Overlay) setStep2Overlay(null);
    
    // Guardar telemetría de fin de etapa según índice
    const pState = plcStateRef.current;
    if (idx === 2) { // Fin Etapa 3 (Sin Carga)
      stageDataRef.current[3] = { elev: pState?.OW_Tiempo_Elevacion, desc: pState?.OW_Tiempo_Descenso };
    } else if (idx === 3) { // Fin Etapa 4 (Con Carga)
      stageDataRef.current[4] = { 
        elev: pState?.OW_Tiempo_Elevacion, 
        desc: pState?.OW_Tiempo_Descenso, 
        cargaGet: pState?.Ob_Palets_Carga ? pState.Ob_Palets_Carga * 250 : null 
      };
    } else if (idx === 4) { // Fin Etapa 5 (5 min)
      stageDataRef.current[5].altura_final = pState?.OW_Altura_Elevacion;
      stageDataRef.current[5].diff = Math.abs((stageDataRef.current[5].altura_inicial || 0) - (pState?.OW_Altura_Elevacion || 0));
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
  const toleranciasRef = useRef(tolerancias);
  const plcStateRef = useRef(plcState);
  useEffect(() => { stepStatusRef.current = stepStatus; }, [stepStatus]);
  useEffect(() => { stepStartedRef.current = stepStarted; }, [stepStarted]);
  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { erpDataRef.current = erpData; }, [erpData]);
  useEffect(() => { toleranciasRef.current = tolerancias; }, [tolerancias]);
  useEffect(() => { plcStateRef.current = plcState; }, [plcState]);

  // Registrar timestamp de inicio cuando un paso se activa
  useEffect(() => {
    if (currentStep >= 0 && currentStep <= 4) {
      setStepStartTime(prev => {
        const next = [...prev];
        if (!next[currentStep]) next[currentStep] = Date.now(); // solo si no se ha iniciado ya
        return next;
      });
    }
  }, [currentStep]);

  // ── Handlers directos (llamados desde botones sin pasar por WebSocket) ────────
  const handleIniciarSecuenciaDirecto = () => {
    const step = currentStepRef.current;
    const started = stepStartedRef.current;
    const statuses = stepStatusRef.current;
    const pState = plcStateRef.current;
    console.log('[DIRECTO] Iniciar Secuencia. step:', step, 'started:', started);

    if (step >= 1 && step <= 4 && !started[step]) {
      // Bloquear el inicio de etapas 4 y 5 si las vallas no están en trabajo
      if (step === 3 || step === 4) {
        const isDownRear = pState?.Ob_Dtec_Valla_1_trabajo_LH === true;
        const isDownFront = pState?.Ob_Dtec_Valla_2_trabajo_RH === true;
        if (!isDownRear || !isDownFront) {
          console.warn("[DIRECTO] Bloqueado: Vallas no en posición para etapa", step);
          return;
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
        if (isSimulation && cameraTestState === 'standby') setCameraTestState('esperando_1500');
        else if (!isSimulation || cameraTestState === 'ok') markOk(2);
      } else if (statuses[3] === STEP_STATUS.ACTIVE && pState?.palletState !== 'animating') {
        if (isSimulation && cameraTestState === 'standby') setCameraTestState('esperando_1500');
        else if (!isSimulation || cameraTestState === 'ok') markOk(3);
      } else if (statuses[4] === STEP_STATUS.ACTIVE) {
        if (timer5min === 0) markOk(4);
        else if (timer5min === null && visionOk) startTimer5min?.();
      }
    }
  };

  const handlePegatinaDireto = () => {
    const started = stepStartedRef.current;
    const statuses = stepStatusRef.current;
    const erp = erpDataRef.current;
    const tols = toleranciasRef.current;
    const pState = plcStateRef.current;

    if (statuses[1] === STEP_STATUS.ACTIVE && erp && started[1]) {
      const altura = erp.altura_max_interm;
      const act = pState?.OW_Altura_Elevacion || 0;
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
  }));


  // ── PASO 1A: El lector envía el código → extraer dígitos → mostrar confirmación
  const handleLeerSecuencia = () => {
    const raw = seqInput.trim();
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
      const res = await fetch(`${API_BASE}/erp/secuencia/${encodeURIComponent(scannedSeq.digits)}`);
      const data = await res.json();
      if (res.ok) {
        onErpData(data);
        setScannedSeq(null);
        // El useEffect de arriba se encargará de llamar a markOk(0) cuando las vallas estén abajo.
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
      } else if (palletState === 'idle') {
        setPalletState('animating');
      }
    }
  }, [currentStep, stepStatus, erpData, palletState, setPalletState]);

  // ── PASO 3: Test sin carga — preparar estado inicial ────────────
  useEffect(() => {
    if (currentStep === 2 && stepStatus[2] === STEP_STATUS.ACTIVE && erpData) {
      if (isSimulation) {
        // Bajar la carga abajo automáticamente para iniciar la prueba
        fetch(`${API_BASE}/plc/write`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ OW_Altura_Elevacion: 0 })
        }).catch(console.error);
        
        // Reset camera state for this new step
        setCameraTestState('standby');
      }
    }
  }, [currentStep, stepStatus, erpData, isSimulation]);

  // ── PASO 4: Test con carga ────────────────────────────────────────────
  useEffect(() => {
    if (currentStep === 3 && stepStatus[3] === STEP_STATUS.ACTIVE && erpData) {
      if (isSimulation) {
        // Recoger la carga
        if (palletState === 'idle') setPalletState('animating');
        setCameraTestState('standby');
      }
    }
  }, [currentStep, stepStatus, erpData, isSimulation, palletState, setPalletState]);



  // ── Sincronizar overlay de HUD ───────────────────────────────────────────
  useEffect(() => {
    if (setTestHUDOverlay) {
      if ((currentStep === 2 || currentStep === 3) && stepStatus[currentStep] === STEP_STATUS.ACTIVE && erpData) {
        let ledState = 'standby';
        const elevMeters = isSimulation ? (window.__carriageY || 0) : (plcState?.OW_Altura_Elevacion || 0) / 1000;
        
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

        // Solo mostrar tiempos si el test ya está en marcha (no antes de condición inicial)
        const testIsRunning = ['ascenso', 'espera_arriba', 'descenso', 'ok', 'nok'].includes(cameraTestState);
        const rawElev = isSimulation ? simTimers.elev : (plcState?.OW_Tiempo_Elevacion || 0);
        const rawDesc = isSimulation ? simTimers.desc : (plcState?.OW_Tiempo_Descenso || 0);
        const realElev = testIsRunning ? rawElev : null;
        const realDesc = testIsRunning ? rawDesc : null;

        setTestHUDOverlay({
          title: isSinCarga ? 'TEST SIN CARGA' : 'TEST CON CARGA',
          subtitle: `PRUEBA ${is1mTest ? '1m' : '2m'}${!isSinCarga ? ` | ${erpData.capac_interm_1 ?? '—'} kg` : ''}`,
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
          testAlarm
        });
      } else {
        setTestHUDOverlay(null);
      }
    }
  }, [currentStep, stepStatus, erpData, cameraTestState, waitCountdown, plcState?.OW_Tiempo_Elevacion, plcState?.OW_Tiempo_Descenso, setTestHUDOverlay, isSimulation, simTimers]);

  // ── PASO 5: 5 minutos — decidir automáticamente al entrar ─────────────────
  useEffect(() => {
    if (currentStep === 4 && stepStatus[4] === STEP_STATUS.ACTIVE && erpData) {
      if (!isMxXL(erpData.modelo)) {
        setTimeout(() => toggleSkip(4), 600);
      }
    }
  }, [currentStep, stepStatus, erpData]);

  // ── Etapa 5: Start Timer 5 min ────────────────────────────────────────────
  const startTimer5min = () => {
    setTimer5min(300); // 5 minutos
    // Capturamos altura inicial al empezar la etapa 5
    stageDataRef.current[4] = { altura_inicial: plcStateRef.current?.OW_Altura_Elevacion };
  };

  // ── Timer 5 minutos ───────────────────────────────────────────────────────
  useEffect(() => {
    if (timer5min === null) return;
    if (timer5min <= 0) { setTimer5min(0); return; }
    const t = setTimeout(() => setTimer5min(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [timer5min]);

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

        {/* Banner de seguridad: Vallas no en posición */}
        {(erpData && (currentStep === 3 || currentStep === 4) && (!plcState?.Ob_Dtec_Valla_1_trabajo_LH || !plcState?.Ob_Dtec_Valla_2_trabajo_RH)) && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-3 py-2 rounded-lg flex items-center justify-center gap-2 font-black tracking-widest text-xs shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <AlertTriangle size={16} className="text-red-500" />
            VALLAS NO EN POSICIÓN
          </div>
        )}

        {/* ── PASO 1: Leer código de barras / secuencia ────────────────────── */}
        <StepCard num={1} icon={Barcode} title="Identificar carretilla" status={stepStatus[0]}>
          {stepStatus[0] === STEP_STATUS.ACTIVE && (
            <>
              {/* ── Selector de modo ── */}
              {!scannedSeq && !seqLoading && (
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
            const alturaAct = plcState?.OW_Altura_Elevacion || 0;
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
                      Posiciona el mástil a la altura indicada dentro de la tolerancia. Confirma con "Pegatina Colocada" cuando esté en posición.
                    </p>
                    {palletState === 'animating' && (
                      <div className="flex items-center gap-2 mt-2 py-1.5 px-2 bg-logisnext-magenta/10 border border-logisnext-magenta/30 rounded text-[9px] text-logisnext-magenta">
                        <Loader2 size={12} className="animate-spin" /> Animación de recogida del palet en curso...
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
            
            const realElev = isSimulation ? simTimers.elev : plcState?.OW_Tiempo_Elevacion;
            const realDesc = isSimulation ? simTimers.desc : plcState?.OW_Tiempo_Descenso;

            // Derivación del estado del LED
            let ledState = 'standby';
            if (cameraTestState === 'standby') {
               const actualElev = isSimulation ? (window.__carriageY || 0) : (plcState?.OW_Altura_Elevacion || 0);
               const isAtBottom = isSimulation ? (actualElev <= 0.1) : (actualElev <= 50);
               ledState = isAtBottom ? 'standby-ok' : 'standby';
            }
            else if (cameraTestState === 'ascenso') {
               const actualElev = isSimulation ? (window.__carriageY || 0) : (plcState?.OW_Altura_Elevacion || 0);
               const isTiming = isSimulation ? (actualElev >= 1.5) : (actualElev >= 1500);
               ledState = isTiming ? 'active' : 'standby';
            }
            else if (cameraTestState === 'espera_arriba' || cameraTestState === 'descenso') {
               ledState = 'active';
            }
            else if (cameraTestState === 'ok') ledState = 'ok';
            else if (cameraTestState === 'nok') ledState = 'nok';

            return (
              <>
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
                        {cameraTestState === 'ok' && 'PRUEBA OK'}
                        {cameraTestState === 'nok' && 'PRUEBA NOK'}
                      </span>
                      <CameraLED state={ledState} blinkTick={blinkTick} />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="bg-[#1d2930]/50 p-2 rounded border border-[#2e404a]">
                    <span className="text-[8px] text-logisnext-slate uppercase tracking-widest block mb-1">Ascenso (s)</span>
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-mono font-black text-white">{ds2s(realElev)}</span>
                      <span className="text-[8px] font-mono text-gray-500">[{ds2s(minElev)} - {ds2s(maxElev)}]</span>
                    </div>
                  </div>
                  <div className="bg-[#1d2930]/50 p-2 rounded border border-[#2e404a]">
                    <span className="text-[8px] text-logisnext-slate uppercase tracking-widest block mb-1">Descenso (s)</span>
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-mono font-black text-white">{ds2s(realDesc)}</span>
                      <span className="text-[8px] font-mono text-gray-500">[{ds2s(minDesc)} - {ds2s(maxDesc)}]</span>
                    </div>
                  </div>
                </div>

                {!stepStarted[2] ? (
                  <div className="flex items-center gap-2 text-yellow-400 font-bold bg-yellow-400/10 p-2 mt-1 rounded border border-yellow-400/20 text-[9px]">
                    <AlertTriangle size={12} /> ESPERANDO: Pulse INICIAR SECUENCIA
                  </div>
                ) : (
                  <>
                    <p className="text-[9px] text-logisnext-slate leading-relaxed mt-1">
                      Retira la carga y ejecuta la prueba. La cámara registrará los tiempos de ciclo.
                    </p>
                    {palletState === 'animating' && (
                      <div className="flex items-center gap-2 mt-2 py-1.5 px-2 bg-logisnext-magenta/10 border border-logisnext-magenta/30 rounded text-[9px] text-logisnext-magenta">
                        <Loader2 size={12} className="animate-spin" /> Animación de recogida del palet en curso...
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
          {stepStatus[3] === STEP_STATUS.ACTIVE && erpData && (
            <>
              <DataLine label="Carga ref." value={erpData.capac_interm_1 != null ? `${erpData.capac_interm_1} kg` : '—'} highlight />
              <DataLine label="Elevac. min" value={ds2s(erpData.tpo_elevac_min)} />
              <DataLine label="Elevac. max" value={ds2s(erpData.tpo_elevac_max)} />
              <DataLine label="Descenso min" value={ds2s(erpData.tpo_descenso_min)} />
              <DataLine label="Descenso max" value={ds2s(erpData.tpo_descenso_max)} />
              {!stepStarted[3] ? (
                <div className="flex items-center gap-2 text-yellow-400 font-bold bg-yellow-400/10 p-2 mt-1 rounded border border-yellow-400/20 text-[9px]">
                  <AlertTriangle size={12} /> ESPERANDO: Pulse INICIAR SECUENCIA
                </div>
              ) : (
                <>
                  <p className="text-[9px] text-logisnext-slate leading-relaxed mt-1">
                    Carga la carretilla con la capacidad indicada y ejecuta ciclos de elevación y descenso dentro de los tiempos de tolerancia.
                  </p>
                  {!isSimulation && (
                    <ActionBtn onClick={() => markOk(3)} variant="primary">
                      <CheckCircle2 size={12} /> Test con carga OK
                    </ActionBtn>
                  )}
                  {isSimulation && cameraTestState === 'nok' && (
                    <div className="mt-3 flex flex-col gap-2 p-2 bg-red-900/10 border border-red-500/30 rounded-lg">
                      <span className="text-[10px] font-black text-red-400 text-center uppercase tracking-widest">
                        {testAlarm ? (testAlarm === 'ascenso_incompleto' ? 'ASCENSO INCOMPLETO' : 'DESCENSO INCOMPLETO') : 'RESULTADO FUERA DE TOLERANCIA'}
                      </span>
                      <div className="flex gap-2">
                        <ActionBtn onClick={() => { setCameraTestState('standby'); setTestAlarm(null); }} variant="secondary">
                          <RotateCcw size={12} /> REPETIR (SI)
                        </ActionBtn>
                        {!testAlarm && (
                          <ActionBtn onClick={() => markOk(3)} variant="danger">
                            <SkipForward size={12} /> FORZAR OK
                          </ActionBtn>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {(stepStatus[3] === STEP_STATUS.PENDING) && (
            <div className="flex items-center gap-1.5 text-[9px] text-logisnext-slate">
              <Lock size={10} /> Pendiente paso anterior
            </div>
          )}
          {stepStatus[3] === STEP_STATUS.OK && erpData && (
            <div className="flex flex-col gap-1">
              <DataLine label="Carga" value={`${erpData.capac_interm_1 ?? '—'} kg ✓`} highlight />
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

              {!stepStarted[4] ? (
                <div className="flex items-center gap-2 text-yellow-400 font-bold bg-yellow-400/10 p-2 mt-1 mb-2 rounded border border-yellow-400/20 text-[9px]">
                  <AlertTriangle size={12} /> ESPERANDO: Pulse INICIAR SECUENCIA
                </div>
              ) : timer5minDisplay === null ? (
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
                    <ActionBtn onClick={() => markOk(4)} variant="success">
                      <CheckCircle2 size={12} /> Prueba completada
                    </ActionBtn>
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
          {stepStatus[4] === STEP_STATUS.OK && (
            <div className="flex flex-col gap-1">
              <p className="text-[9px] text-green-400">Prueba de 5 minutos superada ✓</p>
              <DataLine label="Duración" value={formatDuration(stepDurations[4])} />
            </div>
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
              saveLog('OK');
              if (onSequenceEnd) onSequenceEnd();
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
            <div key={i} className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${s === STEP_STATUS.OK ? 'bg-green-500' :
                s === STEP_STATUS.SKIP ? 'bg-yellow-600' :
                  s === STEP_STATUS.ACTIVE ? 'bg-logisnext-magenta animate-pulse' :
                    s === STEP_STATUS.ERROR ? 'bg-red-500' :
                      'bg-[#1d2930]'
              }`} />
          ))}
        </div>
      </div>
    </aside>
  );
};

Sequencer.displayName = 'Sequencer';

export default Sequencer;
