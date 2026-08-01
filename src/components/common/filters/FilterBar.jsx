import { useState } from 'react';
import { ChevronDown, Layers, X } from 'lucide-react';

export default function FilterBar({ activeCount, hasActive, onReset, children }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="no-print sticky top-0 z-10 bg-white border-b border-slate-200 shrink-0 w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-5 py-2.5 flex items-center gap-2 hover:bg-slate-50 transition-colors"
      >
        <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 bg-primary">
          <Layers size={11} className="text-white" />
        </div>
        <span className="text-xs font-bold text-slate-700">Filtros del reporte</span>
        {activeCount > 0 && (
          <span className="ml-1.5 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full bg-primary">
            {activeCount}
          </span>
        )}
        <span className="ml-auto text-[10px] text-slate-400 font-medium">{open ? 'Ocultar' : 'Mostrar'}</span>
        <ChevronDown size={12} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 py-3 bg-slate-50 flex flex-wrap gap-x-5 gap-y-3 items-end">
          {children}
          {hasActive && (
            <button
              type="button"
              onClick={onReset}
              className="self-end ml-auto flex items-center gap-1.5 text-slate-500 hover:text-slate-700 border border-slate-200 bg-white hover:border-slate-300 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
            >
              <X size={10} /> Limpiar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}
