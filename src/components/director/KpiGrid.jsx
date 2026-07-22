import KpiCard from '../common/KpiCard.jsx';
import { computeDirectiveCounts } from '../../lib/stats.js';
import styles from './DirectorView.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html: renderKPIs (líneas 1484-1515). */

export default function KpiGrid({ rows, groups }) {
  const promedioGeneral = rows.length
    ? rows.reduce((a, r) => a + r.notaFinal, 0) / rows.length
    : 0;
  const { pctSi } = computeDirectiveCounts(rows);
  const totalEncuestas = rows.length;
  const totalDocentes = new Set(rows.map((r) => r.docente)).size;

  return (
    <div className={styles.kpiGrid}>
      <KpiCard label="Promedio General" value={promedioGeneral.toFixed(1)} note="Escala 1–20" />
      <KpiCard label='% Cumplimiento de Directivas' value={`${pctSi.toFixed(0)}%`} note='Respuestas "Sí" sobre el total' />
      <KpiCard label="Total de Encuestas" value={totalEncuestas} note="Respuestas registradas" />
      <KpiCard label="Total de Docentes" value={totalDocentes} note={`${groups.length} grupo(s) docente/curso`} />
    </div>
  );
}
