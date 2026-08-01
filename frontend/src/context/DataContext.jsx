import { createContext, useContext, useEffect, useState } from 'react';
import { CRITERIA_LABELS, DIRECTIVE_LABELS, SHORT_CRITERIA_LABELS } from '../data/constants.js';
import { buildRosterFromApi } from '../data/roster.js';
import { buildGroupRows } from '../lib/directorGroups.js';
import { api } from '../services/api.js';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [groupRows, setGroupRows] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  // Roster de docentes (categoría/facultad) cargado desde GET /api/docentes.
  const [roster, setRoster] = useState(new Map());
  // Vistas de detalle por criterio/directiva (GET /api/encuestas/criterios y
  // /directivas), consumidas por RadarPanel/CriteriaChart/DirectivesChart/
  // DirectivesChecklist filtrando por docenteId+asignaturaId+grupoId (ver lib/statsFromViews.js).
  const [criterios, setCriterios] = useState([]);
  const [directivas, setDirectivas] = useState([]);

  // Carga inicial: roster (GET /api/docentes) y consolidado (GET /api/encuestas/
  // consolidado). `groupRows` (un registro por grupo docente+asignatura+ciclo+
  // sección, ya agregado en el backend) es la única fuente de filas de la app —
  // ya no hay un dataset.csv que parsear ni enriquecer con ids de sección.
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    Promise.all([api.docentes.listar(), api.encuestas.consolidado()])
      .then(([docentes, consolidadoData]) => {
        if (cancelled) return;
        const newRoster = buildRosterFromApi(docentes);
        setRoster(newRoster);
        const rows = buildGroupRows(consolidadoData, newRoster);
        setGroupRows(rows);
        setError(null);
        setStatus(rows.length ? 'ready' : 'empty');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('No se pudo cargar docentes/consolidado desde el backend:', err);
        setStatus('error');
        setError('No se pudo cargar los datos desde el servidor.');
      });
    return () => { cancelled = true; };
  }, []);

  // Vistas de criterios/directivas: independientes del consolidado, se cargan
  // una sola vez desde el backend.
  useEffect(() => {
    let cancelled = false;
    api.encuestas.criterios()
      .then((data) => { if (!cancelled) setCriterios(data); })
      .catch((err) => { console.error('No se pudo cargar /api/encuestas/criterios:', err); });
    api.encuestas.directivas()
      .then((data) => { if (!cancelled) setDirectivas(data); })
      .catch((err) => { console.error('No se pudo cargar /api/encuestas/directivas:', err); });
    return () => { cancelled = true; };
  }, []);

  return (
    <DataContext.Provider value={{
      groupRows, roster, criterios, directivas, status, error,
      criteriaLabels: CRITERIA_LABELS, directiveLabels: DIRECTIVE_LABELS, shortCriteriaLabels: SHORT_CRITERIA_LABELS,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData debe usarse dentro de DataProvider');
  return ctx;
}
