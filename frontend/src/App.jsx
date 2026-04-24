import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import LeftPanel from './components/LeftPanel';
import DigitalTwin from './components/DigitalTwin';
import Sequencer from './components/Sequencer';
import Footer from './components/Footer';
import TelemetryHUD from './components/TelemetryHUD';

function App() {
  // Estado global simulado
  const [erpData, setErpData] = useState(null);
  const [telemetry, setTelemetry] = useState({ distance: 0, timer: 0.0, state: 'IDLE' });
  const [networkStatus, setNetworkStatus] = useState({ opc: false, basler: false, db: true, erp: true });
  const [stepsState, setStepsState] = useState([true, true, true, true, true]); // Habilitar/Deshabilitar pasos

  useEffect(() => {
    // Simular conexión a WebSocket del backend
    const ws = new WebSocket('ws://localhost:8000/ws');
    
    ws.onopen = () => {
      setNetworkStatus(prev => ({...prev, opc: true, basler: true}));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'telemetry') {
        setTelemetry({ distance: data.distance, timer: data.timer, state: data.state });
      } else if (data.type === 'erp') {
        setErpData(data.data);
      }
    };

    ws.onclose = () => {
      setNetworkStatus(prev => ({...prev, opc: false, basler: false}));
    };

    return () => ws.close();
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-logisnext-darkslate text-white overflow-hidden font-primary">
      <Header status={networkStatus} />
      
      <div className="flex-1 flex flex-row overflow-hidden">
        {/* Left Panel: ERP Data */}
        <LeftPanel data={erpData} />
        
        {/* Center: 3D View & Telemetry */}
        <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden scanlines">
          <TelemetryHUD telemetry={telemetry} />
          <DigitalTwin distance={telemetry.distance} />
        </div>
        
        {/* Right Panel: Sequencer */}
        <Sequencer stepsState={stepsState} setStepsState={setStepsState} />
      </div>

      <Footer />
    </div>
  );
}

export default App;
