import React, { useState, useEffect } from 'react';
import { X, Settings, Network, Usb, Save, TestTube, Cpu, Activity, Lightbulb, Box, Upload, QrCode, Camera, Globe } from 'lucide-react';
import ObjViewer from './ObjViewer';
import { useLanguage } from '../LanguageContext';

const SettingsModal = ({ open, onClose, telemetry }) => {
  const { language, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState('lectorqr');
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSimulation, setIsSimulation] = useState(true);
  const [cameraCoords, setCameraCoords] = useState(null);

  // Estados Lector QR
  const [qrConnType, setQrConnType] = useState('usb');
  const [qrIp, setQrIp] = useState('192.168.0.60');
  const [qrPort, setQrPort] = useState('5026');
  const [qrComPort, setQrComPort] = useState('COM4');
  const [qrBaudRate, setQrBaudRate] = useState('115200');
  const [qrTestResult, setQrTestResult] = useState(null);
  const [isQrTesting, setIsQrTesting] = useState(false);
  const [isReadingQr, setIsReadingQr] = useState(false);
  const [qrReadResult, setQrReadResult] = useState(null);
  const [availableComPorts, setAvailableComPorts] = useState([]);

  // Cámara Basler
  const [baslerIp, setBaslerIp] = useState(() => localStorage.getItem('baslerIp') || '');
  const [isBaslerTesting, setIsBaslerTesting] = useState(false);
  const [baslerTestResult, setBaslerTestResult] = useState(null);
  const [baslerPreviewUrl, setBaslerPreviewUrl] = useState(null);

  // Archivos 3D
  const [objFile, setObjFile] = useState(null);
  const [mtlFile, setMtlFile] = useState(null);

  // Estados de tolerancia (se guardan en localStorage para persistencia)
  const [toleranciaPositiva, setToleranciaPositiva] = useState(() => parseInt(localStorage.getItem('toleranciaPositiva')) || 50);
  const [toleranciaNegativa, setToleranciaNegativa] = useState(() => parseInt(localStorage.getItem('toleranciaNegativa')) || 50);

  // Parámetros Prueba 5 minutos
  const [test5mDuration, setTest5mDuration] = useState(() => parseInt(localStorage.getItem('test5mDuration')) || 300);
  const [test5mTolerancia, setTest5mTolerancia] = useState(() => parseInt(localStorage.getItem('test5mTolerancia')) || 15);
  const [cotaInicial, setCotaInicial] = useState(() => parseInt(localStorage.getItem('cotaInicialPruebas')) || 1500);

  // Estado local para las salidas del PLC
  const [luces, setLuces] = useState({ Ib_LUZ_VERDE: false, Ib_LUZ_AZUL: false, Ib_LUZ_ROJA: false });

  // Sincronizar el estado local con la telemetría real del backend
  React.useEffect(() => {
    const activePlc = telemetry?.mappedPlc || telemetry?.plc;
    if (activePlc) {
      setLuces({
        Ib_LUZ_VERDE: !!activePlc.Ib_LUZ_VERDE,
        Ib_LUZ_AZUL: !!activePlc.Ib_LUZ_AZUL,
        Ib_LUZ_ROJA: !!activePlc.Ib_LUZ_ROJA,
      });
    }
  }, [telemetry?.mappedPlc, telemetry?.plc]);

  React.useEffect(() => {
    if (open) {
      fetch('http://localhost:8001/api/com_ports')
        .then(res => res.json())
        .then(data => {
          if (data.status === 'ok') {
            setAvailableComPorts(data.ports);
          }
        })
        .catch(err => console.error("Error fetching com ports", err));
    }
  }, [open]);

  if (!open) return null;

  const handleSave = () => {
    // Guardar config Lector QR
    const qrConfig = { qrConnType, qrIp, qrPort, qrComPort, qrBaudRate };
    localStorage.setItem('qrConfig', JSON.stringify(qrConfig));

    localStorage.setItem('toleranciaPositiva', toleranciaPositiva);
    localStorage.setItem('toleranciaNegativa', toleranciaNegativa);
    localStorage.setItem('test5mDuration', test5mDuration);
    localStorage.setItem('test5mTolerancia', test5mTolerancia);
    localStorage.setItem('cotaInicialPruebas', cotaInicial);
    
    // Guardar config Basler y enviarla al backend
    localStorage.setItem('baslerIp', baslerIp);
    fetch('http://localhost:8001/api/basler/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: baslerIp })
    }).catch(err => console.error("Error actualizando IP Basler", err));
    
    // Notificar al sistema
    window.dispatchEvent(new Event('toleranciaChanged'));
    window.dispatchEvent(new Event('cotaInicialChanged'));
    window.dispatchEvent(new Event('test5mConfigChanged'));
    window.dispatchEvent(new Event('qrConfigChanged'));
    onClose();
  };

  const handleTestQrConnection = async () => {
    setIsQrTesting(true);
    setQrTestResult(null);
    try {
      const res = await fetch('http://localhost:8001/config/qr/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connType: qrConnType, ip: qrIp, port: qrPort, comPort: qrComPort, baudRate: qrBaudRate })
      });
      const data = await res.json();
      setQrTestResult(data);
    } catch (err) {
      setQrTestResult({ status: 'error', message: err.message });
    } finally {
      setIsQrTesting(false);
    }
  };

  const handleReadQr = async () => {
    setIsReadingQr(true);
    setQrReadResult(null);
    try {
      const res = await fetch('http://localhost:8001/config/qr/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connType: 'serial', ip: qrIp, port: qrPort, comPort: qrComPort, baudRate: qrBaudRate })
      });
      const data = await res.json();
      setQrReadResult(data);
    } catch (err) {
      setQrReadResult({ status: 'error', message: err.message });
    } finally {
      setIsReadingQr(false);
    }
  };

  const handleTestBasler = async () => {
    setIsBaslerTesting(true);
    setBaslerTestResult(null);
    setBaslerPreviewUrl(null);
    try {
      // 1. Send the config to the backend first
      await fetch('http://localhost:8001/api/basler/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: baslerIp })
      });

      // 2. Check status
      const statusRes = await fetch('http://localhost:8001/api/basler/status');
      const statusData = await statusRes.json();
      
      if (statusData.connected) {
        setBaslerTestResult({ status: 'ok', message: statusData.message });
        // 3. Try to capture an image
        const imgRes = await fetch('http://localhost:8001/api/basler/capture');
        if (imgRes.ok) {
          const imgData = await imgRes.json();
          setBaslerPreviewUrl(imgData.image);
        } else {
          const errData = await imgRes.json().catch(() => ({}));
          setBaslerTestResult({ status: 'warning', message: errData.detail || t('basler_error_captura') });
        }
      } else {
        setBaslerTestResult({ status: 'error', message: statusData.message || t('basler_no_conectada') });
      }
    } catch (err) {
      setBaslerTestResult({ status: 'error', message: err.message });
    } finally {
      setIsBaslerTesting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center"
      style={{ background: 'rgba(5,10,14,0.85)', backdropFilter: 'blur(5px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-[900px] flex flex-col bg-gradient-to-b from-[#151f25] to-[#0d1a20] border border-[#2e404a] rounded-2xl shadow-[0_0_60px_rgba(221,40,118,0.15)] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e404a] bg-[#1d2930]/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-logisnext-slate/20 rounded-lg border border-logisnext-slate/40">
              <Settings size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-black text-sm uppercase tracking-widest">
                {t('ajustes_sistema')}
              </h2>
              <span className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">
                {t('preferencias_dispositivos')}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#2e404a] rounded-lg text-logisnext-lightslate hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-row h-[600px]">
          {/* Sidebar Tabs */}
          <div className="w-48 border-r border-[#2e404a] bg-[#0a0f12]/50 p-4 flex flex-col gap-2">
            <button
              onClick={() => setActiveTab('lectorqr')}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'lectorqr'
                  ? 'bg-logisnext-magenta/20 text-logisnext-magenta border border-logisnext-magenta/30'
                  : 'text-logisnext-slate hover:bg-[#1d2930] hover:text-white border border-transparent'
              }`}
            >
              <QrCode size={14} />
              {t('lector_qr')}
            </button>
            <button
              onClick={() => setActiveTab('tolerancia')}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'tolerancia'
                  ? 'bg-logisnext-magenta/20 text-logisnext-magenta border border-logisnext-magenta/30'
                  : 'text-logisnext-slate hover:bg-[#1d2930] hover:text-white border border-transparent'
              }`}
            >
              <Activity size={14} />
              {t('tolerancia')}
            </button>
            <button
              onClick={() => setActiveTab('prueba5m')}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'prueba5m'
                  ? 'bg-logisnext-magenta/20 text-logisnext-magenta border border-logisnext-magenta/30'
                  : 'text-logisnext-slate hover:bg-[#1d2930] hover:text-white border border-transparent'
              }`}
            >
              <TestTube size={14} />
              {t('prueba_5_min')}
            </button>
            <button
              onClick={() => setActiveTab('visor3d')}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'visor3d'
                  ? 'bg-logisnext-magenta/20 text-logisnext-magenta border border-logisnext-magenta/30'
                  : 'text-logisnext-slate hover:bg-[#1d2930] hover:text-white border border-transparent'
              }`}
            >
              <Box size={14} />
              {t('visor_3d')}
            </button>
            <button
              onClick={() => setActiveTab('camara')}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'camara'
                  ? 'bg-logisnext-magenta/20 text-logisnext-magenta border border-logisnext-magenta/30'
                  : 'text-logisnext-slate hover:bg-[#1d2930] hover:text-white border border-transparent'
              }`}
            >
              <Lightbulb size={14} />
              {t('camara_3d')}
            </button>
            <button
              onClick={() => setActiveTab('basler')}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'basler'
                  ? 'bg-logisnext-magenta/20 text-logisnext-magenta border border-logisnext-magenta/30'
                  : 'text-logisnext-slate hover:bg-[#1d2930] hover:text-white border border-transparent'
              }`}
            >
              <Camera size={14} />
              {t('camara_basler')}
            </button>
            <button
              onClick={() => setActiveTab('lenguajes')}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'lenguajes'
                  ? 'bg-logisnext-magenta/20 text-logisnext-magenta border border-logisnext-magenta/30'
                  : 'text-logisnext-slate hover:bg-[#1d2930] hover:text-white border border-transparent'
              }`}
            >
              <Globe size={14} />
              {t('lenguajes')}
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">

            {activeTab === 'lectorqr' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm text-white font-bold uppercase tracking-widest border-b border-logisnext-magenta/50 pb-1 inline-block">
                    {t('configurar_lector_qr')}
                  </h3>
                  {qrConnType === 'serial' && (
                    <button 
                      onClick={() => {
                        fetch('http://localhost:8001/api/com_ports')
                          .then(res => res.json())
                          .then(data => {
                            if (data.status === 'ok') {
                              setAvailableComPorts(data.ports);
                              if (data.ports.length > 0 && !data.ports.includes(qrComPort)) {
                                setQrComPort(data.ports[0]);
                              }
                            }
                          });
                      }}
                      className="text-[10px] text-logisnext-magenta font-bold uppercase tracking-widest hover:text-white transition-colors"
                    >
                      {t('actualizar_puertos')}
                    </button>
                  )}
                </div>

                {/* Tipo de Conexión */}
                <div className="space-y-3">
                  <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">
                    {t('tipo_conexion')}
                  </label>
                  <div className="flex gap-4">
                    <label className={`flex-1 flex items-center justify-center gap-2 py-3 border rounded-lg cursor-pointer transition-all ${
                      qrConnType === 'usb' ? 'bg-[#1d2930] border-logisnext-magenta text-white shadow-[0_0_15px_rgba(221,40,118,0.2)]' : 'border-[#2e404a] text-logisnext-slate hover:border-[#5d7a8a]'
                    }`}>
                      <input type="radio" name="qrConnType" value="usb" checked={qrConnType === 'usb'} onChange={() => setQrConnType('usb')} className="hidden" />
                      <span className="text-xs font-bold uppercase tracking-wider">{t('usb_teclado')}</span>
                    </label>
                    <label className={`flex-1 flex items-center justify-center gap-2 py-3 border rounded-lg cursor-pointer transition-all ${
                      qrConnType === 'serial' ? 'bg-[#1d2930] border-logisnext-magenta text-white shadow-[0_0_15px_rgba(221,40,118,0.2)]' : 'border-[#2e404a] text-logisnext-slate hover:border-[#5d7a8a]'
                    }`}>
                      <input type="radio" name="qrConnType" value="serial" checked={qrConnType === 'serial'} onChange={() => setQrConnType('serial')} className="hidden" />
                      <Usb size={16} />
                      <span className="text-xs font-bold uppercase tracking-wider">{t('serial_com')}</span>
                    </label>
                  </div>
                </div>

                {qrConnType === 'serial' ? (
                  <>
                    <div className="bg-[#1d2930]/40 border border-[#2e404a] rounded-xl p-5 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">{t('puerto_com')}</label>
                          <select
                            value={qrComPort}
                            onChange={(e) => setQrComPort(e.target.value)}
                            className="bg-[#0a0f12] border border-[#2e404a] rounded-lg px-3 py-2 text-white text-xs font-mono outline-none focus:border-logisnext-magenta transition-colors"
                          >
                            {availableComPorts.length === 0 && <option value={qrComPort}>{qrComPort} ({t('no_detectado')})</option>}
                            {availableComPorts.map(port => (
                              <option key={port} value={port}>{port}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">{t('baud_rate')}</label>
                          <select
                            value={qrBaudRate}
                            onChange={(e) => setQrBaudRate(e.target.value)}
                            className="bg-[#0a0f12] border border-[#2e404a] rounded-lg px-3 py-2 text-white text-xs font-mono outline-none focus:border-logisnext-magenta transition-colors"
                          >
                            <option value="9600">9600</option>
                            <option value="19200">19200</option>
                            <option value="38400">38400</option>
                            <option value="57600">57600</option>
                            <option value="115200">115200</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-col gap-4">
                      <div className="flex items-center justify-end gap-2">
                        {qrTestResult && (
                          <div className={`text-xs px-3 py-1.5 rounded bg-[#1d2930]/80 border ${
                            qrTestResult.status === 'ok' ? 'text-green-400 border-green-500/30' : 'text-red-400 border-red-500/30'
                          } flex-1 overflow-hidden text-ellipsis whitespace-nowrap`} title={qrTestResult.message}>
                            {qrTestResult.message}
                          </div>
                        )}
                        <button
                          onClick={handleTestQrConnection}
                          disabled={isQrTesting}
                          className="flex items-center gap-2 px-4 py-2 border border-[#2e404a] hover:bg-[#2e404a] text-logisnext-lightslate hover:text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                        >
                          <TestTube size={14} className={isQrTesting ? "animate-spin" : ""} />
                          {isQrTesting ? t('probando') : t('test_conexion')}
                        </button>
                        <button
                          onClick={handleReadQr}
                          disabled={isReadingQr}
                          className="flex items-center gap-2 px-4 py-2 border border-logisnext-magenta text-logisnext-magenta hover:bg-logisnext-magenta hover:text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                        >
                          <QrCode size={14} className={isReadingQr ? "animate-spin" : ""} />
                          {isReadingQr ? t('leyendo') : t('leer_datos')}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-[#1d2930]/40 border border-[#2e404a] rounded-xl p-5 space-y-4">
                     <p className="text-xs text-logisnext-lightslate font-medium">
                        {t('lector_usb_desc')}
                     </p>
                     <textarea 
                       autoFocus
                       placeholder={t('haz_clic_escanear')} 
                       className="w-full bg-[#0a0f12] border border-[#2e404a] rounded-lg px-4 py-3 text-white text-sm font-mono outline-none focus:border-logisnext-magenta transition-colors min-h-[100px] resize-none custom-scrollbar"
                       onChange={(e) => {
                         const val = e.target.value;
                         if (window.qrTimeout) clearTimeout(window.qrTimeout);
                         window.qrTimeout = setTimeout(() => {
                           if (val.trim() !== '') {
                             setQrReadResult({ status: 'ok', data: val });
                             e.target.value = '';
                           }
                         }, 300);
                       }}
                     />
                  </div>
                )}
                
                {/* Resultado de lectura */}
                {qrReadResult && (
                  <div className="bg-[#1d2930]/60 border border-[#2e404a] rounded-xl p-4 mt-4">
                    <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest block mb-2">
                      {t('resultado_lectura')}
                    </label>
                    <div className={`font-mono text-sm whitespace-pre-wrap break-all ${qrReadResult.status === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
                      {qrReadResult.status === 'ok' ? (qrReadResult.data || t('lectura_vacia')) : qrReadResult.message}
                    </div>
                  </div>
                )}

              </div>
            )}

            {activeTab === 'tolerancia' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm text-white font-bold uppercase tracking-widest border-b border-logisnext-magenta/50 pb-1 inline-block">
                    {t('tolerancia_multiload')}
                  </h3>
                </div>

                <div className="bg-[#1d2930]/40 border border-[#2e404a] rounded-xl p-5 space-y-6">
                  <p className="text-xs text-logisnext-lightslate font-medium">
                    {t('tolerancia_desc')}
                  </p>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] text-green-400 font-bold uppercase tracking-widest">
                        {t('tolerancia_positiva')}
                      </label>
                      <input
                        type="number"
                        value={toleranciaPositiva}
                        onChange={(e) => setToleranciaPositiva(e.target.value)}
                        className="bg-[#0a0f12] border border-green-500/30 rounded-lg px-4 py-3 text-white text-sm font-black outline-none focus:border-green-400 transition-colors"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] text-red-400 font-bold uppercase tracking-widest">
                        {t('tolerancia_negativa')}
                      </label>
                      <input
                        type="number"
                        value={toleranciaNegativa}
                        onChange={(e) => setToleranciaNegativa(e.target.value)}
                        className="bg-[#0a0f12] border border-red-500/30 rounded-lg px-4 py-3 text-white text-sm font-black outline-none focus:border-red-400 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-[#1d2930]/40 border border-[#2e404a] rounded-xl p-5 space-y-6 mt-6">
                  <p className="text-xs text-logisnext-lightslate font-medium">
                    {t('cota_inicial_desc')}
                  </p>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">
                      {t('cota_inicial_pruebas')}
                    </label>
                    <input
                      type="number"
                      value={cotaInicial}
                      onChange={(e) => setCotaInicial(e.target.value)}
                      className="bg-[#0a0f12] border border-blue-500/30 rounded-lg px-4 py-3 text-white text-sm font-black outline-none focus:border-blue-400 transition-colors w-1/2"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'prueba5m' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm text-white font-bold uppercase tracking-widest border-b border-logisnext-magenta/50 pb-1 inline-block">
                    {t('prueba_5_minutos_titulo')}
                  </h3>
                </div>

                <div className="bg-[#1d2930]/40 border border-[#2e404a] rounded-xl p-5 space-y-6">
                  <p className="text-xs text-logisnext-lightslate font-medium">
                    {t('prueba_5_minutos_desc')}
                  </p>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">
                        {t('duracion_segundos')}
                      </label>
                      <input
                        type="number"
                        value={test5mDuration}
                        onChange={(e) => setTest5mDuration(e.target.value)}
                        className="bg-[#0a0f12] border border-[#2e404a] rounded-lg px-4 py-3 text-white text-sm font-black outline-none focus:border-logisnext-magenta transition-colors"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">
                        {t('tolerancia_caida')}
                      </label>
                      <input
                        type="number"
                        value={test5mTolerancia}
                        onChange={(e) => setTest5mTolerancia(e.target.value)}
                        className="bg-[#0a0f12] border border-[#2e404a] rounded-lg px-4 py-3 text-white text-sm font-black outline-none focus:border-logisnext-magenta transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'visor3d' && (
              <div className="space-y-4 h-full flex flex-col">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm text-white font-bold uppercase tracking-widest border-b border-logisnext-magenta/50 pb-1 inline-block">
                    {t('visor_3d_titulo')}
                  </h3>
                </div>

                <div className="flex gap-4 shrink-0">
                  <label className="flex-1 flex flex-col items-center justify-center p-3 bg-[#1d2930]/40 border border-dashed border-[#2e404a] hover:border-logisnext-magenta/50 rounded-xl cursor-pointer transition-colors">
                    <Upload size={16} className="text-logisnext-lightslate mb-1" />
                    <span className="text-[10px] text-white font-bold uppercase tracking-widest">{t('subir_obj')}</span>
                    <span className="text-[9px] text-logisnext-slate mt-0.5 truncate max-w-[150px]">
                      {objFile ? objFile.name : t('ningun_archivo')}
                    </span>
                    <input type="file" accept=".obj" className="hidden" onChange={(e) => setObjFile(e.target.files[0])} />
                  </label>
                  <label className="flex-1 flex flex-col items-center justify-center p-3 bg-[#1d2930]/40 border border-dashed border-[#2e404a] hover:border-logisnext-magenta/50 rounded-xl cursor-pointer transition-colors">
                    <Upload size={16} className="text-logisnext-lightslate mb-1" />
                    <span className="text-[10px] text-white font-bold uppercase tracking-widest">{t('subir_mtl')}</span>
                    <span className="text-[9px] text-logisnext-slate mt-0.5 truncate max-w-[150px]">
                      {mtlFile ? mtlFile.name : t('opcional_materiales')}
                    </span>
                    <input type="file" accept=".mtl" className="hidden" onChange={(e) => setMtlFile(e.target.files[0])} />
                  </label>
                </div>

                <div className="flex-1 relative min-h-[450px]">
                  <ObjViewer objFile={objFile} mtlFile={mtlFile} />
                </div>
              </div>
            )}

            {activeTab === 'camara' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm text-white font-bold uppercase tracking-widest border-b border-logisnext-magenta/50 pb-1 inline-block">
                    {t('camara_debug_titulo')}
                  </h3>
                </div>
                <div className="bg-[#1d2930]/40 border border-[#2e404a] rounded-xl p-5 space-y-6">
                  <p className="text-xs text-logisnext-lightslate font-medium">
                    {t('camara_debug_desc')}
                  </p>
                  <button
                    onClick={() => {
                      if (window.__cameraPos && window.__cameraTarget) {
                        setCameraCoords({
                          pos: window.__cameraPos,
                          target: window.__cameraTarget
                        });
                      } else {
                        alert(t('mover_camara_aviso'));
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    {t('obtener_posicion')}
                  </button>

                  {cameraCoords && (
                    <div className="mt-4 p-4 bg-black/50 border border-blue-500/30 rounded-lg">
                      <p className="text-xs text-blue-400 font-mono mb-2">/* Copia esto y mándaselo al asistente */</p>
                      <pre className="text-xs text-white font-mono break-all whitespace-pre-wrap">
{`Camera Position:
X: ${cameraCoords.pos.x.toFixed(3)}
Y: ${cameraCoords.pos.y.toFixed(3)}
Z: ${cameraCoords.pos.z.toFixed(3)}

Camera Target (Mira hacia):
X: ${cameraCoords.target.x.toFixed(3)}
Y: ${cameraCoords.target.y.toFixed(3)}
Z: ${cameraCoords.target.z.toFixed(3)}`}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'basler' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm text-white font-bold uppercase tracking-widest border-b border-logisnext-magenta/50 pb-1 inline-block">
                    {t('config_basler_titulo')}
                  </h3>
                </div>

                <div className="bg-[#1d2930]/40 border border-[#2e404a] rounded-xl p-5 space-y-6">
                  <p className="text-xs text-logisnext-lightslate font-medium">
                    {t('config_basler_desc')}
                  </p>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">
                      {t('ip_opcional')}
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 192.168.0.100"
                      value={baslerIp}
                      onChange={(e) => setBaslerIp(e.target.value)}
                      className="bg-[#0a0f12] border border-[#2e404a] rounded-lg px-4 py-3 text-white text-sm font-mono outline-none focus:border-logisnext-magenta transition-colors w-1/2"
                    />
                  </div>
                  
                  <div className="pt-2 flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-4">
                      {baslerTestResult && (
                        <div className={`text-xs px-3 py-1.5 rounded bg-[#1d2930]/80 border ${
                          baslerTestResult.status === 'ok' ? 'text-green-400 border-green-500/30' : 
                          baslerTestResult.status === 'warning' ? 'text-yellow-400 border-yellow-500/30' : 'text-red-400 border-red-500/30'
                        } flex-1 overflow-hidden text-ellipsis whitespace-nowrap`} title={baslerTestResult.message}>
                          {baslerTestResult.message}
                        </div>
                      )}
                      {!baslerTestResult && <div className="flex-1"></div>}
                      
                      <button
                        onClick={handleTestBasler}
                        disabled={isBaslerTesting}
                        className="flex items-center gap-2 px-4 py-2 border border-[#2e404a] hover:bg-[#2e404a] text-logisnext-lightslate hover:text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 shrink-0"
                      >
                        <TestTube size={14} className={isBaslerTesting ? "animate-spin" : ""} />
                        {isBaslerTesting ? t('diagnosticando') : t('diagnostico_camara')}
                      </button>
                    </div>

                    {baslerPreviewUrl && (
                      <div className="mt-4 border border-[#2e404a] rounded-lg overflow-hidden bg-black flex flex-col items-center justify-center relative min-h-[200px]">
                        <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-black/60 text-white text-[10px] font-mono rounded backdrop-blur flex items-center gap-2">
                           <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]"></span>
                           {t('preview_basler')}
                        </div>
                        <img 
                           src={baslerPreviewUrl} 
                           alt="Previsualización Basler" 
                           className="max-h-[300px] w-auto object-contain"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'lenguajes' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm text-white font-bold uppercase tracking-widest border-b border-logisnext-magenta/50 pb-1 inline-block">
                    {t('configurar_idioma')}
                  </h3>
                </div>
                <div className="bg-[#1d2930]/40 border border-[#2e404a] rounded-xl p-5 space-y-6">
                  <p className="text-xs text-logisnext-lightslate font-medium">
                    {t('seleccione_idioma')}
                  </p>
                  <div className="flex flex-col gap-4">
                    <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                      language === 'es' ? 'bg-[#1d2930] border-logisnext-magenta text-white shadow-[0_0_15px_rgba(221,40,118,0.2)]' : 'border-[#2e404a] text-logisnext-slate hover:border-[#5d7a8a]'
                    }`}>
                      <input type="radio" name="appLanguage" value="es" checked={language === 'es'} onChange={() => setLanguage('es')} className="hidden" />
                      <span className="text-xs font-black uppercase tracking-wider">{t('castellano_op')}</span>
                    </label>
                    <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                      language === 'en' ? 'bg-[#1d2930] border-logisnext-magenta text-white shadow-[0_0_15px_rgba(221,40,118,0.2)]' : 'border-[#2e404a] text-logisnext-slate hover:border-[#5d7a8a]'
                    }`}>
                      <input type="radio" name="appLanguage" value="en" checked={language === 'en'} onChange={() => setLanguage('en')} className="hidden" />
                      <span className="text-xs font-black uppercase tracking-wider">{t('ingles_op')}</span>
                    </label>
                    <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                      language === 'ja' ? 'bg-[#1d2930] border-logisnext-magenta text-white shadow-[0_0_15px_rgba(221,40,118,0.2)]' : 'border-[#2e404a] text-logisnext-slate hover:border-[#5d7a8a]'
                    }`}>
                      <input type="radio" name="appLanguage" value="ja" checked={language === 'ja'} onChange={() => setLanguage('ja')} className="hidden" />
                      <span className="text-xs font-black uppercase tracking-wider">{t('japones_op')}</span>
                    </label>
                  </div>
                  <p className="text-[10px] text-logisnext-slate">
                    {t('idioma_nota')}
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#2e404a] bg-[#0a0f12]/80 shrink-0">
          <button onClick={onClose} className="text-[10px] text-logisnext-slate hover:text-white uppercase tracking-widest font-bold transition-colors">
            {t('cancelar')}
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2 bg-logisnext-magenta hover:bg-logisnext-magenta/80 text-white text-xs font-black uppercase tracking-wider rounded-lg transition-all shadow-[0_0_20px_rgba(221,40,118,0.4)]"
          >
            <Save size={14} /> {t('guardar')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
