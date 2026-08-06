/* ============ RESPUESTAS INDIVIDUALES DESDE v_respuesta_detalle ============ */
/* GET /api/encuestas/respuestas trae una fila por encuesta+pregunta (formato
   largo). Se pivota a una fila por encuesta (encuestado) con `.scores`
   (P1-P6, en orden) y `.directivas` (P7-P9, [{label, value}] en orden) —
   mismo shape que ya producían las filas de dataset.csv — para que
   RawResponsesTable y lib/excel.js no necesiten cambiar su lógica de lectura.

   El filtro de sección exacta NO usa grupo_id: cuando un grupo consolidado
   junta varias secciones dispersas (secciones_origen, p. ej. "3-5, 4-6"), las
   respuestas de esas secciones siguen viviendo bajo SUS PROPIOS grupo_id
   (distintos del grupo_id "oficial" que expone v_docente_seccion_consolidada)
   -- filtrar por un único grupo_id dejaría fuera las respuestas de las
   secciones dispersas. En su lugar se compara docente_id+asignatura_id+
   ciclo+seccion contra los pares que trae secciones_origen, que sí incluye
   TODAS las secciones que aportan al grupo (la oficial y las dispersas). */

import { toRoman } from './chartConfigs.js';
import { parseSeccionesOrigen, matchKey, keysFromRows } from './seccionesOrigen.js';

// Igual que keysFromRows, pero conserva el grupo (`g`) al que apunta cada
// combinación ciclo+sección, para resolver docente/programa/curso/aula de una
// respuesta que llegó por una sección dispersa (ver buildDetailedResponseRows).
function infoMapFromGroups(groupRows) {
  const map = new Map();
  groupRows.forEach((g) => {
    parseSeccionesOrigen(g.seccionesOrigen).forEach(({ ciclo, seccion }) => {
      map.set(matchKey(g.docenteId, g.asignaturaId, ciclo, seccion), g);
    });
  });
  return map;
}

// Un encuestado está en blanco si no dejó ningún valor en P1-P9 (ni un
// puntaje numérico en los criterios ni una opción marcada en las directivas).
// Se excluyen de "Detalle de Encuestados" igual que hacía dataset.csv.
function isBlankRespondent(group) {
  const hasScore = group.scores.some((s) => s !== null && s !== undefined);
  const hasDirectiva = group.directivas.some((d) => d.value !== null && d.value !== undefined && d.value !== '-');
  return !hasScore && !hasDirectiva;
}

export function buildRawResponseRows(respuestas, cursoRows, directiveLabels) {
  const keys = keysFromRows(cursoRows);
  const filtered = respuestas.filter((r) => keys.has(matchKey(r.docente_id, r.asignatura_id, r.ciclo, r.seccion)));

  const byEncuesta = new Map();
  filtered.forEach((r) => {
    if (!byEncuesta.has(r.encuesta_id)) {
      byEncuesta.set(r.encuesta_id, {
        encuestaId: r.encuesta_id,
        secuencia: r.secuencia,
        codigo: r.codigo_encuestado,
        scores: new Array(6).fill(null),
        directivas: directiveLabels.map((label) => ({ label, value: null })),
      });
    }
    const group = byEncuesta.get(r.encuesta_id);
    const num = Number(String(r.pregunta_codigo).replace(/\D/g, ''));
    if (num >= 1 && num <= 6) {
      group.scores[num - 1] = r.respondida ? r.valor_numerico : null;
    } else if (num >= 7 && num <= 9) {
      group.directivas[num - 7] = { label: directiveLabels[num - 7], value: r.respondida ? r.opcion_etiqueta : null };
    }
  });

  return Array.from(byEncuesta.values())
    .filter((group) => !isBlankRespondent(group))
    .sort((a, b) => (
      a.secuencia - b.secuencia || String(a.codigo).localeCompare(String(b.codigo))
    ));
}

/* Variante para lib/excel.js: produce filas 100% compatibles con las que
   antes venían de dataset.csv (docente, programa, curso, aula, ciclo,
   seccion, scores, notaFinal, directivas ya filtradas a solo respondidas),
   para que computeCriteriaAverages/computeDirectiveBreakdown/buildGroups
   (lib/stats.js, lib/groups.js) sigan funcionando sin cambios. docente,
   programa, curso y aula se resuelven por sección exacta desde `groupRows`
   (GET /api/encuestas/consolidado, ver lib/directorGroups.js); ciclo/seccion
   vienen de la propia respuesta para reflejar secciones combinadas
   (secciones_origen). Las encuestas sin ninguna pregunta de criterio
   respondida se excluyen, igual que dataset.csv (ver lib/csv.js). */
export function buildDetailedResponseRows(respuestas, scopeRows, directiveLabels, groupRows) {
  const keys = keysFromRows(scopeRows);
  const infoByKey = infoMapFromGroups(groupRows);
  const filtered = respuestas.filter((r) => keys.has(matchKey(r.docente_id, r.asignatura_id, r.ciclo, r.seccion)));

  const byEncuesta = new Map();
  filtered.forEach((r) => {
    const key = matchKey(r.docente_id, r.asignatura_id, r.ciclo, r.seccion);
    if (!byEncuesta.has(r.encuesta_id)) {
      const info = infoByKey.get(key);
      byEncuesta.set(r.encuesta_id, {
        docente: info?.docente ?? '',
        programa: info?.programa ?? '',
        curso: info?.curso ?? '',
        aula: info?.aula ?? '',
        ciclo: toRoman(r.ciclo),
        seccion: String(r.seccion),
        modalidad: r.modalidad,
        scores: new Array(6).fill(null),
        directivas: directiveLabels.map((label) => ({ label, value: null })),
      });
    }
    const group = byEncuesta.get(r.encuesta_id);
    const num = Number(String(r.pregunta_codigo).replace(/\D/g, ''));
    if (num >= 1 && num <= 6) {
      group.scores[num - 1] = r.respondida ? r.valor_numerico : null;
    } else if (num >= 7 && num <= 9) {
      group.directivas[num - 7] = { label: directiveLabels[num - 7], value: r.respondida ? r.opcion_etiqueta : null };
    }
  });

  const rows = [];
  byEncuesta.forEach((group) => {
    const validScores = group.scores.filter((s) => s !== null && s !== undefined);
    if (validScores.length === 0) return;
    const promedio = validScores.reduce((a, b) => a + b, 0) / validScores.length;
    rows.push({
      ...group,
      notaFinal: Math.round(promedio * 2 * 10) / 10,
      directivas: group.directivas.filter((d) => d.value !== null),
    });
  });
  return rows;
}
