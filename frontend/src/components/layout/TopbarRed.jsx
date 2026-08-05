import { useMemo, useRef, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Bell } from 'lucide-react';
import { useData } from '../../context/DataContext.jsx';
import { matchDocentes } from '../../lib/search.js';

// Equivalente ruta -> título del breadcrumb, reemplaza el objeto TITLES que
// antes se indexaba por `view` (useState local). Se completan Gestión de
// Docentes y Configuración, que antes quedaban sin título (TITLES no las
// tenía) — mismo breadcrumb vacío para esas dos vistas, corregido de paso al
// tener que reescribir este mapeo de todas formas.
const TITLES = {
  '/': 'Resumen General',
  '/evaluacion-docente': 'Evaluación Docente',
  '/gestion-docentes': 'Gestión de Docentes',
  '/cursos-y-programas': 'Cursos y Programas',
  '/configuracion': 'Configuración',
};

export default function TopbarRed({ onSelectDocente }) {
  const { groupRows: rows } = useData();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const matches = useMemo(() => matchDocentes(rows, query), [rows, query]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (docenteName) => {
    const row = rows.find((r) => r.docente === docenteName);
    if (row) onSelectDocente({ programa: row.programa, docente: row.docente });
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="no-print text-white px-5 py-3 flex items-center justify-between shrink-0 bg-primary">
      <div className="text-xs font-medium text-primary-mid">
        Sistema de Evaluación Docente
        <span className="mx-2 opacity-50">/</span>
        <span className="text-white font-semibold">{TITLES[location.pathname] || ''}</span>
      </div>
      <div className="flex items-center gap-2">
        <div ref={wrapperRef} className="relative">
          <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs bg-white/15 focus-within:bg-white/25">
            <Search size={11} className="text-primary-mid shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              placeholder="Buscar docente..."
              className="bg-transparent outline-none placeholder-primary-mid text-white text-xs w-40"
            />
          </div>
          {open && query.trim() && (
            <ul className="list-none m-0 p-0 absolute right-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-30 max-h-64 overflow-y-auto">
              {matches.length > 0 ? (
                matches.map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => handleSelect(name)}
                      className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      {name}
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-xs text-slate-400">Sin resultados</li>
              )}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={() => alert('Próximamente')}
          className="relative w-8 h-8 flex items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 transition-colors"
        >
          <Bell size={14} className="text-primary-mid" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-white rounded-full" />
        </button>
      </div>
    </div>
  );
}
