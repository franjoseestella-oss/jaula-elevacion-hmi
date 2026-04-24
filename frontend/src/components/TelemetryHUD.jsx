import React from 'react';
import { Target, Clock } from 'lucide-react';

const TelemetryHUD = ({ telemetry }) => {
  return (
    <div className="absolute top-6 left-6 right-6 flex justify-between z-10 pointer-events-none">
      
      {/* Distance Telemetry */}
      <div className="glass-panel p-5 rounded-xl w-72 pointer-events-auto relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-logisnext-magenta shadow-[0_0_10px_#dd2876]"></div>
        
        <div className="flex items-center gap-2 mb-2">
          <Target size={14} className="text-logisnext-magenta animate-pulse" />
          <h3 className="text-logisnext-lightslate text-[10px] font-black uppercase tracking-[0.2em]">Laser Sensor (Y)</h3>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-mono font-black text-white tracking-tighter drop-shadow-md">
            {telemetry.distance.toFixed(0).padStart(4, '0')}
          </span>
          <span className="text-logisnext-magenta font-bold text-lg">mm</span>
        </div>
        
        {/* Decorative Grid Line */}
        <div className="absolute bottom-0 right-0 opacity-10 pointer-events-none">
          <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
            <path d="M54.627 0l.83.83v58.34h-58.34l-.83-.83L54.627 0zM52.96 3.32L3.32 52.96v1.68h49.64V3.32z" fill="#dd2876" fillRule="evenodd"/>
          </svg>
        </div>
      </div>

      {/* Timer Telemetry */}
      <div className="glass-panel p-5 rounded-xl w-72 pointer-events-auto text-right relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-full h-[2px] bg-green-500 shadow-[0_0_10px_#22c55e]"></div>
        
        <div className="flex items-center justify-end gap-2 mb-2">
          <h3 className="text-logisnext-lightslate text-[10px] font-black uppercase tracking-[0.2em]">Cycle Time</h3>
          <Clock size={14} className="text-green-500" />
        </div>

        <div className="flex items-baseline justify-end gap-2">
          <span className="text-5xl font-mono font-black text-white tracking-tighter drop-shadow-md">
            {telemetry.timer.toFixed(2).padStart(5, '0')}
          </span>
          <span className="text-green-500 font-bold text-lg">s</span>
        </div>
        
        <div className="mt-2 inline-block bg-green-500/10 border border-green-500/30 px-3 py-1 rounded-full">
          <p className="text-[10px] text-green-400 font-black uppercase tracking-widest">{telemetry.state}</p>
        </div>
      </div>

    </div>
  );
};

export default TelemetryHUD;
