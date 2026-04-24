import React from 'react';
import { Layers } from 'lucide-react';

const StepCard = ({ num, title, desc, enabled, onToggle, active }) => (
  <div className={`relative p-4 rounded-xl border transition-all duration-300 overflow-hidden cursor-pointer group
    ${active 
      ? 'border-logisnext-magenta bg-gradient-to-br from-[#2e404a] to-[#1d2930] shadow-[0_0_20px_rgba(221,40,118,0.2)] scale-[1.02]' 
      : 'border-[#2e404a]/50 bg-[#151f25] hover:bg-[#1d2930] opacity-80 hover:opacity-100'}
  `} onClick={onToggle}>
    
    {/* Active Glow Overlay */}
    {active && (
      <div className="absolute top-0 right-0 w-32 h-32 bg-logisnext-magenta opacity-10 rounded-full blur-[40px] pointer-events-none"></div>
    )}

    <div className="flex justify-between items-start mb-3 relative z-10">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shadow-inner transition-colors duration-300
          ${active ? 'bg-logisnext-magenta text-white shadow-[0_0_10px_#dd2876]' : 'bg-[#2e404a] text-gray-400'}`}>
          {num}
        </div>
        <h3 className={`font-black text-sm uppercase tracking-wider ${active ? 'text-white' : 'text-gray-300'}`}>{title}</h3>
      </div>
      
      {/* Custom Sleek Switch */}
      <div onClick={(e) => e.stopPropagation()} className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" className="sr-only peer" checked={enabled} onChange={onToggle} />
        <div className="w-10 h-5 bg-[#0a0f12] peer-focus:outline-none rounded-full peer 
          peer-checked:after:translate-x-full peer-checked:after:border-white 
          after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 
          peer-checked:after:bg-white after:border-gray-500 after:border after:rounded-full 
          after:h-4 after:w-4 after:transition-all peer-checked:bg-logisnext-magenta 
          border border-[#2e404a] shadow-inner"></div>
      </div>
    </div>
    
    <p className={`text-xs leading-relaxed relative z-10 ${active ? 'text-logisnext-lightslate' : 'text-gray-500'}`}>
      {desc}
    </p>

    {/* Progress bar effect if active */}
    {active && (
      <div className="absolute bottom-0 left-0 h-1 bg-logisnext-magenta animate-pulse w-full"></div>
    )}
  </div>
);

const Sequencer = ({ stepsState, setStepsState }) => {
  const steps = [
    { title: "Identidad ERP", desc: "Verificación de bastidor y validación de parámetros NG6OF1." },
    { title: "Calibración Visual", desc: "Ajuste láser y validación de cámara Basler mediante IA." },
    { title: "Confirmación Op.", desc: "Activación del pulsador físico para inicio seguro." },
    { title: "Test CON Carga", desc: "Registro asíncrono OPC UA: Ascenso y Descenso bajo estrés." },
    { title: "Test SIN Carga", desc: "Evaluación de tolerancias libres y volcado de resultados a DB." }
  ];

  const handleToggle = (index) => {
    const newStates = [...stepsState];
    newStates[index] = !newStates[index];
    setStepsState(newStates);
  };

  return (
    <aside className="w-80 bg-gradient-to-b from-[#151f25] to-[#0a0f12] h-full flex flex-col border-l border-[#2e404a] z-10 shrink-0 relative">
      <div className="p-5 bg-[#1d2930]/80 backdrop-blur-md border-b border-[#2e404a] flex items-center gap-3 shadow-lg">
        <div className="p-2 bg-logisnext-slate/20 rounded-md border border-logisnext-slate/40 text-logisnext-lightslate">
          <Layers size={18} />
        </div>
        <div className="flex flex-col">
          <h2 className="font-black text-white uppercase tracking-widest text-sm drop-shadow-md">SECUENCIA</h2>
          <span className="text-[9px] text-logisnext-lightslate font-bold uppercase tracking-widest">Protocolo de Prueba</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
        {steps.map((step, index) => (
          <StepCard 
            key={index}
            num={index + 1}
            title={step.title}
            desc={step.desc}
            enabled={stepsState[index]}
            active={index === 1} // MOCK: Paso 2 activo
            onToggle={() => handleToggle(index)}
          />
        ))}
      </div>
    </aside>
  );
};

export default Sequencer;
