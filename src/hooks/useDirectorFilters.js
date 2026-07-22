import { useMemo, useState } from 'react';

/* Portado desde reference/dashboard_evaluacion_docente.html:
   - cascada de filtros: getDirectorFilteredRows / refreshDirectorFilterOptions (~1446-1482, 1419-1428)
   - listeners de filtros/orden/búsqueda: setupDirectorFilters (~2996-3030)
   - reset: resetDirectorFiltersState (~2936-2941) */

const FILTER_KEYS = ['programa', 'ciclo', 'seccion', 'aula', 'docente'];
const EMPTY_FILTERS = { programa: '', ciclo: '', seccion: '', aula: '', docente: '' };
const DEFAULT_SORT = { key: 'nota', dir: 'desc' };

function uniqueSorted(rows, field) {
  return Array.from(new Set(rows.map((r) => r[field]))).sort((a, b) => String(a).localeCompare(String(b), 'es'));
}

export function useDirectorFilters(rows) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const [sort, setSortState] = useState(DEFAULT_SORT);

  const setFilter = (key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      const idx = FILTER_KEYS.indexOf(key);
      for (let j = idx + 1; j < FILTER_KEYS.length; j++) next[FILTER_KEYS[j]] = '';
      return next;
    });
  };

  const setSort = (key) => {
    setSortState((prev) => (prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' }));
  };

  const reset = () => {
    setFilters(EMPTY_FILTERS);
    setSearch('');
  };

  // Cascada: programa -> ciclo -> sección -> aula -> docente (cada nivel depende de los anteriores)
  const options = useMemo(() => {
    const rowsForPrograma = rows;
    const programa = uniqueSorted(rowsForPrograma, 'programa');

    const rowsForCiclo = rowsForPrograma.filter((r) => !filters.programa || r.programa === filters.programa);
    const ciclo = uniqueSorted(rowsForCiclo, 'ciclo');

    const rowsForSeccion = rowsForCiclo.filter((r) => !filters.ciclo || r.ciclo === filters.ciclo);
    const seccion = uniqueSorted(rowsForSeccion, 'seccion');

    const rowsForAula = rowsForSeccion.filter((r) => !filters.seccion || r.seccion === filters.seccion);
    const aula = uniqueSorted(rowsForAula, 'aula');

    const rowsForDocente = rowsForAula.filter((r) => !filters.aula || r.aula === filters.aula);
    const docente = uniqueSorted(rowsForDocente, 'docente');

    return { programa, ciclo, seccion, aula, docente };
  }, [rows, filters.programa, filters.ciclo, filters.seccion, filters.aula]);

  const filteredRows = useMemo(() => rows.filter((r) => (
    (!filters.programa || r.programa === filters.programa)
    && (!filters.ciclo || r.ciclo === filters.ciclo)
    && (!filters.seccion || r.seccion === filters.seccion)
    && (!filters.aula || r.aula === filters.aula)
    && (!filters.docente || r.docente === filters.docente)
  )), [rows, filters]);

  return { filters, setFilter, reset, search, setSearch, sort, setSort, filteredRows, options };
}
