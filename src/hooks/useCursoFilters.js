import { useMemo, useState } from 'react';
import { uniqueSorted } from '../lib/groups.js';

const EMPTY_SEL = {
  programa: '',
  curso: '',
  ciclo: '',
  seccion: ''
};

export function useCursoFilters(rows) {
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
        default:
          return prev;
      }
    });
  };

  const reset = () => setSelState(EMPTY_SEL);

  const { options, effective } = useMemo(() => {
    const programa = uniqueSorted(rows, 'programa');
    const rowsProg = rows.filter((r) => !sel.programa || r.programa === sel.programa);

    const curso = uniqueSorted(rowsProg, 'curso');
    const effectiveCurso = curso.includes(sel.curso) ? sel.curso : '';

    const rowsCurso = rowsProg.filter((r) => !effectiveCurso || r.curso === effectiveCurso);
    
    // Convert to string since they might be numbers
    const ciclo = uniqueSorted(rowsCurso, 'ciclo').map(String);
    const effectiveCiclo = ciclo.includes(String(sel.ciclo)) ? String(sel.ciclo) : '';

    const rowsCiclo = rowsCurso.filter((r) => !effectiveCiclo || String(r.ciclo) === effectiveCiclo);
    const seccion = uniqueSorted(rowsCiclo, 'seccion').map(String);
    const effectiveSeccion = seccion.includes(String(sel.seccion)) ? String(sel.seccion) : '';

    return {
      options: { programa, curso, ciclo, seccion },
      effective: { 
        programa: sel.programa, 
        curso: effectiveCurso, 
        ciclo: effectiveCiclo, 
        seccion: effectiveSeccion 
      }
    };
  }, [rows, sel.programa, sel.curso, sel.ciclo, sel.seccion]);

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
    sel: { ...sel, curso: effective.curso, ciclo: effective.ciclo, seccion: effective.seccion },
    setSel,
    reset,
    options,
    allCursoRows,
    filteredRows,
    programaRows
  };
}
