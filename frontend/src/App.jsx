import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import LeftPanel from './components/LeftPanel';
import DigitalTwin from './components/DigitalTwin';
import Sequencer from './components/Sequencer';
import Footer from './components/Footer';
import TelemetryHUD from './components/TelemetryHUD';
import ErpListModal from './components/ErpListModal';
import SettingsModal from './components/SettingsModal';
import OperatorLoginModal from './components/OperatorLoginModal';
import PlcModal from './components/PlcModal';

const API_BASE = 'http://localhost:8001';

function App() {
  const [erpData, setErpData]           = useState(null);
  const [erpModalOpen, setErpModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [plcModalOpen, setPlcModalOpen] = useState(false);
  const [telemetry, setTelemetry]       = useState({ distance: 0, timer: 0.0, state: 'IDLE' });
  const [networkStatus, setNetworkStatus] = useState({ opc: false, basler: false, db: false, erp: true });
  const [operario, setOperario]         = useState(null);
  const [isSimulation, setIsSimulation] = useState(true);


  // Cargar datos completos de un bastidor seleccionado (desde el modal o ErpSearch)
  const handleBastidorSelect = useCallback(async (bastidor) => {
    try {
      const res = await fetch(`${API_BASE}/erp/bastidor/${encodeURIComponent(bastidor)}`);
      if (res.ok) {
        const data = await res.json();
        setErpData(data);
      }
    } catch (err) {
      console.error('Error cargando bastidor:', err);
    }
  }, []);

  // ── Polling estado BD (cada 10 s) ──────────────────────────────────────────
  useEffect(() => {
    const checkDb = async () => {
      try {
        const res  = await fetch(`${API_BASE}/health/db`);
        const data = await res.json();
        setNetworkStatus(prev => ({ ...prev, db: data.connected === true }));
      } catch {
        setNetworkStatus(prev => ({ ...prev, db: false }));
      }
    };
    checkDb();                              // comprobación inmediata al arrancar
    const interval = setInterval(checkDb, 10_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8001/ws');
    ws.onopen = () => setNetworkStatus(prev => ({ ...prev, opc: true, basler: true }));
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'telemetry') {
        setTelemetry({ 
          distance: data.distance, 
          timer: data.timer, 
          state: data.state,
          plc: data.plc || {} 
        });
      }
    };
    ws.onclose = () => setNetworkStatus(prev => ({ ...prev, opc: false, basler: false }));
    return () => ws.close();
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-logisnext-darkslate text-white overflow-hidden font-primary">
      <Header
        status={networkStatus}
        onErpClick={() => setErpModalOpen(true)}
        onSettingsClick={() => setSettingsOpen(true)}
        onPlcClick={() => setPlcModalOpen(true)}
        operario={operario}
        canChangeOperator={!erpData}
        onOperatorClick={() => setOperario(null)}
      />

      <div className="flex-1 flex flex-row overflow-hidden">
        <LeftPanel data={erpData} onErpData={handleBastidorSelect} />

        <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden scanlines">
          <TelemetryHUD telemetry={telemetry} />
          <DigitalTwin distance={telemetry.distance} plcState={telemetry.plc} />

          {/* Slider flotante para el movimiento del carro (Solo Simulación) */}
          {isSimulation && (
            <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 bg-[#0a0f12]/80 backdrop-blur-md p-4 rounded-full border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.15)] z-20">
              <span className="text-blue-400 text-xs font-black uppercase tracking-widest bg-blue-500/10 px-2 py-1 rounded">8.7m</span>
              <input 
                type="range" 
                min="0" 
                max="8700" 
                step="10"
                value={telemetry.plc?.OW_Altura_Elevacion || 0}
                onChange={async (e) => {
                  const val = parseFloat(e.target.value);
                  try {
                    await fetch('http://localhost:8001/plc/write', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ OW_Altura_Elevacion: val })
                    });
                  } catch (err) { console.error("Error escribiendo altura PLC", err); }
                }}
                className="w-2 h-64 appearance-none bg-[#1d2930] rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(59,130,246,0.8)] cursor-pointer"
                style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' }}
              />
              <span className="text-blue-400 text-xs font-black uppercase tracking-widest bg-blue-500/10 px-2 py-1 rounded">0m</span>
            </div>
          )}
        </div>

        <Sequencer erpData={erpData} onErpData={setErpData} onOpenErp={() => setErpModalOpen(true)} />
      </div>

      <Footer />

      {/* Modal ERP — se abre al pulsar el LED "ERP" del header */}
      <ErpListModal
        open={erpModalOpen}
        onClose={() => setErpModalOpen(false)}
        onSelect={handleBastidorSelect}
      />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} telemetry={telemetry} />
      
      <PlcModal 
        open={plcModalOpen} 
        onClose={() => setPlcModalOpen(false)} 
        telemetry={telemetry} 
        isSimulation={isSimulation}
        setIsSimulation={setIsSimulation}
      />

      {/* Identificación de operario al inicio */}
      {!operario && <OperatorLoginModal onLogin={setOperario} />}
    </div>
  );
}

export default App;
