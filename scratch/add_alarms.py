import re

with open('frontend/src/components/PlcModal.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add state for alarms
state_code = """
  const [alarmConfig, setAlarmConfig] = useState(() => {
    const saved = localStorage.getItem("plcAlarmConfig");
    return saved ? JSON.parse(saved) : { in: [], out: [] };
  });

  const saveAlarmConfig = (newConfig) => {
    setAlarmConfig(newConfig);
    localStorage.setItem("plcAlarmConfig", JSON.stringify(newConfig));
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
"""

content = content.replace('const [varMapping, setVarMapping] = useState(() => {', state_code + '\n  const [varMapping, setVarMapping] = useState(() => {')

# 2. Add Alarms section in JSX
alarms_jsx = """
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
                        <th className="p-2 px-3 font-bold uppercase tracking-wider w-[20%]">Tipología</th>
                        <th className="p-2 px-3 font-bold uppercase tracking-wider w-[25%]">Causa</th>
                        <th className="p-2 px-3 font-bold uppercase tracking-wider w-[25%]">Remedio</th>
                        <th className="p-2 px-3 font-bold uppercase tracking-wider text-center w-[10%]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2e404a]/50">
                      {alarmConfig?.in?.map((alarm) => {
                        const plcKeys = telemetry?.plc ? Object.keys(telemetry.plc).sort((a, b) => a.localeCompare(b)) : [];
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
                        const plcKeys = telemetry?.plc ? Object.keys(telemetry.plc).sort((a, b) => a.localeCompare(b)) : [];
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
"""

content = content.replace('            </div>\n        </div>\n      </div>\n    </div>\n  );\n};', alarms_jsx + '\n            </div>\n        </div>\n      </div>\n    </div>\n  );\n};')

with open('frontend/src/components/PlcModal.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
