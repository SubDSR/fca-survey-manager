/* ============ ESTADÍSTICAS DESDE LAS VISTAS DEL BACKEND ============ */
/* v_promedio_por_criterio (GET /api/encuestas/criterios) y v_encuesta_directivas
   (GET /api/encuestas/directivas) traen una fila por docente_id+asignatura_id+
   grupo_id+ciclo+seccion -- pero ese grupo_id es el FÍSICO de cada sección, no
   el "oficial" que expone GET /api/encuestas/consolidado cuando varias
   secciones dispersas se consolidan en un solo grupo (secciones_origen).
   Filtrar por un único grupo_id dejaría fuera las secciones dispersas, igual
   que pasaba en lib/rawResponsesFromView.js -- por eso se compara
   docente_id+asignatura_id+ciclo+sección contra los pares de secciones_origen
   (ver lib/seccionesOrigen.js), en vez de por grupo_id. */

import { matchKey, keysFromRows } from './seccionesOrigen.js';

function sortByPreguntaCodigo([a], [b]) {
  return a.localeCompare(b, undefined, { numeric: true });
}

// Promedio ponderado (por n) de promedio_vigesimal por pregunta, para el
// conjunto de grupos (docenteId+asignaturaId+grupoId) presentes en `rows`.
export function computeCriteriaAveragesFromView(criteriosRows, rows) {
  const keys = keysFromRows(rows);
  const byPregunta = new Map();
  criteriosRows.forEach((c) => {
    if (!keys.has(matchKey(c.docente_id, c.asignatura_id, c.ciclo, c.seccion))) return;
    if (!byPregunta.has(c.pregunta_codigo)) {
      byPregunta.set(c.pregunta_codigo, { label: c.etiqueta_corta, sum: 0, n: 0 });
    }
    const acc = byPregunta.get(c.pregunta_codigo);
    acc.sum += c.promedio_vigesimal * c.n;
    acc.n += c.n;
  });
  const sorted = Array.from(byPregunta.entries()).sort(sortByPreguntaCodigo);
  return {
    labels: sorted.map(([, v]) => v.label),
    avgs: sorted.map(([, v]) => (v.n ? v.sum / v.n : 0)),
  };
}

// Conteos de Sí/No/A veces por pregunta (P7-P9), para el conjunto de grupos
// (docenteId+asignaturaId+grupoId) presentes en `rows`.
export function computeDirectiveBreakdownFromView(directivasRows, rows) {
  const keys = keysFromRows(rows);
  const byPregunta = new Map();
  directivasRows.forEach((d) => {
    if (!keys.has(matchKey(d.docente_id, d.asignatura_id, d.ciclo, d.seccion))) return;
    if (!byPregunta.has(d.pregunta_codigo)) {
      byPregunta.set(d.pregunta_codigo, { label: d.etiqueta_corta, si: 0, no: 0, av: 0, total: 0 });
    }
    const acc = byPregunta.get(d.pregunta_codigo);
    acc.si += d.n_si;
    acc.no += d.n_no;
    acc.av += d.n_a_veces;
    acc.total += d.n_si + d.n_no + d.n_a_veces;
  });
  return Array.from(byPregunta.entries())
    .sort(sortByPreguntaCodigo)
    .map(([, v]) => ({
      label: v.label,
      si: v.si,
      no: v.no,
      av: v.av,
      total: v.total,
      pctSi: v.total ? (v.si / v.total) * 100 : 0,
      pctNo: v.total ? (v.no / v.total) * 100 : 0,
      pctAv: v.total ? (v.av / v.total) * 100 : 0,
    }));
}

export function computeDirectiveCountsFromView(directivasRows, rows) {
  const breakdown = computeDirectiveBreakdownFromView(directivasRows, rows);
  const si = breakdown.reduce((a, b) => a + b.si, 0);
  const no = breakdown.reduce((a, b) => a + b.no, 0);
  const av = breakdown.reduce((a, b) => a + b.av, 0);
  const total = si + no + av;
  return {
    si, no, av, total,
    pctSi: total ? (si / total) * 100 : 0,
    pctNo: total ? (no / total) * 100 : 0,
    pctAv: total ? (av / total) * 100 : 0,
  };
}
