import { computeDescriptiveStats, computeDirectiveCounts, computeCriteriaAverages } from '../../lib/stats.js';

/* Portado desde reference/dashboard_evaluacion_docente.html:
   - renderPrintStatBox (líneas 1392-1411) -> #printStatBox.
   - computeCriteriaDetailStats (líneas 2360-2374) + la parte de
     renderCriteriaInfoPanel que alimenta #printCriteriaBox (líneas
     2418-2431, tabla de buildCriteriaInfoHtml líneas 2400-2415).

   Ambos bloques están ocultos en pantalla (.print-stat-box{display:none}
   en global.css) y sólo se muestran dentro de @media print, igual que en
   el reference, para que el PDF incluya las estadísticas numéricas aunque
   la pestaña "Resumen"/"Detalle" activa en pantalla no las muestre.

   computeCriteriaDetailStats se duplica aquí (en vez de importarla desde
   CriteriaInfoModal.jsx, Tarea 12) porque no está exportada allí y es una
   función pequeña y autocontenida; mover ambas al módulo compartido
   src/lib/stats.js sería una mejora de seguimiento fuera del alcance de
   la Tarea 14. */

function computeCriteriaDetailStats(rows, nCrit) {
  return Array.from({ length: nCrit }, (_, i) => {
    const vals = rows.map((r) => r.scores[i]).filter((s) => s !== null && s !== undefined);
    if (vals.length === 0) return { n: 0, avg: 0, min: 0, max: 0 };
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return {
      n: vals.length,
      avg: Math.round(avg * 2 * 10) / 10,
      min: Math.round(Math.min(...vals) * 2 * 10) / 10,
      max: Math.round(Math.max(...vals) * 2 * 10) / 10
    };
  });
}

function PrintDescriptiveStats({ cursoRows }) {
  if (!cursoRows || cursoRows.length === 0) return <div className="print-stat-box" />;

  const notas = cursoRows.map((r) => r.notaFinal);
  const stats = computeDescriptiveStats(notas);
  const { pctSi, pctNo } = computeDirectiveCounts(cursoRows);

  return (
    <div className="print-stat-box">
      <div className="stat-title">Estadísticas descriptivas &mdash; Nota Dim. I (escala 1&ndash;20)</div>
      <table>
        <tbody>
          <tr>
            <td className="label">N&deg; de Respuestas</td><td className="value">{stats.n}</td>
            <td className="label">Suma</td><td className="value">{stats.sum}</td>
          </tr>
          <tr>
            <td className="label">Promedio</td><td className="value">{stats.avg}</td>
            <td className="label">Desv. Estándar</td><td className="value">{stats.stddev}</td>
          </tr>
          <tr>
            <td className="label">Máximo</td><td className="value">{stats.max}</td>
            <td className="label">Mínimo</td><td className="value">{stats.min}</td>
          </tr>
          <tr>
            <td className="label">% Cumplimiento directivas (Sí)</td><td className="value">{pctSi.toFixed(1)}%</td>
            <td className="label">% Incumplimiento (No)</td><td className="value">{pctNo.toFixed(1)}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PrintCriteriaDetail({ cursoRows, programaRows, criteriaLabels }) {
  const nCrit = criteriaLabels ? criteriaLabels.length : 0;
  if (!cursoRows || cursoRows.length === 0 || nCrit === 0) return <div className="print-stat-box" />;

  const detailStats = computeCriteriaDetailStats(cursoRows, nCrit);
  const programaAvgs = computeCriteriaAverages(programaRows || [], nCrit);

  return (
    <div className="print-stat-box">
      <div className="stat-title">Detalle de Desempeño por Criterio (P1&ndash;P6)</div>
      <table>
        <thead>
          <tr>
            <th>Criterio</th><th>Su promedio</th><th>Prom. programa</th>
            <th>Diferencia</th><th>Rango</th><th>N&deg;</th>
          </tr>
        </thead>
        <tbody>
          {criteriaLabels.map((label, i) => {
            const d = detailStats[i];
            const progAvg = Math.round(programaAvgs[i] * 10) / 10;
            const delta = Math.round((d.avg - progAvg) * 10) / 10;
            const deltaSign = delta > 0 ? '+' : '';
            return (
              <tr key={i}>
                <td className="label">{i + 1}. {label}</td>
                <td className="value">{d.avg.toFixed(1)}</td>
                <td className="value soft">{progAvg.toFixed(1)}</td>
                <td className="value soft">{deltaSign}{delta.toFixed(1)}</td>
                <td className="value soft">{d.min.toFixed(1)}&ndash;{d.max.toFixed(1)}</td>
                <td className="value soft">{d.n}/{cursoRows.length}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function PrintStatBox({ cursoRows, programaRows, criteriaLabels }) {
  return (
    <>
      <PrintDescriptiveStats cursoRows={cursoRows} />
      <PrintCriteriaDetail cursoRows={cursoRows} programaRows={programaRows} criteriaLabels={criteriaLabels} />
    </>
  );
}
