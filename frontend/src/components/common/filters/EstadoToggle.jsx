const DEFAULT_ITEMS = [
  { key: 'aprobado', label: 'Aprobados', color: '#16a34a' },
  { key: 'desaprobado', label: 'Desaprobados', color: '#e11d48' },
];

// items/filterKey/groupLabel son opcionales (default = comportamiento
// original de Aprobados/Desaprobados en docente/FilterPanel.jsx y
// director/Filters.jsx) para poder reutilizar el mismo switch visual en
// otros filtros de dos estados, p. ej. Con/Sin encuestas en curso/CursoFilterPanel.jsx.
export default function EstadoToggle({ estado, onChange, items = DEFAULT_ITEMS, filterKey = 'estado', groupLabel = 'Estado' }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{groupLabel}</span>
      <div className="flex items-center gap-4">
        {items.map((s) => {
          const active = estado === s.key;
          return (
            <button key={s.key} type="button" onClick={() => onChange(filterKey, s.key)} className="flex items-center gap-2 select-none">
              <div className="w-9 h-5 rounded-full transition-all relative shrink-0" style={{ backgroundColor: active ? s.color : '#cbd5e1' }}>
                <div className="w-3.5 h-3.5 bg-white rounded-full shadow-sm absolute top-[3px] transition-all duration-200" style={{ left: active ? 'calc(100% - 17px)' : '3px' }} />
              </div>
              <span className="text-xs font-semibold transition-colors" style={{ color: active ? s.color : '#94a3b8' }}>{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
