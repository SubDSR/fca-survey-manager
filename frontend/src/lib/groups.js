/* ===================== AGRUPACIÓN Y SEGUIMIENTO ==================== */
/* Portado verbatim desde reference/dashboard_evaluacion_docente.html
   (groupKey: líneas 1293-1295; buildGroups: líneas 1297-1310).
   La lógica de seguimiento extrae el cálculo puro de renderAlertBanner
   (líneas 1516-1536), sin DOM ni STATE. */

import { computeGroupStats, computeDirectiveCounts } from './stats.js';

/* uniqueSorted: extraído de la función homónima usada en varios puntos del
   reference (p.ej. líneas 1413-1415, 1921-1923) para no duplicarla entre
   useDirectorFilters, useDocenteSelection y los componentes de Vista Docente. */
export function uniqueSorted(rows, field) {
  return Array.from(new Set(rows.map((r) => r[field]))).sort((a, b) => String(a).localeCompare(String(b), 'es'));
}

export function groupKey(row) {
  return [row.programa, row.ciclo, row.seccion, row.aula, row.docente, row.curso].join('|||');
}

export function buildGroups(rows) {
  const map = new Map();
  rows.forEach(row => {
    const key = groupKey(row);
    if (!map.has(key)) {
      map.set(key, {
        programa: row.programa, ciclo: row.ciclo, seccion: row.seccion,
        aula: row.aula, docente: row.docente, curso: row.curso, rows: []
      });
    }
    map.get(key).rows.push(row);
  });
  return Array.from(map.values()).map(g => Object.assign(g, computeGroupStats(g.rows)));
}

export function needsFollowUp(group) {
  return group.nota < 11 || computeDirectiveCounts(group.rows).pctNo >= 30;
}

export function getFollowUpGroups(groups) {
  const flaggedGroups = [];

  groups.forEach(g => {
    const { pctNo } = computeDirectiveCounts(g.rows);
    const reasons = [];
    if (g.nota < 11) reasons.push({ label: 'Nota Dim. I: ' + g.nota.toFixed(1) + ' (< 11)', level: 'red' });
    if (pctNo >= 30) reasons.push({ label: '% de "No": ' + Math.round(pctNo) + '% (≥ 30%)', level: pctNo >= 45 ? 'red' : 'yellow' });
    if (reasons.length) {
      flaggedGroups.push({
        docente: g.docente, programa: g.programa, ciclo: g.ciclo,
        seccion: g.seccion, aula: g.aula, curso: g.curso,
        nota: g.nota, pctNo, n: g.n, reasons
      });
    }
  });

  flaggedGroups.sort((a, b) => a.nota - b.nota);
  return flaggedGroups;
}

export function aggregateByDocente(groups) {
  const map = new Map();
  groups.forEach(g => {
    if (!map.has(g.docente)) {
      map.set(g.docente, {
        docente: g.docente,
        programa: new Set(),
        curso: new Set(),
        notaSum: 0,
        cumplSum: 0,
        nSum: 0,
        nValidasSum: 0,
      });
    }
    const d = map.get(g.docente);
    if (g.programa) d.programa.add(g.programa);
    if (g.curso) d.curso.add(g.curso);
    d.notaSum += g.nota * g.n;
    d.cumplSum += g.cumplimiento * g.n;
    d.nSum += g.n;
    d.nValidasSum += g.nValidas || 0;
  });

  return Array.from(map.values()).map(d => ({
    docente: d.docente,
    programa: Array.from(d.programa).join(', '),
    curso: Array.from(d.curso).join('\n'),
    nota: d.nSum ? d.notaSum / d.nSum : 0,
    cumplimiento: d.nSum ? Math.round(d.cumplSum / d.nSum) : 0,
    n: d.nValidasSum || d.nSum,
  }));
}
