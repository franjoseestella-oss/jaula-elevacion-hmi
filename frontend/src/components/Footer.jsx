import React from 'react';
import { Power, AlertTriangle } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="h-24 bg-gradient-to-t from-[#0a0f12] to-[#151f25] border-t border-[#2e404a] flex items-center justify-between px-8 shrink-0 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] relative">
      
      {/* Decorative Line */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#5d7a8a] to-transparent opacity-30"></div>

      {/* Hardware Status Indicator */}
      <div className="flex items-center gap-6">
        <div className="flex gap-3 bg-[#0a0f12] p-3 rounded-xl border border-[#1a262d] shadow-inner">
          <div className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-red-900 border-2 border-[#1a262d] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] opacity-30"></div>
            <span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">ERR</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-yellow-900 border-2 border-[#1a262d] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] opacity-30"></div>
            <span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">WRN</span>
          </div>
          <div className="flex flex-col items-center gap-1 relative">
            <div className="w-8 h-8 rounded-full bg-green-500 border-2 border-green-300 shadow-[0_0_20px_#22c55e,inset_0_2px_4px_rgba(255,255,255,0.5)]"></div>
            <span className="text-[8px] font-bold text-green-400 uppercase tracking-widest text-glow-green">RDY</span>
            <div className="absolute top-1 left-1 w-2 h-2 bg-white rounded-full opacity-50 blur-[1px]"></div>
          </div>
        </div>
        
        <div className="flex flex-col">
          <span className="text-[10px] text-logisnext-lightslate font-bold tracking-widest uppercase mb-1">Status Global</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-white font-black uppercase tracking-wider">PRUEBA EN CURSO</span>
          </div>
        </div>
      </div>



    </footer>
  );
};

export default Footer;
