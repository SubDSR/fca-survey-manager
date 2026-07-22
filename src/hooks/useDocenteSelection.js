import { useEffect, useMemo, useRef, useState } from 'react';
import { getDocenteCategoria } from '../data/docenteCategoria.js';
import { CATEGORIA_ORDER } from '../data/constants.js';
import { uniqueSorted } from '../lib/groups.js';

/* Portado desde reference/dashboard_evaluacion_docente.html:
   - cascada programa -> categoría -> docente -> curso + checks de estado:
     refreshDocenteSelectors (líneas 1841-1889)
   - listeners / reseteo de niveles dependientes: setupDocenteSelectors (líneas 3031-3066)
   - filas mostradas (allDocenteRows / rowsDocenteCurso): renderDocenteView (líneas 2453-2467)

   NOTA IMPORTANTE (documentada también en el reporte de la tarea): en el reference,
   el checkbox de Estado (Aprobado >= 14 / Desaprobado < 14) filtra únicamente qué
   DOCENTES aparecen en el <select> (según el promedio del docente dentro del
   alcance programa+categoría, línea 1868-1873) — NO filtra las filas ya mostradas
   de un docente una vez seleccionado. `docenteRows`/`cursoRows` replican esto
   exactamente: se calculan sólo con programa + docente (+curso), igual que
   `allDocenteRows`/`rowsDocenteCurso` en renderDocenteView (líneas 2460-2467),
   sin aplicar el filtro de estado a las filas en sí. */

const EMPTY_SEL = {
  programa: '',
  categoria: '',
  selected: '',
  curso: '',
  estado: { aprobado: true, desaprobado: true }
};

export function useDocenteSelection(rows, pendingSelection) {
  const [sel, setSelState] = useState(EMPTY_SEL);

  // Aplica una selección "cross-view" pendiente (botón "Ver detalle →" del
  // modal de seguimiento — portado de reference líneas 1586-1594). Se guarda
  // la identidad del último objeto aplicado para no reaplicar en cada render
  // ni pisar selecciones manuales posteriores del usuario.
  const lastAppliedRef = useRef(null);
  useEffect(() => {
    if (pendingSelection && pendingSelection !== lastAppliedRef.current) {
      lastAppliedRef.current = pendingSelection;
      setSelState({
        programa: pendingSelection.programa,
        categoria: '',
        selected: pendingSelection.docente,
        curso: pendingSelection.curso,
        estado: { aprobado: true, desaprobado: true }
      });
    }
  }, [pendingSelection]);

  const setSel = (key, value) => {
    setSelState((prev) => {
      switch (key) {
        case 'programa':
          return { ...prev, programa: value, selected: '', curso: '' };
        case 'categoria':
          return { ...prev, categoria: value, selected: '', curso: '' };
        case 'selected':
          return { ...prev, selected: value, curso: '' };
        case 'curso':
          return { ...prev, curso: value };
        case 'estadoAprobado':
          return { ...prev, estado: { ...prev.estado, aprobado: value }, selected: '', curso: '' };
        case 'estadoDesaprobado':
          return { ...prev, estado: { ...prev.estado, desaprobado: value }, selected: '', curso: '' };
        default:
          return prev;
      }
    });
  };

  const reset = () => setSelState(EMPTY_SEL);

  const { options, effective } = useMemo(() => {
    const programa = uniqueSorted(rows, 'programa');
    const rowsProg = rows.filter((r) => !sel.programa || r.programa === sel.programa);

    const categoriasDisponibles = new Set(rowsProg.map((r) => getDocenteCategoria(r.docente)));
    const categoria = CATEGORIA_ORDER.filter((c) => categoriasDisponibles.has(c));
    const effectiveCategoria = categoria.includes(sel.categoria) ? sel.categoria : '';

    const rowsProgCat = rowsProg.filter((r) => !effectiveCategoria || getDocenteCategoria(r.docente) === effectiveCategoria);

    // Filtro por Estado (Aprobado / Desaprobado), según el promedio general del
    // docente (Nota Dim I >= 14) dentro del alcance programa+categoría.
    const docentesEnScope = uniqueSorted(rowsProgCat, 'docente');
    const docente = docentesEnScope.filter((d) => {
      const rowsD = rowsProgCat.filter((r) => r.docente === d);
      const avg = rowsD.reduce((a, r) => a + r.notaFinal, 0) / rowsD.length;
      const aprobado = avg >= 14;
      return (aprobado && sel.estado.aprobado) || (!aprobado && sel.estado.desaprobado);
    });
    const effectiveSelected = docente.includes(sel.selected) ? sel.selected : '';

    const rowsDocente = rowsProgCat.filter((r) => r.docente === effectiveSelected);
    const cursosDocente = uniqueSorted(rowsDocente, 'curso');
    let effectiveCurso = cursosDocente.includes(sel.curso) ? sel.curso : '';
    if (!effectiveCurso && cursosDocente.length) effectiveCurso = cursosDocente[0];

    return {
      options: { programa, categoria, docente, curso: cursosDocente },
      effective: { categoria: effectiveCategoria, selected: effectiveSelected, curso: effectiveCurso }
    };
  }, [rows, sel.programa, sel.categoria, sel.selected, sel.curso, sel.estado.aprobado, sel.estado.desaprobado]);

  // allDocenteRows (reference): sólo programa + docente, sin categoría ni estado.
  const docenteRows = useMemo(() => (
    rows.filter((r) => (!sel.programa || r.programa === sel.programa) && r.docente === effective.selected)
  ), [rows, sel.programa, effective.selected]);

  // rowsDocenteCurso (reference): allDocenteRows + curso.
  const cursoRows = useMemo(() => (
    docenteRows.filter((r) => !effective.curso || r.curso === effective.curso)
  ), [docenteRows, effective.curso]);

  return {
    sel: { ...sel, categoria: effective.categoria, selected: effective.selected, curso: effective.curso },
    setSel,
    reset,
    options,
    docenteRows,
    cursoRows
  };
}
