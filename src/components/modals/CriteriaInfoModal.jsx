import { useMemo } from 'react';
import Modal from '../common/Modal.jsx';
import { useData } from '../../context/DataContext.jsx';
import { computeCriteriaAverages } from '../../lib/stats.js';
import styles from './CriteriaInfoModal.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html:
   computeCriteriaDetailStats (líneas 2360-2374) + buildCriteriaInfoHtml (2375-2417)
   + markup del modal (líneas 805-817).

   `cursoRows` es el payload que envía RadarPanel vía onOpenCriteriaInfo(cursoRows)
   (filas del docente+curso seleccionados). `first`/programaRows equivalen a los
   parámetros `first`/STATE.rows.filter(programa) del reference: se derivan aquí
   con useData() en vez de recibirlos como props, porque el disparador sólo pasa
   cursoRows (ver DocenteView.jsx / RadarPanel.jsx). */

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

export default function CriteriaInfoModal({ open, onClose, cursoRows }) {
  const { rows, criteriaLabels } = useData();
  const rowsDocenteCurso = cursoRows || [];
  const first = rowsDocenteCurso[0] || null;

  const detail = useMemo(() => {
    if (!first || rowsDocenteCurso.length === 0) return null;
    const nCrit = criteriaLabels.length;
    const detailStats = computeCriteriaDetailStats(rowsDocenteCurso, nCrit);
    const rowsPrograma = rows.filter((r) => r.programa === first.programa);
    const programaAvgs = computeCriteriaAverages(rowsPrograma, nCrit);
    const notaFinalProm = rowsDocenteCurso.reduce((a, r) => a + r.notaFinal, 0) / rowsDocenteCurso.length;
    return { detailStats, programaAvgs, notaFinalProm };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, rowsDocenteCurso, rows, criteriaLabels]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Detalle de Desempeño por Criterio"
      subtitle="Cómo se calcula la nota y cómo se compara cada pregunta frente al promedio del programa."
    >
      {!detail ? (
        <div className={styles.modalEmpty}>No hay datos suficientes para este docente/curso.</div>
      ) : (
        <>
          <p className={styles.infoNote}>
            La <b>Nota Final Dim. I</b> ({detail.notaFinalProm.toFixed(1)}) es el promedio simple de estas 6 preguntas.
            Cada respuesta se registra en escala 0&ndash;10 y aquí se muestra convertida a escala 0&ndash;20 (&times;2)
            para mantener consistencia con el resto del reporte. Si un encuestado dejó alguna pregunta sin responder,
            esa pregunta no se contabiliza en el promedio (ni del docente ni del programa) &mdash; solo se promedian
            las respuestas efectivamente registradas.
          </p>
          <div className={styles.tableResponsive}>
            <table>
              <thead>
                <tr>
                  <th>Criterio (P1&ndash;P6)</th>
                  <th>Su promedio</th>
                  <th>Prom. programa</th>
                  <th>Diferencia</th>
                  <th>Rango (mín&ndash;máx)</th>
                  <th>N&deg; respuestas</th>
                </tr>
              </thead>
              <tbody>
                {criteriaLabels.map((label, i) => {
                  const d = detail.detailStats[i];
                  const progAvg = Math.round(detail.programaAvgs[i] * 10) / 10;
                  const delta = Math.round((d.avg - progAvg) * 10) / 10;
                  const deltaClass = delta > 0.2 ? styles.deltaPos : (delta < -0.2 ? styles.deltaNeg : undefined);
                  const deltaSign = delta > 0 ? '+' : '';
                  return (
                    <tr key={i}>
                      <td>{i + 1}. {label}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{d.avg.toFixed(1)}</td>
                      <td style={{ textAlign: 'center', color: 'var(--text-soft)' }}>{progAvg.toFixed(1)}</td>
                      <td style={{ textAlign: 'center' }} className={deltaClass}>{deltaSign}{delta.toFixed(1)}</td>
                      <td style={{ textAlign: 'center' }}>{d.min.toFixed(1)} &ndash; {d.max.toFixed(1)}</td>
                      <td style={{ textAlign: 'center' }}>{d.n} / {rowsDocenteCurso.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
