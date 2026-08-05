import { useMemo, useState } from 'react';
import { uniqueSorted } from '../lib/groups.js';

const EMPTY_SEL = {
  programa: '',
  curso: '',
  ciclo: '',
  seccion: '',
  // '' (todos) | 'con' | 'sin' — ver GET /api/asignaturas y CursoFilterPanel.jsx.
  conEncuestas: '',
};

const EMPTY_CATALOGO = { programas: [], asignaturas: [] };

function uniqueSortedStrings(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'es'));
}

/* Programa/Curso salen del catálogo completo (GET /api/programas + GET
   /api/asignaturas), no de `rows` (GET /api/encuestas/consolidado) — un
   programa o curso sin ninguna encuesta cargada hoy no aparece en `rows`,
   pero igual debe poder seleccionarse (ver docs/plans/2026-08-04...). Ciclo y
   Sección siguen saliendo de `rows`: son atributos de las secciones que
   efectivamente se dictaron con encuestas, no del catálogo académico.
   `conEncuestas` filtra Programa/Curso según si tienen o no al menos una fila
   en `rows`, sin ser excluyente con el resto (se combina en el mismo cálculo
   de opciones). */
export function useCursoFilters(rows, catalogo = EMPTY_CATALOGO) {
  const [sel, setSelState] = useState(EMPTY_SEL);

  const setSel = (key, value) => {
    setSelState((prev) => {
      switch (key) {
        case 'programa':
          return { ...prev, programa: value, curso: '', ciclo: '', seccion: '' };
        case 'curso':
          return { ...prev, curso: value, ciclo: '', seccion: '' };
        case 'ciclo':
          return { ...prev, ciclo: value, seccion: '' };
        case 'seccion':
          return { ...prev, seccion: value };
        case 'conEncuestas':
          // Cambia qué programas/cursos son seleccionables — misma cascada de
          // reset que un cambio de programa.
          return {
            ...prev,
            conEncuestas: prev.conEncuestas === value ? '' : value,
            programa: '', curso: '', ciclo: '', seccion: '',
          };
        default:
          return prev;
      }
    });
  };

  const reset = () => setSelState(EMPTY_SEL);

  const { options, effective } = useMemo(() => {
    const programasConEncuestas = new Set(rows.map((r) => r.programa));
    let programa = uniqueSortedStrings(catalogo.programas.map((p) => p.nombre_corto));
    if (sel.conEncuestas === 'con') programa = programa.filter((p) => programasConEncuestas.has(p));
    else if (sel.conEncuestas === 'sin') programa = programa.filter((p) => !programasConEncuestas.has(p));
    const effectivePrograma = programa.includes(sel.programa) ? sel.programa : '';

    const asignaturasPrograma = catalogo.asignaturas.filter(
      (a) => !effectivePrograma || a.programa === effectivePrograma
    );
    const cursosConEncuestas = new Set(
      rows.filter((r) => !effectivePrograma || r.programa === effectivePrograma).map((r) => r.curso)
    );
    let curso = uniqueSortedStrings(asignaturasPrograma.map((a) => a.nombre));
    if (sel.conEncuestas === 'con') curso = curso.filter((c) => cursosConEncuestas.has(c));
    else if (sel.conEncuestas === 'sin') curso = curso.filter((c) => !cursosConEncuestas.has(c));
    const effectiveCurso = curso.includes(sel.curso) ? sel.curso : '';

    const rowsCurso = rows.filter(
      (r) => (!effectivePrograma || r.programa === effectivePrograma) && r.curso === effectiveCurso
    );

    // Convert to string since they might be numbers
    const ciclo = uniqueSorted(rowsCurso, 'ciclo').map(String);
    const effectiveCiclo = ciclo.includes(String(sel.ciclo)) ? String(sel.ciclo) : '';

    const rowsCiclo = rowsCurso.filter((r) => !effectiveCiclo || String(r.ciclo) === effectiveCiclo);
    const seccion = uniqueSorted(rowsCiclo, 'seccion').map(String);
    const effectiveSeccion = seccion.includes(String(sel.seccion)) ? String(sel.seccion) : '';

    return {
      options: { programa, curso, ciclo, seccion },
      effective: {
        programa: effectivePrograma,
        curso: effectiveCurso,
        ciclo: effectiveCiclo,
        seccion: effectiveSeccion,
      }
    };
  }, [rows, catalogo, sel.programa, sel.curso, sel.ciclo, sel.seccion, sel.conEncuestas]);

  // allCursoRows is all the rows for the selected course (across all sections)
  const allCursoRows = useMemo(() => (
    rows.filter((r) =>
      (!effective.programa || r.programa === effective.programa) &&
      r.curso === effective.curso
    )
  ), [rows, effective.programa, effective.curso]);

  // filteredRows applies the ciclo and seccion filters
  const filteredRows = useMemo(() => (
    allCursoRows.filter((r) =>
      (!effective.ciclo || String(r.ciclo) === effective.ciclo) &&
      (!effective.seccion || String(r.seccion) === effective.seccion)
    )
  ), [allCursoRows, effective.ciclo, effective.seccion]);

  // programaRows for calculating the baseline of the entire program
  const programaRows = useMemo(() => (
    rows.filter((r) => r.programa === (effective.programa || (filteredRows[0]?.programa)))
  ), [rows, effective.programa, filteredRows]);

  return {
    sel: {
      ...sel,
      programa: effective.programa,
      curso: effective.curso,
      ciclo: effective.ciclo,
      seccion: effective.seccion,
    },
    setSel,
    reset,
    options,
    allCursoRows,
    filteredRows,
    programaRows
  };
}
