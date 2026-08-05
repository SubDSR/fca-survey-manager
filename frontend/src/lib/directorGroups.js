import { docenteKey, titleCaseFullName } from './csv.js';
import { computeDirectiveCountsFromView } from './statsFromViews.js';
import { toRoman } from './chartConfigs.js';

/* Convierte cada fila de GET /api/encuestas/consolidado (una fila por grupo
   docente+asignatura+ciclo+sección, ya agregada en el backend) al shape que
   usan los filtros compartidos del Director (mismos nombres de campo que
   antes traía dataset.csv: docente, programa, curso, ciclo, seccion), más los
   ids (docenteId/asignaturaId/grupoId) para unir con criterios/directivas.
   El backend trae ciclo como entero (4); se convierte a romano ("IV") para
   que sea comparable con rows.ciclo (dataset.csv) en los filtros compartidos
   y en useDocenteSelection.

   `n` (n_encuestas) es el total de encuestados del grupo, incluidos los que
   dejaron todo en blanco; se conserva porque algunos cálculos ponderados
   (ver lib/stats.js#weightedNotaPromedio) ya venían usándolo. `nValidas`
   (n_encuestas_validas) excluye los encuestados en blanco y es el que debe
   mostrarse al usuario como "N° de encuestas". */
export function buildGroupRows(consolidadoRows, roster) {
  return consolidadoRows.map((c) => {
    const info = roster.get(docenteKey(c.nombre_completo));
    return {
      docente: titleCaseFullName(c.nombre_completo),
      docenteId: c.docente_id,
      programa: c.programa,
      curso: c.asignatura,
      asignaturaId: c.asignatura_id,
      cursoGrupoId: c.curso_grupo_id,
      grupoId: c.grupo_id,
      ciclo: toRoman(c.ciclo),
      seccion: String(c.seccion),
      aula: c.aula,
      n: c.n_encuestas,
      nValidas: c.n_encuestas_validas,
      notaFinal: c.nota_promedio,
      pctSi: c.pct_si,
      seccionesOrigen: c.secciones_origen,
      categoria: (info && info.categoria) || 'Sin categoría',
      facultad: (info && info.facultad) || null,
    };
  });
}

/* Cada fila de buildGroupRows YA es un grupo docente+curso+ciclo+sección (el
   backend pre-agrega): a diferencia de lib/groups.js#buildGroups (que sigue
   usándose para las filas crudas de dataset.csv en Vista Docente/Vista Curso),
   acá no hace falta reagrupar respuestas individuales. El % de "No" no viene
   en el consolidado (solo trae pct_si), así que se calcula aparte con la
   vista de directivas, uniendo por docenteId+asignaturaId+grupoId. */
export function buildDirectorGroups(groupRows, directivas) {
  return groupRows.map((r) => {
    const { pctNo } = computeDirectiveCountsFromView(directivas, [r]);
    return {
      programa: r.programa, ciclo: r.ciclo, seccion: r.seccion, aula: r.aula,
      docente: r.docente, curso: r.curso, docenteId: r.docenteId,
      asignaturaId: r.asignaturaId, grupoId: r.grupoId, seccionesOrigen: r.seccionesOrigen,
      nota: r.notaFinal, cumplimiento: Math.round(r.pctSi), pctNo, n: r.n, nValidas: r.nValidas,
    };
  });
}

/* Versión simplificada de buildDirectorGroups (sin pctNo/directivas), para
   componentes que solo necesitan nota/cumplimiento/n por sección — CoursesTable,
   DocentesTable y CursoDetailModal (ver components/docente, components/curso,
   components/modals). */
export function toSummaryGroup(r) {
  return {
    programa: r.programa, ciclo: r.ciclo, seccion: r.seccion, aula: r.aula,
    docente: r.docente, curso: r.curso, docenteId: r.docenteId,
    asignaturaId: r.asignaturaId, grupoId: r.grupoId, seccionesOrigen: r.seccionesOrigen,
    nota: r.notaFinal, cumplimiento: Math.round(r.pctSi), n: r.n, nValidas: r.nValidas,
  };
}

// `politica` viene de politica_evaluacion (GET /api/politica-evaluacion vía
// DataContext) -- ya no hay 11/30/45 hardcodeados acá. umbral_aprobacion es
// el mismo corte que usa v_seguimiento (nivel_alerta) y los reportes de
// Evaluación Docente (aprobado/desaprobado): cualquier docente desaprobado
// entra en seguimiento, no un umbral aparte más grave. Los umbrales de
// pct_no no tienen un equivalente de "aprobado" al cual alinearse, así que
// vienen de la política tal cual (no cambiaron de valor, solo de origen).
export function needsFollowUp(group, politica) {
  return group.nota < politica.umbral_aprobacion || group.pctNo >= politica.umbral_seguimiento_pct_no;
}

export function getFollowUpGroups(groups, politica) {
  const { umbral_aprobacion: umbralAprobacion, umbral_seguimiento_pct_no: umbralSeguimientoPctNo, umbral_critico_pct_no: umbralCriticoPctNo } = politica;
  const flagged = [];
  groups.forEach((g) => {
    const reasons = [];
    if (g.nota < umbralAprobacion) reasons.push({ label: `Nota Dim. I: ${g.nota.toFixed(1)} (< ${umbralAprobacion})`, level: 'red' });
    if (g.pctNo >= umbralSeguimientoPctNo) {
      reasons.push({
        label: `% de "No": ${Math.round(g.pctNo)}% (≥ ${umbralSeguimientoPctNo}%)`,
        level: g.pctNo >= umbralCriticoPctNo ? 'red' : 'yellow',
      });
    }
    if (reasons.length) {
      flagged.push({
        docente: g.docente, programa: g.programa, ciclo: g.ciclo, seccion: g.seccion,
        aula: g.aula, curso: g.curso, nota: g.nota, pctNo: g.pctNo, n: g.n, reasons,
      });
    }
  });
  flagged.sort((a, b) => a.nota - b.nota);
  return flagged;
}
