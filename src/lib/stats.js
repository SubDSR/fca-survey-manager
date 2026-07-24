/* ===================== ESTADÍSTICAS ==================== */
/* Portado verbatim desde reference/dashboard_evaluacion_docente.html
   (líneas 1312-1391), parametrizando nCrit/directiveLabels en lugar de
   leerlos del STATE global. */

export function computeGroupStats(rows) {
  const n = rows.length;
  const nota = n ? rows.reduce((a, r) => a + r.notaFinal, 0) / n : 0;
  const { pctSi } = computeDirectiveCounts(rows);
  const nCrit = n ? rows[0].scores.length : 0;
  const criteriaAvgs = computeCriteriaAverages(rows, nCrit);
  return {
    nota: Math.round(nota * 10) / 10,
    cumplimiento: Math.round(pctSi),
    n,
    criteriaAvgs
  };
}

export function computeCriteriaAverages(rows, nCrit) {
  const sums = new Array(nCrit).fill(0);
  const counts = new Array(nCrit).fill(0);
  rows.forEach(r => {
    r.scores.forEach((s, i) => {
      if (s !== null && s !== undefined) { sums[i] += s; counts[i]++; }
    });
  });
  return sums.map((s, i) => (counts[i] ? (s / counts[i]) * 2 : 0));
}

export function computeDirectiveCounts(rows) {
  let si = 0, no = 0, av = 0, total = 0;
  rows.forEach(r => {
    r.directivas.forEach(d => {
      if (d.value === 'Sí') si++;
      else if (d.value === 'No') no++;
      else if (d.value === 'A veces') av++;
      else return;
      total++;
    });
  });
  return {
    si, no, av, total,
    pctSi: total ? (si / total) * 100 : 0,
    pctNo: total ? (no / total) * 100 : 0,
    pctAv: total ? (av / total) * 100 : 0
  };
}

export function computeDirectiveBreakdown(rows, directiveLabels) {
  return directiveLabels.map(label => {
    let si = 0, no = 0, av = 0, total = 0;
    rows.forEach(r => {
      const d = r.directivas.find(d => d.label === label);
      if (!d || !d.value) return;
      if (d.value === 'Sí') si++;
      else if (d.value === 'No') no++;
      else if (d.value === 'A veces') av++;
      total++;
    });
    return {
      label, si, no, av, total,
      pctSi: total ? (si / total) * 100 : 0,
      pctNo: total ? (no / total) * 100 : 0,
      pctAv: total ? (av / total) * 100 : 0
    };
  });
}

export function computeDescriptiveStats(values) {
  const n = values.length;
  if (!n) return { n: 0, sum: 0, avg: 0, stddev: 0, max: 0, min: 0 };
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / n;
  const variance = values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / n;
  return {
    n,
    sum: Math.round(sum * 10) / 10,
    avg: Math.round(avg * 10) / 10,
    stddev: Math.round(Math.sqrt(variance) * 10) / 10,
    max: Math.round(Math.max(...values) * 10) / 10,
    min: Math.round(Math.min(...values) * 10) / 10
  };
}

export function classifyDocentesByEstado(rows) {
  const acc = new Map();
  rows.forEach((r) => {
    if (!acc.has(r.docente)) acc.set(r.docente, { sum: 0, count: 0 });
    const s = acc.get(r.docente);
    s.sum += r.notaFinal;
    s.count += 1;
  });
  const result = new Map();
  acc.forEach((s, docente) => {
    result.set(docente, (s.sum / s.count) >= 14 ? 'aprobado' : 'desaprobado');
  });
  return result;
}

export function computeDocenteVsPrograma(cursoRows, programaRows) {
  const n = cursoRows.length;
  const notaDocente = n ? cursoRows.reduce((a, r) => a + r.notaFinal, 0) / n : 0;
  const notaPrograma = programaRows.length
    ? programaRows.reduce((a, r) => a + r.notaFinal, 0) / programaRows.length
    : 0;
  return {
    notaDocente,
    notaPrograma,
    delta: notaDocente - notaPrograma,
    aprobado: notaDocente >= 14,
    n,
  };
}
