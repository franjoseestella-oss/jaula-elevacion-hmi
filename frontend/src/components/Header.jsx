import React from 'react';
import { Activity, Database, Camera, Server, Settings, Zap } from 'lucide-react';

const StatusLED = ({ active, label, icon: Icon, onClick }) => (
  <div
    className={`flex flex-col items-center justify-center gap-1 min-w-[60px] relative group ${onClick ? 'cursor-pointer' : ''}`}
    onClick={onClick}
  >
    <Icon size={18} className={`transition-all duration-300 ${active ? 'text-logisnext-magenta drop-shadow-[0_0_5px_rgba(221,40,118,0.8)]' : 'text-logisnext-slate opacity-50'} ${onClick ? 'group-hover:opacity-100 group-hover:scale-110' : ''}`} />
    <span className={`text-[9px] font-bold tracking-wider uppercase transition-colors duration-300 ${active ? 'text-white' : 'text-gray-500'}`}>{label}</span>
    {/* Status Indicator Bar */}
    <div className={`absolute -bottom-2 w-full h-[2px] rounded-full transition-all duration-500 ${active ? 'bg-logisnext-magenta shadow-[0_0_8px_#dd2876]' : 'bg-transparent'}`}></div>
  </div>
);

const Header = ({ status, onErpClick, onSettingsClick, operario, onOperatorClick, canChangeOperator }) => {
  return (
    <header className="h-20 bg-gradient-to-b from-[#151f25] to-[#11191e] border-b border-[#2e404a] flex items-center justify-between px-8 shrink-0 z-20 relative">
      {/* Accent Top Border */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-logisnext-magenta to-transparent opacity-50"></div>
      
      <div className="flex items-center gap-6">
        {/* Corporate Logo */}
        <div className="relative flex items-center justify-center h-12 group cursor-pointer overflow-hidden">
          <img src="/IMAGE/LOGO.PNG" alt="Logisnext Logo" className="h-full w-auto object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" />
        </div>
        
        <div className="flex flex-col justify-center">
          <h1 className="text-xl font-black tracking-widest text-white drop-shadow-md">
            PRUEBAS DE ELEVACIÓN <span className="text-logisnext-lightslate font-light">| FORKLIFT</span>
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-10">
        {/* Systems Array */}
        <div className="flex items-center gap-6 bg-[#0a0f12] px-6 py-2.5 rounded-xl border border-[#1a262d] shadow-inner">
          <div className="flex items-center gap-2 mr-2">
            <Zap size={14} className="text-logisnext-lightslate animate-pulse" />
            <span className="text-[10px] text-logisnext-lightslate font-bold uppercase tracking-widest">SYS LINK</span>
          </div>
          <div className="w-[1px] h-8 bg-[#2e404a]"></div>
          <StatusLED active={status.opc} label="OPC UA" icon={Activity} />
          <StatusLED active={status.basler} label="BASLER" icon={Camera} />
          <StatusLED active={status.db} label="SQL DB" icon={Database} />
          <StatusLED active={status.erp} label="ERP" icon={Server} onClick={onErpClick} />
        </div>

        {/* User Profile */}
        <div 
          className={`flex items-center gap-3 bg-[#1d2930] pr-4 rounded-full border border-[#2e404a] transition-all duration-300 ${
            canChangeOperator 
              ? 'hover:bg-[#2e404a] cursor-pointer shadow-[0_0_10px_rgba(255,255,255,0.05)] hover:border-gray-500' 
              : 'opacity-80 cursor-not-allowed'
          }`} 
          onClick={canChangeOperator ? onOperatorClick : undefined}
          title={canChangeOperator ? "Cambiar Operario" : "Finaliza o aborta la secuencia actual para cambiar operario"}
        >
          <div className="w-10 h-10 bg-gradient-to-tr from-logisnext-slate to-logisnext-darkslate rounded-full flex items-center justify-center border-2 border-[#151f25] shadow-sm">
            <span className="text-xs font-bold text-white">
              {operario ? operario.APELLIDOS?.substring(0,2).toUpperCase() : 'OP'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm text-white leading-tight">
              {operario ? operario.APELLIDOS : 'Identificándose...'}
            </span>
            <span className="text-[10px] text-green-400 font-bold uppercase tracking-wider">
              {operario ? `CÓD. ${operario.CODIGO}` : 'Autorizado'}
            </span>
          </div>
        </div>

        {/* Settings button */}
        <button 
          onClick={onSettingsClick}
          className="p-2.5 bg-[#1d2930] hover:bg-[#2e404a] rounded-full border border-[#2e404a] text-logisnext-lightslate hover:text-white transition-colors cursor-pointer"
          title="Ajustes del sistema"
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
};

export default Header;
