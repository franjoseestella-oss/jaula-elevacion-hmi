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

const API_BASE = 'http://localhost:8000';

function App() {
  const [erpData, setErpData]           = useState(null);
  const [erpModalOpen, setErpModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [telemetry, setTelemetry]       = useState({ distance: 0, timer: 0.0, state: 'IDLE' });
  const [networkStatus, setNetworkStatus] = useState({ opc: false, basler: false, db: false, erp: true });
  const [operario, setOperario]         = useState(null);


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
    const ws = new WebSocket('ws://localhost:8000/ws');
    ws.onopen = () => setNetworkStatus(prev => ({ ...prev, opc: true, basler: true }));
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'telemetry') {
        setTelemetry({ distance: data.distance, timer: data.timer, state: data.state });
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
        operario={operario}
        canChangeOperator={!erpData}
        onOperatorClick={() => setOperario(null)}
      />

      <div className="flex-1 flex flex-row overflow-hidden">
        <LeftPanel data={erpData} onErpData={handleBastidorSelect} />

        <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden scanlines">
          <TelemetryHUD telemetry={telemetry} />
          <DigitalTwin distance={telemetry.distance} />
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

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Identificación de operario al inicio */}
      {!operario && <OperatorLoginModal onLogin={setOperario} />}
    </div>
  );
}

export default App;
