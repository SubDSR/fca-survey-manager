import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export default function CicloMultiSelect({ label = 'Ciclo académico', ciclos, options, onToggle, onClear }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const sorted = [...ciclos].sort((a, b) => String(a).localeCompare(String(b), 'es'));

  return (
    <div ref={ref} className="flex flex-col gap-1 relative">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 bg-white border rounded-lg px-3 py-1.5 text-xs transition-colors min-w-[180px] ${open ? 'border-primary' : 'border-slate-200 hover:border-slate-300'}`}
      >
        {ciclos.length === 0 ? (
          <span className="text-slate-400 flex-1 text-left">Seleccionar ciclos…</span>
        ) : (
          <span className="flex-1 text-left text-slate-700 font-semibold flex items-center gap-1.5">
            Ciclo {sorted.join(', ')}
            <span className="text-[9px] font-black text-white px-1.5 py-0.5 rounded-full bg-primary">
              {ciclos.length}
            </span>
          </span>
        )}
        <ChevronDown size={11} className={`shrink-0 transition-transform text-slate-400 ${open ? 'rotate-180 text-primary' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[200px] bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
          <ul className="list-none m-0 p-0 max-h-52 overflow-y-auto py-1">
            {options.map((c) => {
              const checked = ciclos.includes(c);
              return (
                <li key={c}>
                  <label className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(c)}
                      className="w-3.5 h-3.5 accent-primary shrink-0"
                    />
                    <span className={checked ? 'font-bold text-primary' : ''}>Ciclo {c}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {ciclos.length > 0 && (
            <div className="border-t border-slate-100 px-3 py-2">
              <button
                type="button"
                onClick={onClear}
                className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors font-medium"
              >
                Limpiar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
