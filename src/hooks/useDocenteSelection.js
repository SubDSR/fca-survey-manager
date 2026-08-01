import { useEffect, useMemo, useRef, useState } from 'react';

/* Selección de la Vista Docente Individual: consume los filtros compartidos
   (Categoría, Programa, Ciclo, Sección, Docente, Estado, ver
   useSharedFilters.js) y gestiona por su cuenta el campo local `curso`
   (single-select). Filtrado en vivo: cualquier cambio (compartido o local)
   se refleja de inmediato en el reporte, igual que Resumen General — sin
   capa de borrador/aplicado.

   NOTA: el filtro de Estado (Aprobado >= 14 / Desaprobado < 14) sólo acota
   qué DOCENTES aparecen en el dropdown; no filtra las filas ya mostradas
   del docente seleccionado. Ver
   docs/superpowers/specs/2026-07-23-filtros-compartidos-design.md */

const GK_SEP = '|||';
const groupKeyParts = (curso, ciclo, seccion) => `${curso}${GK_SEP}${ciclo}${GK_SEP}${seccion}`;
const groupKeyOf = (r) => groupKeyParts(r.curso, r.ciclo, r.seccion);
const groupLabelOf = (r) => `${r.curso} · Ciclo ${r.ciclo} · Sec. ${r.seccion}`;

export function useDocenteSelection(rows, sharedFilters, pendingSelection) {
  const { filters: shared, options: sharedOptions, rowsBeforeDocente, setFilter: setSharedFilter, setMany, reset: resetShared } = sharedFilters;

  const [curso, setCurso] = useState('');

  const lastAppliedRef = useRef(null);
  useEffect(() => {
    if (pendingSelection && pendingSelection !== lastAppliedRef.current) {
      lastAppliedRef.current = pendingSelection;
      const cursoKey = (pendingSelection.curso && pendingSelection.ciclo != null && pendingSelection.seccion != null)
        ? groupKeyParts(pendingSelection.curso, pendingSelection.ciclo, pendingSelection.seccion)
        : '';
      setMany({ programa: pendingSelection.programa, categoria: '', docente: pendingSelection.docente, ciclo: [], seccion: '', estado: null });
      setCurso(cursoKey);
    }
  }, [pendingSelection]);

  const setSel = (key, value) => {
    if (key === 'curso') { setCurso(value); return; }
    if (key === 'selected') { setSharedFilter('docente', value); return; }
    setSharedFilter(key, value); // programa, categoria, seccion, estado
  };

  const reset = () => {
    resetShared();
    setCurso('');
  };

  const { cursoOptions, effectiveCurso } = useMemo(() => {
    const rowsDocente = rowsBeforeDocente.filter((r) => r.docente === shared.docente);
    const grupoMap = new Map();
    rowsDocente.forEach((r) => {
      const key = groupKeyOf(r);
      if (!grupoMap.has(key)) grupoMap.set(key, { value: key, label: groupLabelOf(r), curso: r.curso, ciclo: r.ciclo, seccion: r.seccion });
    });
    const cursoGroups = Array.from(grupoMap.values()).sort((a, b) =>
      a.curso.localeCompare(b.curso, 'es')
      || String(a.ciclo).localeCompare(String(b.ciclo), 'es')
      || String(a.seccion).localeCompare(String(b.seccion), 'es'));
    const validKeys = new Set(cursoGroups.map((g) => g.value));
    return { cursoOptions: cursoGroups, effectiveCurso: validKeys.has(curso) ? curso : '' };
  }, [rowsBeforeDocente, shared.docente, curso]);

  const docenteRows = useMemo(() => (
    rows.filter((r) => (
      (!shared.programa || r.programa === shared.programa)
      && r.docente === shared.docente
      && (shared.ciclo.length === 0 || shared.ciclo.includes(r.ciclo))
      && (!shared.seccion || r.seccion === shared.seccion)
    ))
  ), [rows, shared.programa, shared.docente, shared.ciclo, shared.seccion]);

  const cursoRows = useMemo(() => (
    effectiveCurso ? docenteRows.filter((r) => groupKeyOf(r) === effectiveCurso) : docenteRows
  ), [docenteRows, effectiveCurso]);

  const cursoLabel = useMemo(() => {
    if (!effectiveCurso) return 'Todos los cursos';
    const first = cursoRows[0];
    return first ? groupLabelOf(first) : 'Todos los cursos';
  }, [effectiveCurso, cursoRows]);

  const sel = {
    programa: shared.programa,
    categoria: shared.categoria,
    selected: shared.docente,
    curso: effectiveCurso,
    estado: shared.estado,
    ciclo: shared.ciclo,
    seccion: shared.seccion,
  };

  const options = {
    programa: sharedOptions.programa,
    categoria: sharedOptions.categoria,
    docente: sharedOptions.docente,
    ciclo: sharedOptions.ciclo,
    seccion: sharedOptions.seccion,
    curso: cursoOptions,
  };

  return { sel, cursoLabel, setSel, reset, options, docenteRows, cursoRows };
}
