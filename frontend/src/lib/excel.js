/* ===================== EXPORTACIÓN A EXCEL (FORMATO OFICIAL) ==================== */
/* Portado verbatim desde reference/dashboard_evaluacion_docente.html:
   - buildCriteriaChartConfigForExport   (líneas 2549-2568)
   - buildDirectivesPieConfigForExport   (líneas 2569-2589)
   - buildCoursesNotaChartConfigForExport(líneas 2590-2608)
   - XLS_COLORS / scoreFillArgb / scoreFontArgb / pctFillArgb / thinBorder /
     styleSectionHeader / chartConfigToImage (líneas 2484-2547)
   - exportToExcel                       (líneas 2609-2900)

   Todos los accesos a `STATE.*` y al DOM (excelBtn) del original se sustituyen
   por parámetros explícitos de `exportToExcel({...})`. El resto (layout de
   hojas, estilos, colores, formatos numéricos, generación del workbook y la
   descarga vía Blob + <a download>) se mantiene EXACTAMENTE igual. */

import ExcelJS from 'exceljs';
import { Chart } from 'chart.js';
import '../components/charts/registerCharts.js';
import {
  computeCriteriaAverages,
  computeDirectiveCounts,
  computeDirectiveBreakdown,
  computeDescriptiveStats,
} from './stats.js';
import { buildGroups, uniqueSorted, aggregateByDocente } from './groups.js';

const XLS_COLORS = {
  brand: 'FF9C1F06',
  brandLight: 'FFF8E9E7',
  headerText: 'FFFFFFFF',
  greyBg: 'FFF4F7FB',
  border: 'FFD9D9D9',
  green: 'FF34A853', greenBg: 'FFE6F4EA',
  yellow: 'FFFBBC05', yellowBg: 'FFFEF7E0',
  red: 'FFEA4335', redBg: 'FFFCE8E6'
};

function scoreFillArgb(score) {
  if (score >= 16) return XLS_COLORS.greenBg;
  if (score >= 11) return XLS_COLORS.yellowBg;
  return XLS_COLORS.redBg;
}
function scoreFontArgb(score) {
  if (score >= 16) return 'FF1E7E34';
  if (score >= 11) return 'FF8A6D00';
  return 'FFB3261E';
}
function pctFillArgb(pct) {
  if (pct >= 70) return XLS_COLORS.greenBg;
  if (pct >= 40) return XLS_COLORS.yellowBg;
  return XLS_COLORS.redBg;
}

function thinBorder() {
  const s = { style: 'thin', color: { argb: XLS_COLORS.border } };
  return { top: s, left: s, bottom: s, right: s };
}

function styleSectionHeader(ws, rowNum, lastCol, text) {
  ws.mergeCells(rowNum, 1, rowNum, lastCol);
  const cell = ws.getCell(rowNum, 1);
  cell.value = text;
  cell.font = { bold: true, color: { argb: XLS_COLORS.headerText }, size: 12 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLS_COLORS.brand } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(rowNum).height = 22;
}

/* ---- Generación de imágenes de gráficos (para embeber en el Excel) ---- */

function chartConfigToImage(config, width, height) {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const cfg = JSON.parse(JSON.stringify(config, (key, val) => (typeof val === 'function' ? undefined : val)));
    cfg.options = cfg.options || {};
    cfg.options.responsive = false;
    cfg.options.animation = false;
    cfg.options.maintainAspectRatio = false;
    cfg.options.devicePixelRatio = 2;
    const chart = new Chart(canvas, cfg);
    // Chart.js dibuja de forma síncrona cuando animation:false, pero damos un tick de margen por seguridad.
    setTimeout(() => {
      const dataUrl = canvas.toDataURL('image/png');
      chart.destroy();
      resolve(dataUrl);
    }, 30);
  });
}

function buildCriteriaChartConfigForExport(criteriaAvgs, shortCriteriaLabels) {
  return {
    type: 'bar',
    data: {
      labels: shortCriteriaLabels,
      datasets: [{
        label: 'Promedio (escala 20)',
        data: criteriaAvgs.map(v => Math.round(v * 10) / 10),
        backgroundColor: '#9C1F06',
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false }, title: { display: true, text: 'Promedio por criterio evaluado (escala 0–20)', font: { size: 13 } } },
      scales: { x: { min: 0, max: 20 } }
    }
  };
}

function buildDirectivesPieConfigForExport(counts) {
  return {
    type: 'pie',
    data: {
      labels: ['Sí', 'A veces', 'No'],
      datasets: [{
        data: [counts.si, counts.av, counts.no],
        backgroundColor: ['#34A853', '#FBBC05', '#EA4335'],
        borderWidth: 2,
        borderColor: '#FFFFFF'
      }]
    },
    options: {
      plugins: {
        legend: { position: 'right' },
        title: { display: true, text: 'Cumplimiento de directivas académicas', font: { size: 13 } }
      }
    }
  };
}

function buildCoursesNotaChartConfigForExport(courseGroups) {
  return {
    type: 'bar',
    data: {
      labels: courseGroups.map(g => g.curso.length > 22 ? g.curso.slice(0, 20) + '…' : g.curso),
      datasets: [{
        label: 'Nota Dim I (0–20)',
        data: courseGroups.map(g => g.nota),
        backgroundColor: courseGroups.map(g => g.nota >= 16 ? '#34A853' : (g.nota >= 11 ? '#FBBC05' : '#EA4335')),
        borderRadius: 4
      }]
    },
    options: {
      plugins: { legend: { display: false }, title: { display: true, text: 'Nota Dim I por curso dictado', font: { size: 13 } } },
      scales: { y: { min: 0, max: 20 } }
    }
  };
}

/**
 * Genera y descarga el Reporte Oficial de Evaluación Docente en formato .xlsx.
 *
 * Sustituye los accesos a `STATE`/DOM del original por parámetros explícitos:
 *  - programa, docente, curso            <- STATE.docente.{programa,selected,curso}
 *  - rows                                <- rowsDocenteCurso (filas del docente+curso seleccionados)
 *  - allDocenteRows                      <- allDocenteRows (filas del docente, todos los cursos)
 *  - criteriaLabels, directiveLabels,
 *    shortCriteriaLabels                 <- STATE.criteriaLabels / STATE.directiveLabels / STATE.shortCriteriaLabels
 *
 * El manejo del botón (texto/disabled) queda a cargo del llamador (componente React),
 * ya que aquí no debe tocarse el DOM salvo el enlace de descarga temporal.
 */
export async function exportToExcel({
  programa,
  docente,
  curso,
  rows,
  rawRows,
  allDocenteRows,
  criteriaLabels,
  directiveLabels,
  shortCriteriaLabels,
  coursesTableGroups,
}) {
  const rowsDocenteCurso = rows;
  const rawRowsDocenteCurso = rawRows || rows;

  if (!rowsDocenteCurso || rowsDocenteCurso.length === 0) {
    alert('No hay datos para exportar.');
    return;
  }

  const totalEncuestas = rowsDocenteCurso.length;
  const criteriaAvgs = computeCriteriaAverages(rowsDocenteCurso, criteriaLabels.length);
  const notaFinal = criteriaAvgs.reduce((a, b) => a + b, 0) / criteriaAvgs.length;
  const directivasBreakdown = computeDirectiveBreakdown(rowsDocenteCurso, directiveLabels);
  const notaStats = computeDescriptiveStats(rowsDocenteCurso.map(r => r.notaFinal));
  const first = rowsDocenteCurso[0];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Dashboard de Evaluación Docente · UNMSM FCA';
  workbook.created = new Date();

  /* ============ HOJA 1: RESUMEN ============ */
  const wsR = workbook.addWorksheet('Resumen', { properties: { tabColor: { argb: XLS_COLORS.brand } } });
  wsR.columns = [{ width: 4 }, { width: 42 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 12 }];

  wsR.mergeCells('B2:F2');
  wsR.getCell('B2').value = 'REPORTE OFICIAL DE EVALUACIÓN DOCENTE';
  wsR.getCell('B2').font = { bold: true, size: 15, color: { argb: XLS_COLORS.brand } };

  wsR.mergeCells('B3:F3');
  wsR.getCell('B3').value = 'Unidad de Posgrado · Facultad de Ciencias Administrativas · UNMSM';
  wsR.getCell('B3').font = { size: 10, italic: true, color: { argb: 'FF64748B' } };

  const infoRows = [
    ['Docente', first.docente],
    ['Programa', first.programa],
    ['Curso', curso || 'Todos los cursos'],
    ['Ciclo(s)', uniqueSorted(rowsDocenteCurso, 'ciclo').join(', ')],
    ['Sección(es)', uniqueSorted(rowsDocenteCurso, 'seccion').join(', ')],
    ['N° de Encuestas', totalEncuestas],
    ['Fecha de generación', new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })]
  ];
  let r = 5;
  infoRows.forEach(([label, val]) => {
    wsR.getCell(r, 2).value = label;
    wsR.getCell(r, 2).font = { bold: true, color: { argb: 'FF64748B' } };
    wsR.mergeCells(r, 3, r, 6);
    wsR.getCell(r, 3).value = val;
    r++;
  });
  r += 1;

  // KPI destacados
  wsR.mergeCells(r, 2, r, 3);
  wsR.getCell(r, 2).value = 'NOTA FINAL – DIMENSIÓN I';
  wsR.getCell(r, 2).font = { bold: true, color: { argb: XLS_COLORS.headerText } };
  wsR.getCell(r, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLS_COLORS.brand } };
  wsR.getCell(r, 2).alignment = { horizontal: 'center', vertical: 'middle' };
  wsR.getCell(r, 4).value = notaFinal;
  wsR.getCell(r, 4).numFmt = '0.0';
  wsR.getCell(r, 4).font = { bold: true, size: 14, color: { argb: scoreFontArgb(notaFinal) } };
  wsR.getCell(r, 4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: scoreFillArgb(notaFinal) } };
  wsR.getCell(r, 4).alignment = { horizontal: 'center', vertical: 'middle' };

  wsR.getCell(r, 5).value = '% Cumplimiento';
  wsR.getCell(r, 5).font = { bold: true, size: 9, color: { argb: 'FF64748B' } };
  const pctSiGlobal = computeDirectiveCounts(rowsDocenteCurso).pctSi;
  wsR.getCell(r + 1, 5).value = pctSiGlobal / 100;
  wsR.getCell(r + 1, 5).numFmt = '0.0%';
  wsR.getCell(r + 1, 5).font = { bold: true, size: 13 };
  wsR.getCell(r + 1, 5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pctFillArgb(pctSiGlobal) } };
  wsR.getCell(r + 1, 5).alignment = { horizontal: 'center' };

  wsR.getRow(r).height = 26;
  r += 3;

  // Estadísticas descriptivas
  styleSectionHeader(wsR, r, 6, 'Estadísticas descriptivas · Nota Dim. I (escala 1–20)');
  r++;
  const statPairs = [
    ['N° de Respuestas', notaStats.n, 'Suma', notaStats.sum],
    ['Promedio', notaStats.avg, 'Desv. Estándar', notaStats.stddev],
    ['Máximo', notaStats.max, 'Mínimo', notaStats.min]
  ];
  statPairs.forEach(([l1, v1, l2, v2]) => {
    wsR.getCell(r, 2).value = l1; wsR.getCell(r, 2).font = { color: { argb: 'FF64748B' } };
    wsR.getCell(r, 3).value = v1; wsR.getCell(r, 3).font = { bold: true }; wsR.getCell(r, 3).alignment = { horizontal: 'center' };
    wsR.getCell(r, 4).value = l2; wsR.getCell(r, 4).font = { color: { argb: 'FF64748B' } };
    wsR.getCell(r, 5).value = v2; wsR.getCell(r, 5).font = { bold: true }; wsR.getCell(r, 5).alignment = { horizontal: 'center' };
    r++;
  });
  r++;

  // I. Criterios
  styleSectionHeader(wsR, r, 6, 'I. Evaluación del desarrollo del curso por el docente');
  r++;
  wsR.getCell(r, 2).value = 'Criterio evaluado';
  wsR.mergeCells(r, 2, r, 4);
  wsR.getCell(r, 5).value = 'Promedio (0–20)';
  [2, 5].forEach(c => {
    wsR.getCell(r, c).font = { bold: true };
    wsR.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLS_COLORS.greyBg } };
    wsR.getCell(r, c).border = thinBorder();
  });
  r++;
  criteriaLabels.forEach((label, idx) => {
    wsR.mergeCells(r, 2, r, 4);
    wsR.getCell(r, 2).value = label;
    wsR.getCell(r, 2).border = thinBorder();
    wsR.getCell(r, 5).value = criteriaAvgs[idx];
    wsR.getCell(r, 5).numFmt = '0.0';
    wsR.getCell(r, 5).font = { bold: true, color: { argb: scoreFontArgb(criteriaAvgs[idx]) } };
    wsR.getCell(r, 5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: scoreFillArgb(criteriaAvgs[idx]) } };
    wsR.getCell(r, 5).alignment = { horizontal: 'center' };
    wsR.getCell(r, 5).border = thinBorder();
    r++;
  });
  r++;

  // II. Directivas
  styleSectionHeader(wsR, r, 7, 'II. Cumplimiento de directivas académicas');
  r++;
  const dirHeaders = ['Directiva', 'Sí (N°)', 'No (N°)', 'A veces (N°)', '% Sí', '% No'];
  dirHeaders.forEach((h, i) => {
    const c = wsR.getCell(r, i + 2);
    c.value = h;
    c.font = { bold: true, color: { argb: XLS_COLORS.headerText } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF64748B' } };
    c.alignment = { horizontal: 'center' };
    c.border = thinBorder();
  });
  r++;
  directivasBreakdown.forEach(d => {
    wsR.getCell(r, 2).value = d.label;
    wsR.getCell(r, 3).value = d.si;
    wsR.getCell(r, 4).value = d.no;
    wsR.getCell(r, 5).value = d.av;
    wsR.getCell(r, 6).value = d.pctSi / 100;
    wsR.getCell(r, 6).numFmt = '0.0%';
    wsR.getCell(r, 6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pctFillArgb(d.pctSi) } };
    wsR.getCell(r, 7).value = d.pctNo / 100;
    wsR.getCell(r, 7).numFmt = '0.0%';
    wsR.getCell(r, 7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: d.pctNo >= 30 ? XLS_COLORS.redBg : XLS_COLORS.greyBg } };
    for (let c = 2; c <= 7; c++) {
      wsR.getCell(r, c).border = thinBorder();
      if (c !== 2) wsR.getCell(r, c).alignment = wsR.getCell(r, c).alignment || { horizontal: 'center' };
    }
    wsR.getCell(r, 2).alignment = { horizontal: 'left' };
    r++;
  });

  // Gráficos incrustados (imágenes generadas a partir de los mismos datos del reporte)
  const critChartImg = await chartConfigToImage(buildCriteriaChartConfigForExport(criteriaAvgs, shortCriteriaLabels), 480, 260);
  const critImgId = workbook.addImage({ base64: critChartImg, extension: 'png' });
  wsR.addImage(critImgId, { tl: { col: 8, row: 3 }, ext: { width: 480, height: 260 } });

  const dirChartImg = await chartConfigToImage(buildDirectivesPieConfigForExport(computeDirectiveCounts(rowsDocenteCurso)), 420, 260);
  const dirImgId = workbook.addImage({ base64: dirChartImg, extension: 'png' });
  wsR.addImage(dirImgId, { tl: { col: 8, row: 21 }, ext: { width: 420, height: 260 } });

  /* ============ HOJA 2: CURSOS DICTADOS ============ */
  const wsC = workbook.addWorksheet('Cursos Dictados', { properties: { tabColor: { argb: XLS_COLORS.brand } } });
  const courseGroups = (coursesTableGroups || buildGroups(allDocenteRows)).sort((a, b) =>
    String(b.ciclo).localeCompare(String(a.ciclo), 'es') || a.curso.localeCompare(b.curso, 'es'));

  wsC.columns = [
    { header: 'Curso', key: 'curso', width: 30 },
    { header: 'Ciclo', key: 'ciclo', width: 12 },
    { header: 'Sección', key: 'seccion', width: 12 },
    { header: 'Aula', key: 'aula', width: 12 },
    { header: 'Nota Dim I', key: 'nota', width: 12 },
    { header: '% Cumplimiento (Sí)', key: 'cumplimiento', width: 18 },
    { header: 'N° Encuestas', key: 'n', width: 13 }
  ];
  wsC.getRow(1).eachCell(c => {
    c.font = { bold: true, color: { argb: XLS_COLORS.headerText } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLS_COLORS.brand } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  wsC.getRow(1).height = 20;
  courseGroups.forEach(g => {
    const row = wsC.addRow({ curso: g.curso, ciclo: g.ciclo, seccion: g.seccion, aula: g.aula, nota: g.nota, cumplimiento: g.cumplimiento / 100, n: g.nValidas ?? g.n });
    row.getCell('nota').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: scoreFillArgb(g.nota) } };
    row.getCell('nota').font = { bold: true, color: { argb: scoreFontArgb(g.nota) } };
    row.getCell('nota').numFmt = '0.0';
    row.getCell('cumplimiento').numFmt = '0.0%';
    row.getCell('cumplimiento').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pctFillArgb(g.cumplimiento) } };
    row.eachCell(c => { c.border = thinBorder(); c.alignment = c.alignment || { horizontal: 'center' }; });
    row.getCell('curso').alignment = { horizontal: 'left' };
  });
  wsC.autoFilter = { from: 'A1', to: 'G1' };
  wsC.views = [{ state: 'frozen', ySplit: 1 }];

  if (courseGroups.length > 1) {
    const coursesChartImg = await chartConfigToImage(buildCoursesNotaChartConfigForExport(courseGroups), 560, 280);
    const coursesImgId = workbook.addImage({ base64: coursesChartImg, extension: 'png' });
    wsC.addImage(coursesImgId, { tl: { col: 8, row: 1 }, ext: { width: 560, height: 280 } });
  }

  /* ============ HOJA 3: DETALLE DE ENCUESTADOS ============ */
  const wsD = workbook.addWorksheet('Detalle de Encuestados', { properties: { tabColor: { argb: XLS_COLORS.brand } } });
  wsD.getColumn(1).width = 46;
  rawRowsDocenteCurso.forEach((_, i) => { wsD.getColumn(i + 2).width = 8; });

  const headRow = wsD.getRow(1);
  headRow.getCell(1).value = 'Criterio / Directiva evaluada';
  rawRowsDocenteCurso.forEach((_, i) => { headRow.getCell(i + 2).value = 'E' + (i + 1); });
  headRow.eachCell(c => {
    c.font = { bold: true, color: { argb: XLS_COLORS.headerText } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLS_COLORS.brand } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = thinBorder();
  });
  headRow.height = 20;

  let dr = 2;
  const nCols = rawRowsDocenteCurso.length + 1;
  wsD.mergeCells(dr, 1, dr, nCols);
  wsD.getCell(dr, 1).value = 'I. Evaluación del desarrollo del curso por el docente';
  wsD.getCell(dr, 1).font = { bold: true };
  wsD.getCell(dr, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLS_COLORS.brandLight } };
  dr++;
  criteriaLabels.forEach((label, idx) => {
    wsD.getCell(dr, 1).value = (idx + 1) + '. ' + label;
    wsD.getCell(dr, 1).border = thinBorder();
    rawRowsDocenteCurso.forEach((row, i) => {
      const val = row.scores[idx];
      const cell = wsD.getCell(dr, i + 2);
      cell.value = val !== null ? val : '-';
      cell.alignment = { horizontal: 'center' };
      cell.border = thinBorder();
    });
    dr++;
  });

  wsD.mergeCells(dr, 1, dr, nCols);
  wsD.getCell(dr, 1).value = 'II. Cumplimiento de directivas';
  wsD.getCell(dr, 1).font = { bold: true };
  wsD.getCell(dr, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLS_COLORS.brandLight } };
  dr++;
  directiveLabels.forEach((dirLabel, idx) => {
    wsD.getCell(dr, 1).value = (idx + 7) + '. ' + dirLabel;
    wsD.getCell(dr, 1).border = thinBorder();
    rawRowsDocenteCurso.forEach((row, i) => {
      const dirObj = row.directivas.find(d => d.label === dirLabel);
      const val = dirObj ? dirObj.value : '-';
      const cell = wsD.getCell(dr, i + 2);
      cell.value = val;
      cell.alignment = { horizontal: 'center' };
      cell.border = thinBorder();
      if (val === 'No') { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLS_COLORS.redBg } }; cell.font = { color: { argb: 'FFB3261E' } }; }
      else if (val === 'Sí') { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLS_COLORS.greenBg } }; cell.font = { color: { argb: 'FF1E7E34' } }; }
      else if (val === 'A veces') { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLS_COLORS.yellowBg } }; cell.font = { color: { argb: 'FF8A6D00' } }; }
    });
    dr++;
  });
  wsD.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Reporte_Oficial_${docente.replace(/\s+/g, '_')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ===================== EXPORTACIÓN GENERAL · VISTA DIRECTOR ==================== */
/**
 * Genera y descarga un Excel con el resumen general de la Vista Director del
 * alcance filtrado: indicadores, promedio por criterio y cumplimiento de
 * directivas (con gráficos incrustados) + la tabla de detalle por docente/curso.
 */
export async function exportDirectorToExcel({
  rows,
  groups,
  criteriaLabels,
  directiveLabels,
  shortCriteriaLabels,
  filters,
}) {
  if (!rows || rows.length === 0) {
    alert('No hay datos para exportar.');
    return;
  }

  const promedioGeneral = rows.reduce((a, row) => a + row.notaFinal, 0) / rows.length;
  const dirCounts = computeDirectiveCounts(rows);
  const totalEncuestas = rows.length;
  const totalDocentes = new Set(rows.map((row) => row.docente)).size;
  const criteriaAvgs = computeCriteriaAverages(rows, criteriaLabels.length);
  const directivasBreakdown = computeDirectiveBreakdown(rows, directiveLabels);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Dashboard de Evaluación Docente · UNMSM FCA';
  workbook.created = new Date();

  /* ============ HOJA 1: RESUMEN GENERAL ============ */
  const wsR = workbook.addWorksheet('Resumen', { properties: { tabColor: { argb: XLS_COLORS.brand } } });
  wsR.columns = [{ width: 4 }, { width: 44 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 }];

  wsR.mergeCells('B2:F2');
  wsR.getCell('B2').value = 'REPORTE GENERAL · VISTA DIRECTOR DE CARRERA';
  wsR.getCell('B2').font = { bold: true, size: 15, color: { argb: XLS_COLORS.brand } };
  wsR.mergeCells('B3:F3');
  wsR.getCell('B3').value = 'Unidad de Posgrado · Facultad de Ciencias Administrativas (UNMSM)';
  wsR.getCell('B3').font = { size: 10, color: { argb: 'FF666666' } };

  let r = 5;

  if (filters) {
    wsR.mergeCells(r, 2, r, 6);
    wsR.getCell(r, 2).value = 'Filtros aplicados en este reporte:';
    wsR.getCell(r, 2).font = { bold: true, color: { argb: XLS_COLORS.brand } };
    r++;
    
    const fRows = [];
    if (filters.categoria) fRows.push(['Categoría', filters.categoria]);
    if (filters.estado) fRows.push(['Estado', filters.estado === 'aprobado' ? 'Aprobados' : 'Desaprobados']);
    if (filters.programa) fRows.push(['Programa', filters.programa]);
    if (filters.ciclo.length > 0) fRows.push(['Ciclo', filters.ciclo.join(', ')]);
    if (filters.seccion) fRows.push(['Sección', filters.seccion]);
    if (filters.docente) fRows.push(['Docente', filters.docente]);

    if (fRows.length === 0) {
      wsR.getCell(r, 2).value = 'Todos (sin filtros)';
      r++;
    } else {
      fRows.forEach(([key, val]) => {
        wsR.getCell(r, 2).value = key + ':';
        wsR.getCell(r, 2).font = { bold: true, color: { argb: 'FF64748B' } };
        wsR.mergeCells(r, 3, r, 6);
        wsR.getCell(r, 3).value = val;
        r++;
      });
    }
    r++;
  }

  // Indicadores generales (KPIs)
  styleSectionHeader(wsR, r, 6, 'Indicadores generales');
  r++;
  const kpis = [
    ['Promedio general (escala 1–20)', Math.round(promedioGeneral * 10) / 10, '0.0'],
    ['% Cumplimiento de directivas (Sí)', dirCounts.pctSi / 100, '0%'],
    ['Total de encuestas', totalEncuestas, '0'],
    ['Total de docentes', totalDocentes, '0'],
    ['Grupos docente/curso', groups.length, '0'],
  ];
  kpis.forEach(([label, val, fmt]) => {
    wsR.getCell(r, 2).value = label;
    wsR.getCell(r, 2).border = thinBorder();
    const c = wsR.getCell(r, 3);
    c.value = val;
    c.numFmt = fmt;
    c.font = { bold: true, color: { argb: XLS_COLORS.brand } };
    c.alignment = { horizontal: 'center' };
    c.border = thinBorder();
    r++;
  });
  r++;

  // Promedio por criterio
  styleSectionHeader(wsR, r, 6, 'Promedio por criterio evaluado (escala 0–20)');
  r++;
  wsR.getCell(r, 2).value = 'Criterio evaluado';
  wsR.mergeCells(r, 2, r, 4);
  wsR.getCell(r, 5).value = 'Promedio (0–20)';
  [2, 5].forEach((c) => {
    wsR.getCell(r, c).font = { bold: true };
    wsR.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLS_COLORS.greyBg } };
    wsR.getCell(r, c).border = thinBorder();
  });
  r++;
  criteriaLabels.forEach((label, idx) => {
    wsR.mergeCells(r, 2, r, 4);
    wsR.getCell(r, 2).value = label;
    wsR.getCell(r, 2).border = thinBorder();
    const avg = criteriaAvgs[idx];
    const c = wsR.getCell(r, 5);
    c.value = avg;
    c.numFmt = '0.0';
    c.font = { bold: true, color: { argb: scoreFontArgb(avg) } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: scoreFillArgb(avg) } };
    c.alignment = { horizontal: 'center' };
    c.border = thinBorder();
    r++;
  });
  r++;

  // Cumplimiento de directivas
  styleSectionHeader(wsR, r, 7, 'Cumplimiento de directivas académicas');
  r++;
  const dirHeaders = ['Directiva', 'Sí (N°)', 'No (N°)', 'A veces (N°)', '% Sí', '% No'];
  dirHeaders.forEach((h, i) => {
    const c = wsR.getCell(r, i + 2);
    c.value = h;
    c.font = { bold: true, color: { argb: XLS_COLORS.headerText } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF64748B' } };
    c.alignment = { horizontal: 'center' };
    c.border = thinBorder();
  });
  r++;
  directivasBreakdown.forEach((d) => {
    wsR.getCell(r, 2).value = d.label;
    wsR.getCell(r, 3).value = d.si;
    wsR.getCell(r, 4).value = d.no;
    wsR.getCell(r, 5).value = d.av;
    wsR.getCell(r, 6).value = d.pctSi / 100;
    wsR.getCell(r, 6).numFmt = '0.0%';
    wsR.getCell(r, 6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pctFillArgb(d.pctSi) } };
    wsR.getCell(r, 7).value = d.pctNo / 100;
    wsR.getCell(r, 7).numFmt = '0.0%';
    wsR.getCell(r, 7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: d.pctNo >= 30 ? XLS_COLORS.redBg : XLS_COLORS.greyBg } };
    for (let c = 2; c <= 7; c++) {
      wsR.getCell(r, c).border = thinBorder();
      if (c !== 2) wsR.getCell(r, c).alignment = { horizontal: 'center' };
    }
    r++;
  });

  // Gráficos incrustados (mismos datos que el reporte)
  const critChartImg = await chartConfigToImage(buildCriteriaChartConfigForExport(criteriaAvgs, shortCriteriaLabels), 480, 260);
  const critImgId = workbook.addImage({ base64: critChartImg, extension: 'png' });
  wsR.addImage(critImgId, { tl: { col: 8, row: 3 }, ext: { width: 480, height: 260 } });

  const dirChartImg = await chartConfigToImage(buildDirectivesPieConfigForExport(dirCounts), 420, 260);
  const dirImgId = workbook.addImage({ base64: dirChartImg, extension: 'png' });
  wsR.addImage(dirImgId, { tl: { col: 8, row: 21 }, ext: { width: 420, height: 260 } });

  /* ============ HOJA 2: DETALLE POR DOCENTE/CURSO ============ */
  const wsD = workbook.addWorksheet('Detalle', { properties: { tabColor: { argb: XLS_COLORS.brand } } });
  const detCols = ['Docente', 'Programa', 'Cursos', 'Nota Dim I', '% Cumpl. (Sí)', 'N° Encuestas'];
  wsD.columns = [
    { width: 34 }, { width: 25 }, { width: 50 }, { width: 12 }, { width: 14 }, { width: 13 },
  ];
  detCols.forEach((h, i) => {
    const c = wsD.getCell(1, i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: XLS_COLORS.headerText } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLS_COLORS.brand } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = thinBorder();
  });
  let dr = 2;
  const aggregatedGroups = aggregateByDocente(groups).sort((a, b) => b.nota - a.nota);
  aggregatedGroups.forEach((g) => {
    wsD.getCell(dr, 1).value = g.docente;
    wsD.getCell(dr, 2).value = g.programa;
    const cursoCell = wsD.getCell(dr, 3);
    cursoCell.value = g.curso;
    
    // Configurar alineación para que el texto salte de línea si hay varios cursos
    wsD.getCell(dr, 1).alignment = { wrapText: true, vertical: 'top' };
    wsD.getCell(dr, 2).alignment = { wrapText: true, vertical: 'top' };
    cursoCell.alignment = { wrapText: true, vertical: 'top' };
    
    const notaCell = wsD.getCell(dr, 4);
    notaCell.value = g.nota;
    notaCell.numFmt = '0.0';
    notaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: scoreFillArgb(g.nota) } };
    notaCell.font = { bold: true, color: { argb: scoreFontArgb(g.nota) } };
    
    const pctCell = wsD.getCell(dr, 5);
    pctCell.value = g.cumplimiento / 100;
    pctCell.numFmt = '0%';
    pctCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pctFillArgb(g.cumplimiento) } };
    
    wsD.getCell(dr, 6).value = g.n;
    
    for (let c = 1; c <= 6; c++) {
      wsD.getCell(dr, c).border = thinBorder();
      if (c >= 4) {
        wsD.getCell(dr, c).alignment = { horizontal: 'center', vertical: 'top' };
      }
    }
    dr++;
  });
  wsD.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 6 } };
  wsD.views = [{ state: 'frozen', ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Reporte_General_Director.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportCursoToExcel({
  programa,
  curso,
  rows,
  rawRows,
  criteriaLabels,
  directiveLabels,
  shortCriteriaLabels,
  docentesTableGroups,
}) {
  if (!rows || rows.length === 0) {
    alert('No hay datos para exportar.');
    return;
  }
  const rawRowsForDetalle = rawRows || rows;

  const totalEncuestas = rows.length;
  const criteriaAvgs = computeCriteriaAverages(rows, criteriaLabels.length);
  const notaFinal = criteriaAvgs.reduce((a, b) => a + b, 0) / criteriaAvgs.length;
  const directivasBreakdown = computeDirectiveBreakdown(rows, directiveLabels);
  const notaStats = computeDescriptiveStats(rows.map(r => r.notaFinal));
  const first = rows[0];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Dashboard de Evaluación Docente · UNMSM FCA';
  workbook.created = new Date();

  /* ============ HOJA 1: RESUMEN ============ */
  const wsR = workbook.addWorksheet('Resumen', { properties: { tabColor: { argb: XLS_COLORS.brand } } });
  wsR.columns = [{ width: 4 }, { width: 42 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 12 }];

  wsR.mergeCells('B2:F2');
  wsR.getCell('B2').value = 'REPORTE OFICIAL DE DESEMPEÑO DEL CURSO';
  wsR.getCell('B2').font = { bold: true, size: 15, color: { argb: XLS_COLORS.brand } };

  wsR.mergeCells('B3:F3');
  wsR.getCell('B3').value = 'Unidad de Posgrado · Facultad de Ciencias Administrativas · UNMSM';
  wsR.getCell('B3').font = { size: 10, italic: true, color: { argb: 'FF64748B' } };

  const infoRows = [
    ['Curso', curso || first.curso],
    ['Programa', programa || first.programa],
    ['Ciclo(s)', uniqueSorted(rows, 'ciclo').join(', ')],
    ['Sección(es)', uniqueSorted(rows, 'seccion').join(', ')],
    ['Docentes para este curso', uniqueSorted(rows, 'docente').length],
    ['N° de Encuestas', totalEncuestas],
    ['Fecha de generación', new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })]
  ];
  let r = 5;
  infoRows.forEach(([label, val]) => {
    wsR.getCell(r, 2).value = label;
    wsR.getCell(r, 2).font = { bold: true, color: { argb: 'FF64748B' } };
    wsR.mergeCells(r, 3, r, 6);
    wsR.getCell(r, 3).value = val;
    r++;
  });
  r += 1;

  // KPI destacados
  wsR.mergeCells(r, 2, r, 3);
  wsR.getCell(r, 2).value = 'NOTA FINAL – DIMENSIÓN I';
  wsR.getCell(r, 2).font = { bold: true, color: { argb: XLS_COLORS.headerText } };
  wsR.getCell(r, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLS_COLORS.brand } };
  wsR.getCell(r, 2).alignment = { horizontal: 'center', vertical: 'middle' };
  wsR.getCell(r, 4).value = notaFinal;
  wsR.getCell(r, 4).numFmt = '0.0';
  wsR.getCell(r, 4).font = { bold: true, size: 14, color: { argb: scoreFontArgb(notaFinal) } };
  wsR.getCell(r, 4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: scoreFillArgb(notaFinal) } };
  wsR.getCell(r, 4).alignment = { horizontal: 'center', vertical: 'middle' };

  wsR.getCell(r, 5).value = '% Cumplimiento';
  wsR.getCell(r, 5).font = { bold: true, size: 9, color: { argb: 'FF64748B' } };
  const pctSiGlobal = computeDirectiveCounts(rows).pctSi;
  wsR.getCell(r + 1, 5).value = pctSiGlobal / 100;
  wsR.getCell(r + 1, 5).numFmt = '0.0%';
  wsR.getCell(r + 1, 5).font = { bold: true, size: 13 };
  wsR.getCell(r + 1, 5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pctFillArgb(pctSiGlobal) } };
  wsR.getCell(r + 1, 5).alignment = { horizontal: 'center' };

  wsR.getRow(r).height = 26;
  r += 3;

  // Estadísticas descriptivas
  styleSectionHeader(wsR, r, 6, 'Estadísticas descriptivas · Nota Dim. I (escala 1–20)');
  r++;
  const statPairs = [
    ['N° de Respuestas', notaStats.n, 'Suma', notaStats.sum],
    ['Promedio', notaStats.avg, 'Desv. Estándar', notaStats.stddev],
    ['Máximo', notaStats.max, 'Mínimo', notaStats.min]
  ];
  statPairs.forEach(([l1, v1, l2, v2]) => {
    wsR.getCell(r, 2).value = l1; wsR.getCell(r, 2).font = { color: { argb: 'FF64748B' } };
    wsR.getCell(r, 3).value = v1; wsR.getCell(r, 3).font = { bold: true }; wsR.getCell(r, 3).alignment = { horizontal: 'center' };
    wsR.getCell(r, 4).value = l2; wsR.getCell(r, 4).font = { color: { argb: 'FF64748B' } };
    wsR.getCell(r, 5).value = v2; wsR.getCell(r, 5).font = { bold: true }; wsR.getCell(r, 5).alignment = { horizontal: 'center' };
    r++;
  });
  r++;

  // I. Criterios
  styleSectionHeader(wsR, r, 6, 'I. Evaluación del desarrollo del curso');
  r++;
  wsR.getCell(r, 2).value = 'Criterio evaluado';
  wsR.mergeCells(r, 2, r, 4);
  wsR.getCell(r, 5).value = 'Promedio (0–20)';
  [2, 5].forEach(c => {
    wsR.getCell(r, c).font = { bold: true };
    wsR.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLS_COLORS.greyBg } };
    wsR.getCell(r, c).border = thinBorder();
  });
  r++;
  criteriaLabels.forEach((label, idx) => {
    wsR.mergeCells(r, 2, r, 4);
    wsR.getCell(r, 2).value = label;
    wsR.getCell(r, 2).border = thinBorder();
    wsR.getCell(r, 5).value = criteriaAvgs[idx];
    wsR.getCell(r, 5).numFmt = '0.0';
    wsR.getCell(r, 5).font = { bold: true, color: { argb: scoreFontArgb(criteriaAvgs[idx]) } };
    wsR.getCell(r, 5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: scoreFillArgb(criteriaAvgs[idx]) } };
    wsR.getCell(r, 5).alignment = { horizontal: 'center' };
    wsR.getCell(r, 5).border = thinBorder();
    r++;
  });
  r++;

  // II. Directivas
  styleSectionHeader(wsR, r, 7, 'II. Cumplimiento de directivas académicas');
  r++;
  const dirHeaders = ['Directiva', 'Sí (N°)', 'No (N°)', 'A veces (N°)', '% Sí', '% No'];
  dirHeaders.forEach((h, i) => {
    const c = wsR.getCell(r, i + 2);
    c.value = h;
    c.font = { bold: true, color: { argb: XLS_COLORS.headerText } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF64748B' } };
    c.alignment = { horizontal: 'center' };
    c.border = thinBorder();
  });
  r++;
  directivasBreakdown.forEach(d => {
    wsR.getCell(r, 2).value = d.label;
    wsR.getCell(r, 3).value = d.si;
    wsR.getCell(r, 4).value = d.no;
    wsR.getCell(r, 5).value = d.av;
    wsR.getCell(r, 6).value = d.pctSi / 100;
    wsR.getCell(r, 6).numFmt = '0.0%';
    wsR.getCell(r, 6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pctFillArgb(d.pctSi) } };
    wsR.getCell(r, 7).value = d.pctNo / 100;
    wsR.getCell(r, 7).numFmt = '0.0%';
    wsR.getCell(r, 7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: d.pctNo >= 30 ? XLS_COLORS.redBg : XLS_COLORS.greyBg } };
    for (let c = 2; c <= 7; c++) {
      wsR.getCell(r, c).border = thinBorder();
      if (c !== 2) wsR.getCell(r, c).alignment = wsR.getCell(r, c).alignment || { horizontal: 'center' };
    }
    wsR.getCell(r, 2).alignment = { horizontal: 'left' };
    r++;
  });

  const critChartImg = await chartConfigToImage(buildCriteriaChartConfigForExport(criteriaAvgs, shortCriteriaLabels), 480, 260);
  const critImgId = workbook.addImage({ base64: critChartImg, extension: 'png' });
  wsR.addImage(critImgId, { tl: { col: 8, row: 3 }, ext: { width: 480, height: 260 } });

  const dirChartImg = await chartConfigToImage(buildDirectivesPieConfigForExport(computeDirectiveCounts(rows)), 420, 260);
  const dirImgId = workbook.addImage({ base64: dirChartImg, extension: 'png' });
  wsR.addImage(dirImgId, { tl: { col: 8, row: 21 }, ext: { width: 420, height: 260 } });

  /* ============ HOJA 2: DOCENTES ============ */
  const wsC = workbook.addWorksheet('Docentes', { properties: { tabColor: { argb: XLS_COLORS.brand } } });
  const groups = (docentesTableGroups || buildGroups(rows)).sort((a, b) =>
    a.docente.localeCompare(b.docente, 'es') || String(a.ciclo).localeCompare(String(b.ciclo), 'es'));

  wsC.columns = [
    { header: 'Docente', key: 'docente', width: 34 },
    { header: 'Ciclo', key: 'ciclo', width: 12 },
    { header: 'Sección', key: 'seccion', width: 12 },
    { header: 'Aula', key: 'aula', width: 12 },
    { header: 'Nota Dim I', key: 'nota', width: 12 },
    { header: '% Cumplimiento (Sí)', key: 'cumplimiento', width: 18 },
    { header: 'N° Encuestas', key: 'n', width: 13 }
  ];
  wsC.getRow(1).eachCell(c => {
    c.font = { bold: true, color: { argb: XLS_COLORS.headerText } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLS_COLORS.brand } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  wsC.getRow(1).height = 20;
  groups.forEach(g => {
    const row = wsC.addRow({ docente: g.docente, ciclo: g.ciclo, seccion: g.seccion, aula: g.aula, nota: g.nota, cumplimiento: g.cumplimiento / 100, n: g.nValidas ?? g.n });
    row.getCell('nota').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: scoreFillArgb(g.nota) } };
    row.getCell('nota').font = { bold: true, color: { argb: scoreFontArgb(g.nota) } };
    row.getCell('nota').numFmt = '0.0';
    row.getCell('cumplimiento').numFmt = '0.0%';
    row.getCell('cumplimiento').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pctFillArgb(g.cumplimiento) } };
    row.eachCell(c => { c.border = thinBorder(); c.alignment = c.alignment || { horizontal: 'center' }; });
    row.getCell('docente').alignment = { horizontal: 'left' };
  });
  wsC.autoFilter = { from: 'A1', to: 'G1' };
  wsC.views = [{ state: 'frozen', ySplit: 1 }];

  /* ============ HOJA 3: DETALLE DE ENCUESTADOS ============ */
  const wsD = workbook.addWorksheet('Detalle de Encuestados', { properties: { tabColor: { argb: XLS_COLORS.brand } } });
  wsD.getColumn(1).width = 46;
  rawRowsForDetalle.forEach((_, i) => { wsD.getColumn(i + 2).width = 8; });

  const headRow = wsD.getRow(1);
  headRow.getCell(1).value = 'Criterio / Directiva evaluada';
  rawRowsForDetalle.forEach((_, i) => { headRow.getCell(i + 2).value = 'E' + (i + 1); });
  headRow.eachCell(c => {
    c.font = { bold: true, color: { argb: XLS_COLORS.headerText } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLS_COLORS.brand } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = thinBorder();
  });
  headRow.height = 20;

  let dr = 2;
  const nCols = rawRowsForDetalle.length + 1;
  wsD.mergeCells(dr, 1, dr, nCols);
  wsD.getCell(dr, 1).value = 'I. Evaluación del desarrollo del curso';
  wsD.getCell(dr, 1).font = { bold: true };
  wsD.getCell(dr, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLS_COLORS.brandLight } };
  dr++;
  criteriaLabels.forEach((label, idx) => {
    wsD.getCell(dr, 1).value = (idx + 1) + '. ' + label;
    wsD.getCell(dr, 1).border = thinBorder();
    rawRowsForDetalle.forEach((row, i) => {
      const val = row.scores[idx];
      const cell = wsD.getCell(dr, i + 2);
      cell.value = val !== null ? val : '-';
      cell.alignment = { horizontal: 'center' };
      cell.border = thinBorder();
    });
    dr++;
  });

  wsD.mergeCells(dr, 1, dr, nCols);
  wsD.getCell(dr, 1).value = 'II. Cumplimiento de directivas';
  wsD.getCell(dr, 1).font = { bold: true };
  wsD.getCell(dr, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLS_COLORS.brandLight } };
  dr++;
  directiveLabels.forEach((dirLabel, idx) => {
    wsD.getCell(dr, 1).value = (idx + 7) + '. ' + dirLabel;
    wsD.getCell(dr, 1).border = thinBorder();
    rawRowsForDetalle.forEach((row, i) => {
      const dirObj = row.directivas.find(d => d.label === dirLabel);
      const val = dirObj ? dirObj.value : '-';
      const cell = wsD.getCell(dr, i + 2);
      cell.value = val;
      cell.alignment = { horizontal: 'center' };
      cell.border = thinBorder();
      if (val === 'No') { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLS_COLORS.redBg } }; cell.font = { color: { argb: 'FFB3261E' } }; }
      else if (val === 'Sí') { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLS_COLORS.greenBg } }; cell.font = { color: { argb: 'FF1E7E34' } }; }
      else if (val === 'A veces') { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLS_COLORS.yellowBg } }; cell.font = { color: { argb: 'FF8A6D00' } }; }
    });
    dr++;
  });
  wsD.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileNameCurso = curso || first.curso;
  a.download = `Reporte_Curso_${fileNameCurso.replace(/\s+/g, '_')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
