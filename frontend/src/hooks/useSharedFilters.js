import { useMemo, useState } from 'react';
import { CATEGORIA_ORDER } from '../data/constants.js';
import { classifyDocentesByEstado } from '../lib/stats.js';
import { useData } from '../context/DataContext.jsx';

/* Filtros compartidos entre Resumen General y Evaluación Docente: Categoría,
   Programa, Ciclo (multi-selección), Sección, Docente, Estado. Adaptado de
   useDirectorFilters.js (misma cascada, portada originalmente de
   reference/dashboard_evaluacion_docente.html: getDirectorFilteredRows/
   refreshDirectorFilterOptions), sin el campo Aula (se elimina como criterio
   de filtro; la columna Aula en tablas/exports no cambia) y con Ciclo como
   array en vez de string.

   Se levanta a App.jsx y se pasa a DirectorView (que sigue filtrando en vivo,
   sin cambios de comportamiento) y a useDocenteSelection (que lo trata como
   un borrador compartido: sus cambios solo se reflejan en el reporte de
   Evaluación Docente al presionar su propio "Aplicar"). Ver
   docs/superpowers/specs/2026-07-23-filtros-compartidos-design.md */

const rowCategoria = (r) => r.categoria || 'Sin categoría';
const FILTER_KEYS = ['categoria', 'programa', 'ciclo', 'seccion', 'docente'];
const EMPTY_FILTERS = { categoria: '', programa: '', ciclo: [], seccion: '', docente: '', estado: null };

function uniqueSorted(rows, field) {
  return Array.from(new Set(rows.map((r) => r[field]))).sort((a, b) => String(a).localeCompare(String(b), 'es'));
}

export function useSharedFilters(rows) {
  const { politica } = useData();
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const setFilter = (key, value) => {
    setFilters((prev) => {
      if (key === 'estado') {
        return { ...prev, estado: prev.estado === value ? null : value };
      }
      const next = { ...prev, [key]: value };
      const idx = FILTER_KEYS.indexOf(key);
      if (idx !== -1) {
        for (let j = idx + 1; j < FILTER_KEYS.length; j++) {
          next[FILTER_KEYS[j]] = FILTER_KEYS[j] === 'ciclo' ? [] : '';
        }
      }
      return next;
    });
  };

  const toggleCiclo = (value) => {
    setFilters((prev) => {
      const ciclo = prev.ciclo.includes(value) ? prev.ciclo.filter((c) => c !== value) : [...prev.ciclo, value];
      return { ...prev, ciclo, seccion: '', docente: '' };
    });
  };

  const clearCiclo = () => setFilters((prev) => ({ ...prev, ciclo: [], seccion: '', docente: '' }));

  const setMany = (partial) => setFilters((prev) => ({ ...prev, ...partial }));

  const reset = () => setFilters(EMPTY_FILTERS);

  const rowsFilteredByEstado = useMemo(() => {
    if (!filters.estado) return rows;
    const classification = classifyDocentesByEstado(rows, politica.umbral_aprobacion);
    return rows.filter((r) => classification.get(r.docente) === filters.estado);
  }, [rows, filters.estado, politica]);

  const { options, rowsBeforeDocente, filteredRows } = useMemo(() => {
    const rowsForCategoria = rowsFilteredByEstado;
    const categoriasDisponibles = new Set(rowsForCategoria.map(rowCategoria));
    const categoria = CATEGORIA_ORDER.filter((c) => categoriasDisponibles.has(c));

    const rowsForPrograma = rowsForCategoria.filter((r) => !filters.categoria || rowCategoria(r) === filters.categoria);
    const programa = uniqueSorted(rowsForPrograma, 'programa');

    const rowsForCiclo = rowsForPrograma.filter((r) => !filters.programa || r.programa === filters.programa);
    const ciclo = uniqueSorted(rowsForCiclo, 'ciclo');

    const rowsForSeccion = rowsForCiclo.filter((r) => filters.ciclo.length === 0 || filters.ciclo.includes(r.ciclo));
    const seccion = uniqueSorted(rowsForSeccion, 'seccion');

    const rowsForDocente = rowsForSeccion.filter((r) => !filters.seccion || r.seccion === filters.seccion);
    const docente = uniqueSorted(rowsForDocente, 'docente');

    const filteredRows = rowsForDocente.filter((r) => !filters.docente || r.docente === filters.docente);

    return {
      options: { categoria, programa, ciclo, seccion, docente },
      rowsBeforeDocente: rowsForDocente,
      filteredRows,
    };
  }, [rowsFilteredByEstado, filters.categoria, filters.programa, filters.ciclo, filters.seccion, filters.docente]);

  return { filters, setFilter, toggleCiclo, clearCiclo, setMany, reset, options, filteredRows, rowsBeforeDocente };
}
