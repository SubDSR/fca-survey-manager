import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

function normalizeOption(option) {
  return typeof option === 'object' && option !== null
    ? { value: option.value, label: option.label ?? option.value }
    : { value: option, label: option };
}

export default function Dropdown({ label, value, options, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const ref = useRef(null);

  const normalized = options.map(normalizeOption);
  const selected = normalized.find((o) => o.value === value);
  const filtered = normalized.filter((o) => o.label.toLowerCase().includes(term.toLowerCase()));

  useEffect(() => {
    function onOutside(e) { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setTerm(''); } }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  return (
    <div ref={ref} className="flex flex-col gap-1 w-[160px] shrink-0 relative">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setTerm(''); }}
        className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 hover:border-slate-300 transition-colors"
      >
        <span className="flex-1 min-w-0 truncate text-left">{selected ? selected.label : placeholder}</span>
        <ChevronDown size={10} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[200px] bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
          <input
            autoFocus
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={`Buscar ${label.toLowerCase()}...`}
            className="w-full px-3 py-2 text-xs border-b border-slate-100 outline-none"
          />
          <ul className="list-none m-0 p-0 max-h-52 overflow-y-auto py-1">
            {filtered.length > 0 ? filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); setTerm(''); }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 ${o.value === value ? 'font-bold text-primary' : 'text-slate-700'}`}
                >
                  {o.label}
                </button>
              </li>
            )) : (
              <li className="px-3 py-2 text-xs text-slate-400">Sin resultados</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
