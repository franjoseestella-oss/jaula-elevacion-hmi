import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Cpu,
  TestTube,
  Network,
  Activity,
  Lightbulb,
  Zap,
  Play,
  CheckCircle2,
  PowerOff,
  RefreshCw,
  Settings,
  Database,
  Link as LinkIcon,
  Save,
  AlertTriangle,
} from "lucide-react";
const PROJECT_VARS = [
  "Ob_Poner_Pegatina",
  "Ob_Iniciar_Secuencia",
  "Ob_Abortar_Secuencia",
  "Ib_LUZ_Pulsador_1",
  "Ib_LUZ_Pulsador_2",
  "Ib_LUZ_VERDE",
  "Ib_LUZ_AZUL",
  "Ib_LUZ_ROJA",
  "OW_Numero_Pallets",
  "Ob_Bit_VIDA_PLC_APP",
  "Ib_Bit_VIDA_APP_PLC",
  "OR_Altura_Carretilla",
  "Ob_Dtec_Valla_1_trabajo_LH",
  "Ob_Dtec_Valla_2_trabajo_RH",
  "Ob_Estado_Automatico",
];

const PROJECT_VAR_LABELS = {
  Ob_Poner_Pegatina: "Poner Pegatina",
  Ob_Iniciar_Secuencia: "Iniciar Secuencia",
  Ob_Abortar_Secuencia: "Abortar Secuencia",
  Ib_LUZ_Pulsador_1: "Luz Pulsador 1",
  Ib_LUZ_Pulsador_2: "Luz Pulsador 2",
  Ib_LUZ_VERDE: "Baliza Verde",
  Ib_LUZ_AZUL: "Baliza Azul",
  Ib_LUZ_ROJA: "Baliza Roja",
  OW_Numero_Pallets: "Número de Pallets",
  Ob_Bit_VIDA_PLC_APP: "Bit Vida (PLC → APP)",
  Ib_Bit_VIDA_APP_PLC: "Bit Vida (APP → PLC)",
  OR_Altura_Carretilla: "Láser Altura Elevación",
  Ob_Dtec_Valla_1_trabajo_LH: "Detector Valla 1 Trabajo (LH)",
  Ob_Dtec_Valla_2_trabajo_RH: "Detector Valla 2 Trabajo (RH)",
  Ob_Estado_Automatico: "Estado Automático (Auto/Manual)",
};

const PROJECT_VAR_DEFAULT_DIR = {
  Ob_Poner_Pegatina: "OUT",
  Ob_Iniciar_Secuencia: "OUT",
  Ob_Abortar_Secuencia: "OUT",
  Ib_LUZ_Pulsador_1: "IN",
  Ib_LUZ_Pulsador_2: "IN",
  Ib_LUZ_VERDE: "OUT",
  Ib_LUZ_AZUL: "OUT",
  Ib_LUZ_ROJA: "OUT",
  OW_Numero_Pallets: "OUT",
  Ob_Bit_VIDA_PLC_APP: "OUT",
  Ib_Bit_VIDA_APP_PLC: "IN",
  OR_Altura_Carretilla: "OUT",
  Ob_Dtec_Valla_1_trabajo_LH: "OUT",
  Ob_Dtec_Valla_2_trabajo_RH: "OUT",
  Ob_Estado_Automatico: "OUT",
  Ob_Subir_Vallas: "OUT",
  Ob_Bajar_Vallas: "OUT",
};

const PlcModal = ({
  open,
  onClose,
  telemetry,
  isSimulation,
  setIsSimulation,
  pulsePlc,
}) => {
  const [outputs, setOutputs] = useState({
    Ib_LUZ_VERDE: false,
    Ib_LUZ_AZUL: false,
    Ib_LUZ_ROJA: false,
    Ib_LUZ_Pulsador_1: false,
    Ib_LUZ_Pulsador_2: false,
    Ib_Bit_VIDA_APP_PLC: false,
    Ob_Subir_Vallas: false,
    Ob_Bajar_Vallas: false,
  });
  const [analogs, setAnalogs] = useState({
    OR_Altura_Carretilla: 0,
    OW_Numero_Pallets: 0,
  });

  const [forceMode, setForceMode] = useState(false);
  const [latencyHistory, setLatencyHistory] = useState(Array(30).fill(0));

  const latencyRef = useRef(0);

  useEffect(() => {
    latencyRef.current = telemetry?.opcua_latency_ms || 0;
  }, [telemetry?.opcua_latency_ms]);

  useEffect(() => {
    if (telemetry?.opcua_connected) {
      const interval = setInterval(() => {
        setLatencyHistory((prev) => {
          // Añadimos un ruido visual mínimo (0.5 - 2ms) para que la línea se vea viva incluso si la latencia es 0
          const visualLatency = latencyRef.current + (Math.random() * 1.5 + 0.5);
          const next = [...prev, visualLatency];
          if (next.length > 50) next.shift(); // Aumentamos a 50 para que sea más fluida la línea
          return next;
        });
      }, 200); // 200ms refresh para una animación fluida
      return () => clearInterval(interval);
    }
  }, [telemetry?.opcua_connected]);

  const [plcConfig, setPlcConfig] = useState(() => {
    const saved = localStorage.getItem("plcConfig");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      ip: "192.168.1.1",
      port: "4840",
      dbName: "DB_App",
      namespace: "4",
    };
  });

  
  const [alarmConfig, setAlarmConfig] = useState(() => {
    const saved = localStorage.getItem("plcAlarmConfig");
    return saved ? JSON.parse(saved) : { in: [], out: [] };
  });

  const saveAlarmConfig = (newConfig) => {
    setAlarmConfig(newConfig);
    localStorage.setItem("plcAlarmConfig", JSON.stringify(newConfig));
    window.dispatchEvent(new Event("plcAlarmConfigUpdated"));
  };

  const addInAlarm = () => {
    saveAlarmConfig({
      ...alarmConfig,
      in: [...(alarmConfig.in || []), { id: Date.now().toString(), plcVar: "", type: "Advertencia", desc: "", remedy: "" }]
    });
  };

  const addOutAlarm = () => {
    saveAlarmConfig({
      ...alarmConfig,
      out: [...(alarmConfig.out || []), { id: Date.now().toString(), projectVar: "", plcVar: "", direction: "OUT" }]
    });
  };

  const forceDirectWrite = async (plcKey, value) => {
    try {
      await fetch("http://localhost:8001/plc/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [plcKey]: value, is_force: true }),
      });
      lastWriteTime.current = Date.now();
    } catch (e) {
      console.error(e);
    }
  };

  const [varMapping, setVarMapping] = useState(() => {
    const saved = localStorage.getItem("plcVarMapping");
    return saved ? JSON.parse(saved) : {};
  });

  const updateMappingFromAppVar = (appVar, newPlcKey, direction) => {
    const newMapping = { ...varMapping };
    // Eliminar mapeo previo de esta appVar (si estaba en otra plcKey)
    Object.keys(newMapping).forEach((key) => {
      if (newMapping[key].appVar === appVar) delete newMapping[key];
    });
    if (newPlcKey) {
      newMapping[newPlcKey] = {
        appVar,
        direction: direction || PROJECT_VAR_DEFAULT_DIR[appVar] || "IN",
      };
    }
    setVarMapping(newMapping);
    localStorage.setItem("plcVarMapping", JSON.stringify(newMapping));
  };

  // También usada internamente por updateMappingFromPlcKey (compatible con localStorage existente)
  const updateMappingFromPlcKey = (plcKey, newAppVar, direction) => {
    const newMapping = { ...varMapping };
    if (newAppVar) {
      newMapping[plcKey] = {
        appVar: newAppVar,
        direction: direction || (newAppVar.startsWith("O") ? "OUT" : "IN"),
      };
    } else {
      delete newMapping[plcKey];
    }
    setVarMapping(newMapping);
    localStorage.setItem("plcVarMapping", JSON.stringify(newMapping));
  };

  const [isScanningIPs, setIsScanningIPs] = useState(false);
  const [isScanningDBs, setIsScanningDBs] = useState(false);
  const [scanModal, setScanModal] = useState({
    isOpen: false,
    type: "",
    data: [],
  });

  const scanIPs = async () => {
    setIsScanningIPs(true);
    try {
      const res = await fetch("http://localhost:8001/plc/scan_ips", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Backend error");
      const text = await res.text();
      const data = text ? JSON.parse(text) : { ips: [] };
      setScanModal({ isOpen: true, type: "IP", data: data.ips || [] });
    } catch (e) {
      console.error(e);
      setScanModal({ isOpen: true, type: "IP", data: [], error: e.message });
    }
    setIsScanningIPs(false);
  };

  const scanDBs = async () => {
    setIsScanningDBs(true);
    try {
      const res = await fetch("http://localhost:8001/plc/browse_nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: plcConfig.ip, port: plcConfig.port }),
      });
      if (!res.ok) throw new Error("Backend error");
      const text = await res.text();
      const data = text ? JSON.parse(text) : { nodes: [] };

      if (data.error) {
        setScanModal({ isOpen: true, type: "DB", data: [], error: data.error });
      } else {
        setScanModal({ isOpen: true, type: "DB", data: data.nodes || [] });
      }
    } catch (e) {
      console.error(e);
      setScanModal({ isOpen: true, type: "DB", data: [], error: e.message });
    }
    setIsScanningDBs(false);
  };

  const lastWriteTime = React.useRef(0);

  // Sync state from backend si no estamos en modo simulación
  React.useEffect(() => {
    // Evitar parpadeos: no sincronizar la UI con la telemetría si acabamos de escribir (esperar 1 segundo)
    if (
      telemetry?.mappedPlc &&
      !isSimulation &&
      Date.now() - lastWriteTime.current > 1000
    ) {
      setOutputs((prev) => ({
        ...prev,
        Ib_LUZ_VERDE: !!telemetry.mappedPlc.Ib_LUZ_VERDE,
        Ib_LUZ_AZUL: !!telemetry.mappedPlc.Ib_LUZ_AZUL,
        Ib_LUZ_ROJA: !!telemetry.mappedPlc.Ib_LUZ_ROJA,
        Ib_LUZ_Pulsador_1: !!telemetry.mappedPlc.Ib_LUZ_Pulsador_1,
        Ib_LUZ_Pulsador_2: !!telemetry.mappedPlc.Ib_LUZ_Pulsador_2,
        Ib_Bit_VIDA_APP_PLC: !!telemetry.mappedPlc.Ib_Bit_VIDA_APP_PLC,
        Ob_Subir_Vallas: !!telemetry.mappedPlc.Ob_Subir_Vallas,
        Ob_Bajar_Vallas: !!telemetry.mappedPlc.Ob_Bajar_Vallas,
      }));
      setAnalogs({
        OR_Altura_Carretilla: telemetry.mappedPlc.OR_Altura_Carretilla || 0,
        OW_Numero_Pallets: telemetry.mappedPlc.OW_Numero_Pallets || 0,
      });
    }
  }, [telemetry?.mappedPlc, isSimulation]);

  const sendWrite = async (payload) => {
    const newPayload = {};
    let shouldSend = false;

    if (payload.is_force !== undefined) {
      newPayload.is_force = payload.is_force;
    }

    if (isSimulation) {
      // Modo simulación: enviar directamente
      Object.assign(newPayload, payload);
      shouldSend = true;
    } else {
      // Modo PLC real o Force Mode: traducir nombres de variables según el mapeo configurado
      if (payload.is_force !== undefined) {
        newPayload.is_force = payload.is_force;
      }
      Object.entries(payload).forEach(([key, value]) => {
        if (key === "is_force") return;
        const found = Object.entries(varMapping).find(
          ([k, v]) => v.appVar === key,
        );
        if (found) {
          newPayload[found[0]] = value;
          shouldSend = true;
        }
      });
    }

    if (!shouldSend) {
      console.log("Ignorando sendWrite: Variables no mapeadas al PLC.");
      return;
    }

    try {
      await fetch("http://localhost:8001/plc/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPayload),
      });
    } catch (e) {
      console.error("Error escribiendo en PLC", e);
    }
  };

  const saveConfig = async (simMode) => {
    try {
      localStorage.setItem("plcConfig", JSON.stringify(plcConfig));
      await fetch("http://localhost:8001/config/plc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...plcConfig,
          isSimulation: simMode,
        }),
      });
      console.log("Configuración PLC guardada y enviada al backend");
    } catch (e) {
      console.error("Error guardando config PLC", e);
    }
  };

  const handleToggleMode = () => {
    const nextSim = !isSimulation;
    setIsSimulation(nextSim);
    saveConfig(nextSim);
  };

  const handleToggleForceMode = async () => {
    const nextForce = !forceMode;
    setForceMode(nextForce);
    try {
      await fetch("http://localhost:8001/plc/force_mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextForce }),
      });
    } catch (e) {
      console.error("Error setting force mode", e);
    }
  };

  const getAppVarDirection = (appVar) => {
    const mappingEntry = Object.entries(varMapping).find(
      ([k, v]) => v.appVar === appVar,
    );
    return mappingEntry
      ? mappingEntry[1].direction
      : PROJECT_VAR_DEFAULT_DIR[appVar] || "IN";
  };

  const inVars = PROJECT_VARS.filter(v => getAppVarDirection(v) === "IN");
  const outVars = PROJECT_VARS.filter(v => getAppVarDirection(v) === "OUT");

  const renderVarRow = (appVar, showForce) => {
    const mappingEntry = Object.entries(varMapping).find(
      ([k, v]) => v.appVar === appVar,
    );
    const plcKey = mappingEntry ? mappingEntry[0] : "";
    const direction = mappingEntry
      ? mappingEntry[1].direction
      : PROJECT_VAR_DEFAULT_DIR[appVar] || "IN";
    const plcKeys = telemetry?.plc
      ? Object.keys(telemetry.plc).sort((a, b) =>
          a.localeCompare(b),
        )
      : [];

    let value = null;
    if (telemetry?.mappedPlc?.[appVar] !== undefined) {
      value = telemetry.mappedPlc[appVar];
    } else if (telemetry?.plc?.[appVar] !== undefined) {
      value = telemetry.plc[appVar];
    } else if (
      plcKey &&
      telemetry?.plc?.[plcKey] !== undefined
    ) {
      value = telemetry.plc[plcKey];
    }

    const isAnalog =
      appVar === "OR_Altura_Carretilla" ||
      appVar === "OW_Numero_Pallets";

    return (
      <tr
        key={appVar}
        className="hover:bg-[#1d2930]/50 transition-colors group border-b border-[#2e404a]/50"
      >
        <td className="p-2">
          <select
            value={direction}
            onChange={(e) =>
              updateMappingFromAppVar(
                appVar,
                plcKey,
                e.target.value,
              )
            }
            className="w-full bg-[#1d2930] border border-[#2e404a] text-white rounded p-1 text-[10px] outline-none focus:border-blue-500"
          >
            <option value="IN">IN (Lectura)</option>
            <option value="OUT">OUT (Escritura)</option>
          </select>
        </td>

        <td className="p-2">
          <span className="font-bold uppercase tracking-wide text-[10px] text-white">
            {PROJECT_VAR_LABELS[appVar]}
          </span>
        </td>

        <td className="p-2">
          <select
            value={plcKey}
            onChange={(e) =>
              updateMappingFromAppVar(
                appVar,
                e.target.value,
                direction,
              )
            }
            className="w-full bg-[#1d2930] border border-[#2e404a] text-white rounded p-1 text-[10px] outline-none focus:border-blue-500 transition-colors"
          >
            <option value="">-- Ninguna --</option>
            {plcKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          {plcKeys.length === 0 && (
            <span className="text-[9px] text-gray-600 italic block mt-1">
              Sin conexión OPC UA
            </span>
          )}
        </td>

        {showForce && (
          <td className="p-2 text-center">
            {(isSimulation ||
              (forceMode && direction === "OUT")) && (
              <button
                onClick={() => {
                  if (isAnalog) {
                    const newVal = prompt(
                      `Ingrese valor para ${appVar}`,
                      value !== null ? value : 0,
                    );
                    if (newVal !== null && !isNaN(newVal)) {
                      sendWrite({
                        [appVar]: Number(newVal),
                        is_force: true,
                      });
                      lastWriteTime.current = Date.now();
                    }
                  } else {
                    const currentValue =
                      value !== null ? !!value : false;
                    let payload = {
                      [appVar]: !currentValue,
                      is_force: true,
                    };
                    if (appVar === "Ob_Subir_Vallas")
                      payload.Ob_Bajar_Vallas = false;
                    if (appVar === "Ob_Bajar_Vallas")
                      payload.Ob_Subir_Vallas = false;
                    sendWrite(payload);
                    lastWriteTime.current = Date.now();
                  }
                }}
                className={`px-2 py-1 border rounded text-[9px] font-bold transition-colors uppercase shadow-sm ${
                  value && !isAnalog
                    ? "bg-yellow-500/20 border-yellow-500 text-yellow-400 hover:bg-yellow-500/30"
                    : "bg-[#1d2930] border-[#2e404a] text-white hover:border-yellow-500 hover:text-yellow-400"
                }`}
              >
                {isAnalog ? "Fijar" : "Toggle"}
              </button>
            )}
          </td>
        )}

        <td className="p-2 text-right font-mono font-bold">
          {typeof value === "boolean" ? (
            <div className="flex items-center justify-end gap-2">
              <span
                className={`text-xs font-black ${value ? "text-green-400" : "text-gray-400"}`}
              >
                {value ? "TRUE" : "FALSE"}
              </span>
              <div
                className={`w-2 h-2 rounded-full ${value ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.9)]" : "bg-gray-600"}`}
              />
            </div>
          ) : (
            <span className="text-xs font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1 py-0.5 rounded">
              {value !== null && value !== undefined
                ? (typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(2) : value.toString())
                : "---"}
            </span>
          )}
        </td>
      </tr>
    );
  };

  if (!open) return null;

  const renderPlcVarTag = (varName) => null;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center"
      style={{ background: "rgba(5,10,14,0.85)", backdropFilter: "blur(5px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {scanModal.isOpen && (
        <div className="absolute inset-0 z-[150] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#11191e] border border-[#2e404a] rounded-xl w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-[#2e404a] flex justify-between items-center bg-[#151f25]">
              <h3 className="text-white font-bold uppercase tracking-widest flex items-center gap-2 text-sm">
                {scanModal.type === "IP" ? (
                  <Network size={16} className="text-blue-400" />
                ) : (
                  <Database size={16} className="text-blue-400" />
                )}
                {scanModal.type === "IP"
                  ? "Dispositivos Encontrados"
                  : "Data Blocks Disponibles"}
              </h3>
              <button
                onClick={() =>
                  setScanModal({ isOpen: false, type: "", data: [] })
                }
                className="text-gray-400 hover:text-white p-1"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar">
              {scanModal.error ? (
                <div className="text-red-400 text-sm text-center py-6 flex flex-col items-center justify-center gap-2">
                  <AlertTriangle size={24} className="opacity-80" />
                  <span className="font-bold uppercase tracking-widest text-[10px]">
                    Error de Conexión
                  </span>
                  <span className="text-[10px] opacity-80 break-words w-full text-center">
                    {scanModal.error}
                  </span>
                </div>
              ) : scanModal.data.length === 0 ? (
                <div className="text-gray-500 italic text-sm text-center py-6 flex flex-col items-center justify-center gap-2">
                  <AlertTriangle size={24} className="opacity-50" />
                  <span>No se encontraron resultados.</span>
                </div>
              ) : (
                scanModal.data.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      if (scanModal.type === "IP")
                        setPlcConfig({ ...plcConfig, ip: item });
                      else setPlcConfig({ ...plcConfig, dbName: item });
                      setScanModal({ isOpen: false, type: "", data: [] });
                    }}
                    className="bg-[#1d2930] hover:bg-blue-600/20 hover:border-blue-500/50 border border-[#2e404a] p-3 rounded-lg cursor-pointer transition-colors flex items-center gap-3 group"
                  >
                    {scanModal.type === "IP" ? (
                      <Network
                        size={14}
                        className="text-gray-400 group-hover:text-blue-400 transition-colors"
                      />
                    ) : (
                      <Database
                        size={14}
                        className="text-gray-400 group-hover:text-blue-400 transition-colors"
                      />
                    )}
                    <span className="text-sm font-bold text-white group-hover:text-blue-200 transition-colors">
                      {item}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="relative w-[95vw] max-w-[1600px] max-h-[95vh] flex flex-col bg-gradient-to-b from-[#151f25] to-[#0d1a20] border border-[#2e404a] rounded-2xl shadow-[0_0_60px_rgba(34,197,94,0.15)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e404a] bg-[#1d2930]/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-logisnext-slate/20 rounded-lg border border-logisnext-slate/40">
              <Cpu size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-black text-sm uppercase tracking-widest">
                Diagnóstico & Configuración PLC
              </h2>
              <span className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">
                Monitorización, Control y OPC UA
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Modo Simulación Toggle */}
            <button
              onClick={handleToggleMode}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-black uppercase tracking-wider transition-all shadow-md ${
                isSimulation
                  ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/50 hover:bg-yellow-500/30"
                  : "bg-green-500/20 text-green-500 border-green-500/50 hover:bg-green-500/30"
              }`}
            >
              {isSimulation ? (
                <>
                  <TestTube size={16} /> Modo Simulación
                </>
              ) : (
                <>
                  <Network size={16} /> Conectado a PLC
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#2e404a] rounded-lg text-logisnext-lightslate hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar flex-1 w-full">
          <div className="grid grid-cols-12 gap-6 shrink-0">
            {/* Columna Izquierda: CONFIGURACIÓN */}
            <div className="col-span-3 flex flex-col gap-4">
              <h3 className="text-sm text-white font-bold uppercase tracking-widest border-b border-[#2e404a] pb-2 flex items-center gap-2">
                <Settings size={16} className="text-gray-400" />
                Configuración OPC UA
              </h3>

              <div className="flex flex-col gap-4 bg-[#0a0f12]/60 border border-[#2e404a] rounded-xl p-5">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">
                      IP del Servidor (PLC)
                    </label>
                    <button
                      onClick={scanIPs}
                      disabled={isScanningIPs}
                      className="text-[9px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-widest flex items-center gap-1"
                    >
                      <RefreshCw
                        size={10}
                        className={isScanningIPs ? "animate-spin" : ""}
                      />{" "}
                      {isScanningIPs ? "Buscando..." : "Escanear Red"}
                    </button>
                  </div>
                  <div className="relative">
                    <Network
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                      size={14}
                    />
                    <input
                      type="text"
                      value={plcConfig.ip}
                      onChange={(e) =>
                        setPlcConfig({ ...plcConfig, ip: e.target.value })
                      }
                      className="w-full bg-[#1d2930] border border-[#2e404a] rounded-lg py-2 pl-9 pr-3 text-xs text-white focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">
                    Puerto OPC UA
                  </label>
                  <input
                    type="text"
                    value={plcConfig.port}
                    onChange={(e) =>
                      setPlcConfig({ ...plcConfig, port: e.target.value })
                    }
                    className="w-full bg-[#1d2930] border border-[#2e404a] rounded-lg py-2 px-3 text-xs text-white focus:border-blue-500 outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">
                      Nombre Data Block (DB)
                    </label>
                    <button
                      onClick={scanDBs}
                      disabled={isScanningDBs}
                      className="text-[9px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-widest flex items-center gap-1"
                    >
                      <RefreshCw
                        size={10}
                        className={isScanningDBs ? "animate-spin" : ""}
                      />{" "}
                      {isScanningDBs ? "Consultando..." : "Buscar en PLC"}
                    </button>
                  </div>
                  <div className="relative">
                    <Database
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                      size={14}
                    />
                    <input
                      type="text"
                      value={plcConfig.dbName}
                      onChange={(e) =>
                        setPlcConfig({ ...plcConfig, dbName: e.target.value })
                      }
                      className="w-full bg-[#1d2930] border border-[#2e404a] rounded-lg py-2 pl-9 pr-3 text-xs text-white focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">
                    Namespace (ns)
                  </label>
                  <input
                    type="text"
                    value={plcConfig.namespace}
                    onChange={(e) =>
                      setPlcConfig({ ...plcConfig, namespace: e.target.value })
                    }
                    className="w-full bg-[#1d2930] border border-[#2e404a] rounded-lg py-2 px-3 text-xs text-white focus:border-blue-500 outline-none"
                  />
                </div>

                <div className="mt-4 pt-4 border-t border-[#2e404a] flex flex-col gap-2">
                  <button
                    onClick={() => saveConfig(isSimulation)}
                    className="w-full py-2 bg-[#1d2930] hover:bg-[#2e404a] text-white rounded-lg text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors border border-[#2e404a]"
                  >
                    <Save size={14} /> Guardar Configuración
                  </button>

                  {isSimulation ? (
                    <button
                      onClick={() => {
                        setIsSimulation(false);
                        saveConfig(false);
                      }}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors shadow-[0_0_15px_rgba(37,99,235,0.4)] mt-2"
                    >
                      <LinkIcon size={16} /> Conectar al PLC
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setIsSimulation(true);
                        saveConfig(true);
                      }}
                      className="w-full py-3 bg-red-600/80 hover:bg-red-500 text-white rounded-lg text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors mt-2"
                    >
                      <PowerOff size={16} /> Desconectar (Modo Simulación)
                    </button>
                  )}
                </div>

                <div className="mt-2 p-3 bg-gray-500/10 border border-gray-500/20 rounded-lg text-[10px] text-gray-400 leading-relaxed">
                  Esta configuración indica a la aplicación Python dónde
                  encontrar el Servidor OPC UA y en qué DB de Siemens se exponen
                  las variables de la máquina.
                </div>

                {!isSimulation && (
                  <div
                    className={`mt-2 p-3 border rounded-lg text-[10px] font-bold uppercase tracking-widest text-center transition-all flex flex-col gap-1 items-center ${
                      telemetry?.opcua_connected
                        ? "bg-green-500/10 border-green-500/30 text-green-400"
                        : !telemetry?.opcua_error
                          ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                          : "bg-red-500/10 border-red-500/30 text-red-400"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {telemetry?.opcua_connected ? (
                        <CheckCircle2 size={14} />
                      ) : !telemetry?.opcua_error ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <AlertTriangle size={14} />
                      )}

                      {telemetry?.opcua_connected
                        ? "OPC UA Conectado"
                        : !telemetry?.opcua_error
                          ? "Diagnosticando Conexión..."
                          : "OPC UA Desconectado"}
                    </div>
                    {telemetry?.opcua_error && (
                      <>
                        <div className="text-[8px] font-mono normal-case opacity-70 mt-1">
                          {telemetry.opcua_error}
                        </div>
                        {telemetry.opcua_error
                          .toLowerCase()
                          .includes("securit") && (
                          <div className="text-[9px] text-yellow-500/90 mt-1">
                            ⚠️ Recuerda aprobar el certificado en TIA Portal
                            (Security &gt; Certificate manager) para permitir la
                            conexión.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Columna Derecha Ampliada: TOPOLOGÍA Y VARIABLES DEL PLC */}
            <div className="col-span-9 flex flex-col gap-4">
              <h3 className="text-sm text-white font-bold uppercase tracking-widest border-b border-[#2e404a] pb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Network size={16} className="text-blue-400" />
                  Topología y Estado de Conexión
                </span>
              </h3>

              <div className="flex flex-col gap-4 flex-1 min-h-[400px]">
                <div className="flex gap-4 h-[180px] shrink-0">
                  {/* Panel de Topología */}
                  <div className="flex-1 bg-[#0a0f12]/60 border border-[#2e404a] rounded-xl p-5 flex flex-col justify-center items-center relative overflow-hidden">
                    <div
                      className={`absolute inset-0 opacity-[0.03] transition-colors duration-1000 ${telemetry?.opcua_connected ? "bg-green-500" : "bg-red-500"}`}
                    ></div>

                    <div className="flex items-center justify-center w-full max-w-2xl gap-4 z-10">
                      {/* APP Node */}
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-20 h-20 bg-[#1d2930] rounded-xl border-2 border-blue-500/50 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.15)] relative">
                          <Cpu size={32} className="text-blue-400" />
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-black text-white uppercase tracking-widest">
                            HMI App
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            localhost
                          </div>
                        </div>
                      </div>

                      {/* Connection Line */}
                      <div className="flex-1 flex flex-col items-center justify-center relative px-4">
                        <div className="w-full h-1.5 bg-[#2e404a] rounded-full relative overflow-hidden">
                          {telemetry?.opcua_connected && (
                            <div className="absolute top-0 left-0 h-full w-full bg-green-500/60 animate-[pulse_1.5s_ease-in-out_infinite]"></div>
                          )}
                        </div>
                        <div
                          className={`absolute -top-4 px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${telemetry?.opcua_connected ? "bg-green-500/20 text-green-400 border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.2)]" : "bg-red-500/20 text-red-400 border border-red-500/30"}`}
                        >
                          {telemetry?.opcua_connected
                            ? "OPC UA CONNECTED"
                            : "DISCONNECTED"}
                        </div>
                      </div>

                      {/* PLC Node */}
                      <div className="flex flex-col items-center gap-3">
                        <div
                          className={`w-20 h-20 bg-[#1d2930] rounded-xl border-2 flex items-center justify-center transition-all duration-500 relative ${telemetry?.opcua_connected ? "border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.15)]" : "border-red-500/50"}`}
                        >
                          <Database
                            size={32}
                            className={
                              telemetry?.opcua_connected
                                ? "text-green-400"
                                : "text-red-400"
                            }
                          />
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-black text-white uppercase tracking-widest">
                            S7-1200
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            {plcConfig.ip || "---"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Gráfico de Latencia */}
                  <div className="w-1/3 bg-[#0a0f12]/60 border border-[#2e404a] rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
                    <h4 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest z-10 flex justify-between items-center">
                      <span className="flex items-center gap-2"><Activity size={12}/> Latencia</span>
                      <span className={telemetry?.opcua_connected ? "text-green-400" : "text-gray-600"}>
                        {telemetry?.opcua_connected ? `${telemetry.opcua_latency_ms || "< 1"} ms` : "---"}
                      </span>
                    </h4>
                    
                    {/* SVG Sparkline */}
                    <div className="absolute inset-0 pt-10 px-0 pb-0 flex items-end">
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                        <path
                          d={`M ${latencyHistory.map((val, i) => {
                            const x = (i / (Math.max(1, latencyHistory.length - 1))) * 100;
                            const maxVal = Math.max(50, ...latencyHistory); // Al menos 50ms de escala
                            const y = 95 - (val / maxVal) * 85; // Ajustado para no tocar el borde inferior (95 en vez de 100)
                            return `${x},${y}`;
                          }).join(' L ')}`}
                          fill="none"
                          stroke={telemetry?.opcua_connected ? "#22c55e" : "#4b5563"}
                          strokeWidth="2"
                          vectorEffect="non-scaling-stroke"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d={`M 0,100 L ${latencyHistory.map((val, i) => {
                            const x = (i / (Math.max(1, latencyHistory.length - 1))) * 100;
                            const maxVal = Math.max(50, ...latencyHistory);
                            const y = 95 - (val / maxVal) * 85;
                            return `${x},${y}`;
                          }).join(' L ')} L 100,100 Z`}
                          fill="url(#latency-gradient)"
                          stroke="none"
                        />
                        <defs>
                          <linearGradient id="latency-gradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={telemetry?.opcua_connected ? "#22c55e" : "#4b5563"} stopOpacity="0.3" />
                            <stop offset="100%" stopColor={telemetry?.opcua_connected ? "#22c55e" : "#4b5563"} stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Panel de Variables Descubiertas */}
                <div className="w-full flex-1 flex flex-col bg-[#0a0f12]/60 border border-[#2e404a] rounded-xl overflow-hidden min-h-[200px]">
                  <div className="p-3 border-b border-[#2e404a] bg-[#1d2930]/40 flex items-center justify-between">
                    <h4 className="text-[11px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-2">
                      <Database size={14} /> Listado de Variables del PLC (DB)
                    </h4>
                    <span className="bg-[#2e404a] px-3 py-1 rounded text-white text-[10px] font-mono">
                      {telemetry?.plc ? Object.keys(telemetry.plc).length : 0}{" "}
                      ITEMS
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                    {telemetry?.plc && Object.keys(telemetry.plc).length > 0 ? (
                      <div className="grid grid-cols-3 gap-3">
                        {Object.keys(telemetry.plc)
                          .filter((k) => {
                            const val = telemetry.plc[k];
                            // Excluir claves o valores gigantes (ej. imágenes PNG serializadas)
                            return k.length < 60 && (typeof val !== "string" || val.length < 60);
                          })
                          .sort((a, b) => a.localeCompare(b))
                          .map((k) => {
                            const val = telemetry.plc[k];
                            return (
                              <div
                                key={k}
                                className="flex items-center justify-between p-3 bg-[#1d2930]/40 rounded-lg border border-transparent hover:border-[#2e404a] transition-all group overflow-hidden"
                              >
                                <span
                                  className="text-[11px] text-gray-300 font-mono truncate mr-2 flex-1"
                                  title={k}
                                >
                                  {k}
                                </span>
                                <span
                                  className={`text-[10px] font-mono px-2 py-1 rounded shrink-0 truncate max-w-[50%] ${
                                    typeof val === "boolean"
                                      ? val
                                        ? "bg-green-500/20 text-green-400"
                                        : "bg-gray-600/20 text-gray-400"
                                      : "bg-blue-500/20 text-blue-400"
                                  }`}
                                  title={typeof val === "string" ? val : ""}
                                >
                                  {typeof val === "boolean"
                                    ? val
                                      ? "TRUE"
                                      : "FALSE"
                                    : val}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center gap-3 opacity-50">
                        <Database size={32} className="text-gray-500" />
                        <span className="text-[12px] text-gray-400 italic">
                          Sin variables detectadas.
                          <br />
                          Verifique la conexión.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MAPEO DE VARIABLES DEL PROYECTO */}
            <div className="flex flex-col h-[450px] shrink-0 mt-2">
              <div className="flex items-center justify-between mb-3 border-b border-[#2e404a] pb-3">
                <h4 className="text-[11px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-3">
                  <Database size={16} className="text-green-400" />
                  <span>
                    Configuración de Variables — Asignar PLC a Proyecto
                  </span>
                  <span className="bg-[#2e404a]/50 px-2 py-0.5 rounded text-white text-[9px] ml-2 font-mono">
                    {Object.values(varMapping).filter((m) => m.appVar).length}/
                    {PROJECT_VARS.length} MAPEADAS
                  </span>
                </h4>

                <div className="flex items-center gap-4">
                  {isSimulation ? (
                    <div className="px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-[10px] text-yellow-300 font-bold uppercase tracking-widest flex items-center gap-2">
                      <TestTube size={14} /> Modo Simulación: Forzado Activado
                    </div>
                  ) : (
                    <button
                      onClick={handleToggleForceMode}
                      className={`px-4 py-2 rounded-lg font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 text-[10px] ${
                        forceMode
                          ? "bg-red-500/20 border border-red-500 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                          : "bg-logisnext-slate/10 border border-logisnext-slate/30 text-logisnext-lightslate hover:bg-logisnext-slate/20 hover:text-white"
                      }`}
                    >
                      <Zap
                        size={14}
                        className={forceMode ? "animate-pulse" : ""}
                      />
                      {forceMode
                        ? "Deshabilitar Forzado Manual"
                        : "Habilitar Forzado Manual"}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 flex-1 min-h-[400px] overflow-hidden">
                {/* Tabla IN */}
                <div className="bg-[#0a0f12] rounded-xl border border-[#2e404a] flex flex-col shadow-inner overflow-hidden">
                  <h4 className="bg-[#1d2930] p-2 text-center text-xs font-black tracking-widest uppercase text-blue-400 border-b border-[#2e404a]">
                    IN (Lectura PLC → APP)
                  </h4>
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-[10px] text-gray-300">
                      <thead className="bg-[#1d2930] sticky top-0 border-b border-[#2e404a] z-10 shadow-md">
                        <tr>
                          <th className="p-2 px-3 font-bold uppercase tracking-wider w-[20%]">Dirección</th>
                          <th className="p-2 px-3 font-bold uppercase tracking-wider w-[35%]">Proyecto</th>
                          <th className="p-2 px-3 font-bold uppercase tracking-wider w-[30%]">PLC DB</th>
                          <th className="p-2 px-3 font-bold uppercase tracking-wider text-right w-[15%]">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2e404a]/50">
                        {inVars.map((appVar) => renderVarRow(appVar, false))}
                        {inVars.length === 0 && (
                          <tr>
                            <td colSpan="4" className="text-center p-4 text-gray-500 italic">No hay variables IN mapeadas.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tabla OUT */}
                <div className="bg-[#0a0f12] rounded-xl border border-[#2e404a] flex flex-col shadow-inner overflow-hidden">
                  <h4 className="bg-[#1d2930] p-2 text-center text-xs font-black tracking-widest uppercase text-green-400 border-b border-[#2e404a]">
                    OUT (Escritura APP → PLC)
                  </h4>
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-[10px] text-gray-300">
                      <thead className="bg-[#1d2930] sticky top-0 border-b border-[#2e404a] z-10 shadow-md">
                        <tr>
                          <th className="p-2 px-3 font-bold uppercase tracking-wider w-[15%]">Dirección</th>
                          <th className="p-2 px-3 font-bold uppercase tracking-wider w-[30%]">Proyecto</th>
                          <th className="p-2 px-3 font-bold uppercase tracking-wider w-[25%]">PLC DB</th>
                          <th className="p-2 px-3 font-bold uppercase tracking-wider text-center w-[15%]">Forzar</th>
                          <th className="p-2 px-3 font-bold uppercase tracking-wider text-right w-[15%]">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2e404a]/50">
                        {outVars.map((appVar) => renderVarRow(appVar, true))}
                        {outVars.length === 0 && (
                          <tr>
                            <td colSpan="5" className="text-center p-4 text-gray-500 italic">No hay variables OUT mapeadas.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

          {/* ALARMAS */}
          <div className="flex flex-col shrink-0 mt-6 mb-4">
            <div className="flex items-center justify-between mb-3 border-b border-[#2e404a] pb-3">
              <h4 className="text-[11px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-3">
                <AlertTriangle size={16} className="text-yellow-400" />
                <span>Configuración de Alarmas</span>
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden min-h-[400px]">
              {/* Tabla IN ALARMAS */}
              <div className="bg-[#0a0f12] rounded-xl border border-[#2e404a] flex flex-col shadow-inner overflow-hidden">
                <div className="bg-[#1d2930] p-2 flex justify-between items-center border-b border-[#2e404a]">
                  <h4 className="text-xs font-black tracking-widest uppercase text-yellow-400">
                    IN ALARMAS (Lectura PLC → APP)
                  </h4>
                  <button onClick={addInAlarm} className="bg-[#2e404a] hover:bg-yellow-500 hover:text-black text-white text-[9px] px-2 py-1 rounded font-bold uppercase transition-colors">
                    + Añadir
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-[10px] text-gray-300">
                    <thead className="bg-[#1d2930] sticky top-0 border-b border-[#2e404a] z-10 shadow-md">
                      <tr>
                        <th className="p-2 px-3 font-bold uppercase tracking-wider w-[20%]">PLC DB</th>
                        <th className="p-2 px-3 font-bold uppercase tracking-wider w-[15%]">Tipología</th>
                        <th className="p-2 px-3 font-bold uppercase tracking-wider w-[25%]">Causa</th>
                        <th className="p-2 px-3 font-bold uppercase tracking-wider w-[20%]">Remedio</th>
                        <th className="p-2 px-3 font-bold uppercase tracking-wider text-center w-[10%]">Estado</th>
                        <th className="p-2 px-3 font-bold uppercase tracking-wider text-center w-[10%]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2e404a]/50">
                      {alarmConfig?.in?.map((alarm) => {
                        const plcKeys = telemetry?.plc ? Object.keys(telemetry.plc).filter(k => k.toLowerCase().startsWith('ob_alar')).sort((a, b) => a.localeCompare(b)) : [];
                        const value = alarm.plcVar && telemetry?.plc ? telemetry.plc[alarm.plcVar] : null;
                        return (
                        <tr key={alarm.id} className="hover:bg-[#1d2930]/50 transition-colors group">
                          <td className="p-2">
                            <select
                              value={alarm.plcVar}
                              onChange={(e) => saveAlarmConfig({ ...alarmConfig, in: alarmConfig.in.map(a => a.id === alarm.id ? { ...a, plcVar: e.target.value } : a) })}
                              className="w-full bg-[#1d2930] border border-[#2e404a] text-white rounded p-1 text-[10px] outline-none focus:border-yellow-500"
                            >
                              <option value="">-- Seleccionar --</option>
                              {plcKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                            </select>
                          </td>
                          <td className="p-2">
                            <select
                              value={alarm.type}
                              onChange={(e) => saveAlarmConfig({ ...alarmConfig, in: alarmConfig.in.map(a => a.id === alarm.id ? { ...a, type: e.target.value } : a) })}
                              className={`w-full bg-[#1d2930] border border-[#2e404a] rounded p-1 text-[10px] outline-none font-bold ${alarm.type === 'Alarma' ? 'text-red-400 focus:border-red-500' : 'text-yellow-400 focus:border-yellow-500'}`}
                            >
                              <option value="Advertencia">Advertencia</option>
                              <option value="Alarma">Alarma</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={alarm.desc}
                              onChange={(e) => saveAlarmConfig({ ...alarmConfig, in: alarmConfig.in.map(a => a.id === alarm.id ? { ...a, desc: e.target.value } : a) })}
                              placeholder="Descripción"
                              className="w-full bg-[#1d2930] border border-[#2e404a] text-white rounded p-1 text-[10px] outline-none focus:border-yellow-500"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={alarm.remedy}
                              onChange={(e) => saveAlarmConfig({ ...alarmConfig, in: alarmConfig.in.map(a => a.id === alarm.id ? { ...a, remedy: e.target.value } : a) })}
                              placeholder="Remedio"
                              className="w-full bg-[#1d2930] border border-[#2e404a] text-white rounded p-1 text-[10px] outline-none focus:border-yellow-500"
                            />
                          </td>
                          <td className="p-2 text-center font-mono font-bold">
                            <div className="flex items-center justify-center gap-2">
                              <span className={`text-xs font-black ${value ? (alarm.type === 'Alarma' ? "text-red-400" : "text-yellow-400") : "text-gray-400"}`}>
                                {value ? "TRUE" : "FALSE"}
                              </span>
                              <div className={`w-2 h-2 rounded-full ${value ? (alarm.type === 'Alarma' ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]" : "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.9)]") : "bg-gray-600"}`} />
                            </div>
                          </td>
                          <td className="p-2 text-center">
                            <button onClick={() => saveAlarmConfig({ ...alarmConfig, in: alarmConfig.in.filter(a => a.id !== alarm.id) })} className="text-red-400 hover:text-red-300">
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      )})}
                      {(!alarmConfig?.in || alarmConfig.in.length === 0) && (
                        <tr>
                          <td colSpan="5" className="text-center p-4 text-gray-500 italic">No hay alarmas configuradas.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tabla OUT ALARMAS */}
              <div className="bg-[#0a0f12] rounded-xl border border-[#2e404a] flex flex-col shadow-inner overflow-hidden">
                <div className="bg-[#1d2930] p-2 flex justify-between items-center border-b border-[#2e404a]">
                  <h4 className="text-xs font-black tracking-widest uppercase text-red-400">
                    OUT ALARMAS (Escritura APP → PLC)
                  </h4>
                  <button onClick={addOutAlarm} className="bg-[#2e404a] hover:bg-red-500 hover:text-white text-white text-[9px] px-2 py-1 rounded font-bold uppercase transition-colors">
                    + Añadir
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-[10px] text-gray-300">
                    <thead className="bg-[#1d2930] sticky top-0 border-b border-[#2e404a] z-10 shadow-md">
                      <tr>
                        <th className="p-2 px-3 font-bold uppercase tracking-wider w-[15%]">Dirección</th>
                        <th className="p-2 px-3 font-bold uppercase tracking-wider w-[30%]">Proyecto</th>
                        <th className="p-2 px-3 font-bold uppercase tracking-wider w-[25%]">PLC DB</th>
                        <th className="p-2 px-3 font-bold uppercase tracking-wider text-center w-[15%]">Forzar</th>
                        <th className="p-2 px-3 font-bold uppercase tracking-wider text-right w-[10%]">Valor</th>
                        <th className="p-2 px-3 font-bold uppercase tracking-wider text-center w-[5%]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2e404a]/50">
                      {alarmConfig?.out?.map((alarm) => {
                        const plcKeys = telemetry?.plc ? Object.keys(telemetry.plc).filter(k => k.toLowerCase().startsWith('ib_alar')).sort((a, b) => a.localeCompare(b)) : [];
                        const value = alarm.plcVar && telemetry?.plc ? telemetry.plc[alarm.plcVar] : null;
                        return (
                        <tr key={alarm.id} className="hover:bg-[#1d2930]/50 transition-colors group">
                          <td className="p-2">
                            <select
                              value={alarm.direction}
                              disabled
                              className="w-full bg-[#1d2930] border border-[#2e404a] text-gray-400 rounded p-1 text-[10px] outline-none"
                            >
                              <option value="OUT">OUT (Escritura)</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={alarm.projectVar}
                              onChange={(e) => saveAlarmConfig({ ...alarmConfig, out: alarmConfig.out.map(a => a.id === alarm.id ? { ...a, projectVar: e.target.value } : a) })}
                              placeholder="Nombre de la acción"
                              className="w-full bg-[#1d2930] border border-[#2e404a] text-white rounded p-1 text-[10px] outline-none focus:border-red-500 font-bold uppercase tracking-wide"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={alarm.plcVar}
                              onChange={(e) => saveAlarmConfig({ ...alarmConfig, out: alarmConfig.out.map(a => a.id === alarm.id ? { ...a, plcVar: e.target.value } : a) })}
                              className="w-full bg-[#1d2930] border border-[#2e404a] text-white rounded p-1 text-[10px] outline-none focus:border-red-500"
                            >
                              <option value="">-- Seleccionar --</option>
                              {plcKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                            </select>
                          </td>
                          <td className="p-2 text-center">
                            {(isSimulation || forceMode) && (
                              <button
                                onClick={() => forceDirectWrite(alarm.plcVar, !value)}
                                className={`px-2 py-1 border rounded text-[9px] font-bold transition-colors uppercase shadow-sm ${
                                  value
                                    ? "bg-red-500/20 border-red-500 text-red-400 hover:bg-red-500/30"
                                    : "bg-[#1d2930] border-[#2e404a] text-white hover:border-red-500 hover:text-red-400"
                                }`}
                              >
                                Toggle
                              </button>
                            )}
                          </td>
                          <td className="p-2 text-right font-mono font-bold">
                            <div className="flex items-center justify-end gap-2">
                              <span className={`text-xs font-black ${value ? "text-red-400" : "text-gray-400"}`}>
                                {value ? "TRUE" : "FALSE"}
                              </span>
                              <div className={`w-2 h-2 rounded-full ${value ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]" : "bg-gray-600"}`} />
                            </div>
                          </td>
                          <td className="p-2 text-center">
                            <button onClick={() => saveAlarmConfig({ ...alarmConfig, out: alarmConfig.out.filter(a => a.id !== alarm.id) })} className="text-red-400 hover:text-red-300">
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      )})}
                      {(!alarmConfig?.out || alarmConfig.out.length === 0) && (
                        <tr>
                          <td colSpan="6" className="text-center p-4 text-gray-500 italic">No hay comandos OUT de alarma configurados.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

            </div>
        </div>
      </div>
    </div>
  );
};

export default PlcModal;
