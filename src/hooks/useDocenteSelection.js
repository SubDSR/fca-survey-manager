import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIA_ORDER } from '../data/constants.js';
import { uniqueSorted } from '../lib/groups.js';

// La categoría de cada docente viene enriquecida en la fila (row.categoria)
// desde el roster (public/docentes.csv), cargado en DataContext.
const rowCategoria = (r) => r.categoria || 'Sin categoría';

/* Selección de la Vista Docente Individual: cascada programa -> categoría ->
   docente -> curso, con checks de estado. Portado de reference/...html
   (refreshDocenteSelectors, setupDocenteSelectors, renderDocenteView).

   AJUSTE (Fase 2 · corrección del buscador de docentes):
   - El filtro "Curso" ahora ofrece "Todos los cursos" (valor por defecto), que
     agrega TODAS las filas del docente (promedio y total de encuestas globales),
     y una opción por cada grupo curso·ciclo·sección para consultar uno específico.
   - Ya NO se autoselecciona el primer curso (antes impedía ver el agregado).
   - La navegación cruzada (clic en la tabla del Director / "Ver detalle →") puede
     traer un grupo concreto (curso+ciclo+sección) para abrir exactamente ese, en
     vez de caer en la primera opción.

   NOTA: el checkbox de Estado (Aprobado >= 14 / Desaprobado < 14) sólo filtra qué
   DOCENTES aparecen en el <select>; no filtra las filas ya mostradas del docente
   seleccionado (igual que allDocenteRows/rowsDocenteCurso del reference). */

// Clave/etiqueta de un grupo curso·ciclo·sección dentro de un docente.
const GK_SEP = '|||';
const groupKeyParts = (curso, ciclo, seccion) => `${curso}${GK_SEP}${ciclo}${GK_SEP}${seccion}`;
const groupKeyOf = (r) => groupKeyParts(r.curso, r.ciclo, r.seccion);
const groupLabelOf = (r) => `${r.curso} · Ciclo ${r.ciclo} · Sec. ${r.seccion}`;

const EMPTY_SEL = {
  programa: '',
  categoria: '',
  selected: '',
  curso: '',
  estado: { aprobado: true, desaprobado: true }
};

export function useDocenteSelection(rows, pendingSelection) {
  const [sel, setSelState] = useState(EMPTY_SEL);

  // Aplica una selección "cross-view" pendiente (clic en la tabla del Director o
  // botón "Ver detalle →" del modal de seguimiento). Guarda la identidad del
  // último objeto aplicado para no reaplicarlo en cada render ni pisar cambios
  // manuales posteriores del usuario.
  const lastAppliedRef = useRef(null);
  useEffect(() => {
    if (pendingSelection && pendingSelection !== lastAppliedRef.current) {
      lastAppliedRef.current = pendingSelection;
      // Si trae un grupo concreto (curso + ciclo + sección) se abre ese grupo;
      // de lo contrario se muestra "Todos los cursos" (curso = '').
      const curso = (pendingSelection.curso && pendingSelection.ciclo != null && pendingSelection.seccion != null)
        ? groupKeyParts(pendingSelection.curso, pendingSelection.ciclo, pendingSelection.seccion)
        : '';
      setSelState({
        programa: pendingSelection.programa,
        categoria: '',
        selected: pendingSelection.docente,
        curso,
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

    const categoriasDisponibles = new Set(rowsProg.map(rowCategoria));
    const categoria = CATEGORIA_ORDER.filter((c) => categoriasDisponibles.has(c));
    const effectiveCategoria = categoria.includes(sel.categoria) ? sel.categoria : '';

    const rowsProgCat = rowsProg.filter((r) => !effectiveCategoria || rowCategoria(r) === effectiveCategoria);

    // Filtro por Estado (Aprobado / Desaprobado) según el promedio del docente.
    const docentesEnScope = uniqueSorted(rowsProgCat, 'docente');
    const docente = docentesEnScope.filter((d) => {
      const rowsD = rowsProgCat.filter((r) => r.docente === d);
      const avg = rowsD.reduce((a, r) => a + r.notaFinal, 0) / rowsD.length;
      const aprobado = avg >= 14;
      return (aprobado && sel.estado.aprobado) || (!aprobado && sel.estado.desaprobado);
    });
    const effectiveSelected = docente.includes(sel.selected) ? sel.selected : '';

    // Grupos curso·ciclo·sección del docente para el filtro "Curso".
    const rowsDocente = rowsProgCat.filter((r) => r.docente === effectiveSelected);
    const grupoMap = new Map();
    rowsDocente.forEach((r) => {
      const key = groupKeyOf(r);
      if (!grupoMap.has(key)) grupoMap.set(key, { value: key, label: groupLabelOf(r), curso: r.curso, ciclo: r.ciclo, seccion: r.seccion });
    });
    const cursoGroups = Array.from(grupoMap.values()).sort((a, b) =>
      a.curso.localeCompare(b.curso, 'es')
      || String(a.ciclo).localeCompare(String(b.ciclo), 'es')
      || String(a.seccion).localeCompare(String(b.seccion), 'es'));

    // "Todos los cursos" (curso = '') es válido y por defecto: ya no se
    // autoselecciona el primer curso, para poder ver el agregado del docente.
    const validKeys = new Set(cursoGroups.map((g) => g.value));
    const effectiveCurso = validKeys.has(sel.curso) ? sel.curso : '';
    const cursoLabel = effectiveCurso ? grupoMap.get(effectiveCurso).label : 'Todos los cursos';

    return {
      options: { programa, categoria, docente, curso: cursoGroups },
      effective: { categoria: effectiveCategoria, selected: effectiveSelected, curso: effectiveCurso, cursoLabel }
    };
  }, [rows, sel.programa, sel.categoria, sel.selected, sel.curso, sel.estado.aprobado, sel.estado.desaprobado]);

  // allDocenteRows (reference): sólo programa + docente.
  const docenteRows = useMemo(() => (
    rows.filter((r) => (!sel.programa || r.programa === sel.programa) && r.docente === effective.selected)
  ), [rows, sel.programa, effective.selected]);

  // "Todos los cursos" (effective.curso === '') => todas las filas del docente;
  // un grupo concreto => filas de ese curso·ciclo·sección.
  const cursoRows = useMemo(() => (
    effective.curso
      ? docenteRows.filter((r) => groupKeyOf(r) === effective.curso)
      : docenteRows
  ), [docenteRows, effective.curso]);

  return {
    sel: { ...sel, categoria: effective.categoria, selected: effective.selected, curso: effective.curso },
    cursoLabel: effective.cursoLabel,
    setSel,
    reset,
    options,
    docenteRows,
    cursoRows
  };
}
