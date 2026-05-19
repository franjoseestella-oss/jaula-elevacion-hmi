import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, RefreshCw, AlertTriangle, Maximize2, Minimize2, Settings, CheckCircle2 } from 'lucide-react';

const BaslerModal = ({ isOpen, open, onClose, serverUrl = "http://localhost:8001" }) => {
  const isModalOpen = isOpen || open;
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [ipAddress, setIpAddress] = useState(() => localStorage.getItem('baslerIp') || "");
  const [diagResult, setDiagResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('baslerIp', ipAddress);
  }, [ipAddress]);

  const fetchImage = async () => {
    try {
      setLoading(true);
      setError(null);
      // We will create an endpoint in the backend to serve the camera image
      const response = await fetch(`${serverUrl}/api/basler/capture`);
      
      if (!response.ok) {
        throw new Error('Error al capturar la imagen de la cámara Basler');
      }
      
      const data = await response.json();
      setImageSrc(data.image);
      setDiagResult(null); // Clear errors if image fetched successfully
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error de conexión con la cámara');
    } finally {
      setLoading(false);
    }
  };

  const handleDiagnostics = async () => {
    try {
      setIsTesting(true);
      setError(null);
      setDiagResult(null);
      
      // Save IP first if provided
      if (ipAddress) {
        await fetch(`${serverUrl}/api/basler/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ip: ipAddress })
        });
      }

      // Check status
      const res = await fetch(`${serverUrl}/api/basler/status`);
      if (!res.ok) throw new Error("Error HTTP " + res.status);
      const data = await res.json();
      
      if (data.connected) {
        setDiagResult({ status: 'ok', message: data.message || 'Cámara Basler detectada y conectada.' });
        fetchImage(); // auto-fetch image
      } else {
        setDiagResult({ status: 'error', message: data.message || 'No se ha detectado la cámara.' });
      }
    } catch (err) {
      setDiagResult({ status: 'error', message: 'Error de diagnóstico: ' + err.message });
    } finally {
      setIsTesting(false);
    }
  };

  useEffect(() => {
    if (isModalOpen) {
      fetchImage();
    } else {
      setImageSrc(null);
      setError(null);
      setAutoRefresh(false);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isModalOpen]);

  useEffect(() => {
    if (autoRefresh && isModalOpen) {
      intervalRef.current = setInterval(() => {
        fetchImage();
      }, 1000); // Poll every 1 second
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, isModalOpen]);

  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div 
        className={`bg-[#0a0f12] border border-[#2e404a] flex flex-col shadow-2xl transition-all duration-300 ${
          isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-5xl rounded-2xl max-h-[90vh]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e404a] bg-gradient-to-r from-[#151f25] to-[#0a0f12] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-logisnext-magenta/20 rounded-lg border border-logisnext-magenta/30">
              <Camera size={24} className="text-logisnext-magenta" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-widest">
                VISOR <span className="text-logisnext-magenta">BASLER</span>
              </h2>
              <p className="text-xs text-logisnext-slate">Configuración y Monitorización</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-[#050a0e] rounded-lg border border-[#2e404a] p-1">
              <input 
                type="text" 
                placeholder="IP de la Cámara"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                className="bg-transparent text-white px-3 py-1 text-sm outline-none w-36 font-mono placeholder-logisnext-slate/50"
              />
              <button
                onClick={handleDiagnostics}
                disabled={isTesting}
                className="flex items-center gap-2 px-3 py-1 bg-logisnext-magenta/20 text-logisnext-magenta rounded hover:bg-logisnext-magenta/40 transition-colors text-xs font-bold whitespace-nowrap disabled:opacity-50"
              >
                {isTesting ? <RefreshCw size={14} className="animate-spin" /> : <Settings size={14} />}
                DIAGNÓSTICO
              </button>
            </div>
            
            <div className="w-[1px] h-6 bg-[#2e404a]"></div>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-bold transition-colors ${
                autoRefresh 
                  ? 'bg-green-500/20 text-green-400 border-green-500/50' 
                  : 'bg-[#1d2930] text-logisnext-slate border-[#2e404a] hover:text-white'
              }`}
            >
              <RefreshCw size={14} className={autoRefresh ? 'animate-spin' : ''} />
              {autoRefresh ? 'LIVE' : 'ACTUALIZAR AUTO'}
            </button>
            
            <button
              onClick={fetchImage}
              disabled={loading || autoRefresh}
              className="p-2 rounded-lg bg-[#1d2930] border border-[#2e404a] text-white hover:bg-logisnext-magenta hover:border-logisnext-magenta transition-colors disabled:opacity-50"
              title="Capturar un frame"
            >
              <Camera size={20} />
            </button>
            
            <div className="w-[1px] h-6 bg-[#2e404a]"></div>
            
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-lg text-logisnext-slate hover:text-white hover:bg-[#1d2930] transition-colors"
            >
              {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>

            <button 
              onClick={onClose}
              className="p-2 rounded-lg text-logisnext-slate hover:text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center p-4">
          {loading && !imageSrc && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
              <RefreshCw size={48} className="text-logisnext-magenta animate-spin mb-4" />
              <p className="text-white font-mono tracking-widest animate-pulse">CONECTANDO A CÁMARA BASLER...</p>
            </div>
          )}

          {error && !diagResult && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80">
              <AlertTriangle size={64} className="text-red-500 mb-4" />
              <p className="text-xl font-bold text-white mb-2">ERROR DE CONEXIÓN</p>
              <p className="text-red-400 font-mono text-center max-w-md">{error}</p>
              <button 
                onClick={fetchImage}
                className="mt-6 px-6 py-2 bg-[#1d2930] border border-[#2e404a] text-white rounded-lg hover:bg-[#2e404a] transition-colors font-bold"
              >
                REINTENTAR CAPTURA
              </button>
            </div>
          )}

          {diagResult && (
            <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl animate-fade-in
              ${diagResult.status === 'ok' ? 'bg-green-500/20 border border-green-500/50 text-green-400' : 'bg-red-500/20 border border-red-500/50 text-red-400'}`}>
              {diagResult.status === 'ok' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
              <span className="font-mono text-sm">{diagResult.message}</span>
              <button onClick={() => setDiagResult(null)} className="ml-2 hover:opacity-70"><X size={16} /></button>
            </div>
          )}

          {imageSrc && (
            <img 
              src={imageSrc} 
              alt="Basler Camera Feed" 
              className={`max-w-full max-h-full object-contain ${loading ? 'opacity-50' : 'opacity-100'} transition-opacity`}
            />
          )}

          {!imageSrc && !loading && !error && (
            <div className="text-logisnext-slate flex flex-col items-center">
              <Camera size={64} className="opacity-20 mb-4" />
              <p className="font-mono tracking-widest opacity-50">NO HAY IMAGEN DISPONIBLE</p>
            </div>
          )}
        </div>
        
        {/* Footer info */}
        <div className="px-4 py-2 bg-[#0a0f12] border-t border-[#2e404a] flex items-center justify-between text-xs text-logisnext-slate shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]"></span>
            <span className="font-mono">Pypylon SDK Active</span>
          </div>
          <div className="font-mono">
            {imageSrc ? 'FRAME RECIBIDO' : 'ESPERANDO...'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BaslerModal;
