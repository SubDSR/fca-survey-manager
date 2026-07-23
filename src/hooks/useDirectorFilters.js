import { useMemo, useState } from 'react';

/* Portado desde reference/dashboard_evaluacion_docente.html:
   - cascada de filtros: getDirectorFilteredRows / refreshDirectorFilterOptions (~1446-1482, 1419-1428)
   - listeners de filtros/orden/búsqueda: setupDirectorFilters (~2996-3030)
   - reset: resetDirectorFiltersState (~2936-2941) */

const FILTER_KEYS = ['categoria', 'programa', 'ciclo', 'seccion', 'aula', 'docente'];
const EMPTY_FILTERS = { categoria: '', programa: '', ciclo: '', seccion: '', aula: '', docente: '', estado: null };
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
      // Tri-state logic for estado
      if (key === 'estado') {
        return { ...prev, estado: prev.estado === value ? null : value };
      }

      const next = { ...prev, [key]: value };
      const idx = FILTER_KEYS.indexOf(key);
      if (idx !== -1) {
        for (let j = idx + 1; j < FILTER_KEYS.length; j++) next[FILTER_KEYS[j]] = '';
      }
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

  const rowsFilteredByEstado = useMemo(() => {
    if (!filters.estado) return rows;

    const docenteMap = new Map();
    rows.forEach(r => {
      if (!docenteMap.has(r.docente)) docenteMap.set(r.docente, { sum: 0, count: 0 });
      const d = docenteMap.get(r.docente);
      d.sum += r.notaFinal;
      d.count += 1;
    });

    return rows.filter(r => {
      const stat = docenteMap.get(r.docente);
      const avgAprob = (stat.sum / stat.count) >= 14;
      if (filters.estado === 'aprobado') return avgAprob;
      if (filters.estado === 'desaprobado') return !avgAprob;
      return true;
    });
  }, [rows, filters.estado]);

  // Cascada
  const options = useMemo(() => {
    const rowsForCategoria = rowsFilteredByEstado;
    const categoria = Array.from(new Set(rowsForCategoria.map(r => r.categoria || 'Sin categoría'))).sort();

    const rowsForPrograma = rowsForCategoria.filter((r) => !filters.categoria || (r.categoria || 'Sin categoría') === filters.categoria);
    const programa = uniqueSorted(rowsForPrograma, 'programa');

    const rowsForCiclo = rowsForPrograma.filter((r) => !filters.programa || r.programa === filters.programa);
    const ciclo = uniqueSorted(rowsForCiclo, 'ciclo');

    const rowsForSeccion = rowsForCiclo.filter((r) => !filters.ciclo || r.ciclo === filters.ciclo);
    const seccion = uniqueSorted(rowsForSeccion, 'seccion');

    const rowsForAula = rowsForSeccion.filter((r) => !filters.seccion || r.seccion === filters.seccion);
    const aula = uniqueSorted(rowsForAula, 'aula');

    const rowsForDocente = rowsForAula.filter((r) => !filters.aula || r.aula === filters.aula);
    const docente = uniqueSorted(rowsForDocente, 'docente');

    return { categoria, programa, ciclo, seccion, aula, docente };
  }, [rowsFilteredByEstado, filters.categoria, filters.programa, filters.ciclo, filters.seccion, filters.aula]);

  const filteredRows = useMemo(() => {
    return rowsFilteredByEstado.filter((r) => (
      (!filters.categoria || (r.categoria || 'Sin categoría') === filters.categoria)
      && (!filters.programa || r.programa === filters.programa)
      && (!filters.ciclo || r.ciclo === filters.ciclo)
      && (!filters.seccion || r.seccion === filters.seccion)
      && (!filters.aula || r.aula === filters.aula)
      && (!filters.docente || r.docente === filters.docente)
    ));
  }, [rowsFilteredByEstado, filters]);

  return { filters, setFilter, reset, search, setSearch, sort, setSort, filteredRows, options };
}
