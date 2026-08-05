import { useMemo, useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell } from 'lucide-react';
import { useData } from '../../context/DataContext.jsx';
import { matchDocentes } from '../../lib/search.js';
import { api } from '../../services/api.js';

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
  '/configuracion/carga': 'Configuración · Carga de Información',
  '/configuracion/docentes': 'Configuración · Docentes',
  '/configuracion/cursos': 'Configuración · Catálogo de Cursos',
  '/configuracion/programas': 'Configuración · Catálogo de Programas',
};

export default function TopbarRed({ onSelectDocente }) {
  const { groupRows: rows } = useData();
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Campana de notificaciones: incidencias de v_asignaciones_sin_respaldo aún
  // pendientes de revisión (ver GET /api/revisiones). El modal en sí
  // (RevisionResolverModal) ya no vive acá -- lo monta ConfigView.jsx,
  // controlado por el query param ?revision=<id> (única fuente de verdad,
  // así funciona igual si se llega por click en la campana o por URL
  // directa/recarga). Por eso este componente refresca el conteo en cada
  // cambio de ruta: es la señal de que, si el modal de ConfigView resolvió
  // una incidencia y limpió el query param, el badge debe achicarse.
  const [revisiones, setRevisiones] = useState([]);
  const [revisionesOpen, setRevisionesOpen] = useState(false);
  const bellRef = useRef(null);

  const cargarRevisiones = () => {
    api.revisiones.listar({ estado: 'pendiente' })
      .then(setRevisiones)
      .catch((err) => console.error('No se pudo cargar /api/revisiones:', err));
  };

  useEffect(() => { cargarRevisiones(); }, [location]);

  const matches = useMemo(() => matchDocentes(rows, query), [rows, query]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target)) setRevisionesOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cada ítem del panel navega a /configuracion?revision=<id> -- ConfigView.jsx
  // lee ese query param y abre RevisionResolverModal, sin importar en qué
  // sub-ruta de Configuración aterrice el usuario.
  const revisarIncidencia = (id) => {
    setRevisionesOpen(false);
    navigate(`/configuracion?revision=${id}`);
  };

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
        <div ref={bellRef} className="relative">
          <button
            type="button"
            onClick={() => setRevisionesOpen((o) => !o)}
            className="relative w-8 h-8 flex items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 transition-colors"
          >
            <Bell size={14} className="text-primary-mid" />
            {revisiones.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
                {revisiones.length > 99 ? '99+' : revisiones.length}
              </span>
            )}
          </button>
          {revisionesOpen && (
            <div className="absolute right-0 mt-1 w-80 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-30 max-h-96 overflow-y-auto">
              <div className="px-3 py-2 text-xs font-bold text-slate-700 border-b border-slate-100">
                Asignaciones por revisar
              </div>
              {revisiones.length === 0 ? (
                <div className="px-3 py-3 text-xs text-slate-400">No hay incidencias pendientes.</div>
              ) : (
                revisiones.map((r) => (
                  <div key={r.id} className="px-3 py-2 border-b border-slate-100 last:border-b-0">
                    <div className="text-xs font-semibold text-slate-700">{r.docente}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {r.curso} · {r.n_encuestas} encuesta{r.n_encuestas === 1 ? '' : 's'}
                    </div>
                    <button
                      type="button"
                      onClick={() => revisarIncidencia(r.id)}
                      className="mt-1 text-[11px] font-bold text-primary hover:underline"
                    >
                      Revisar →
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
