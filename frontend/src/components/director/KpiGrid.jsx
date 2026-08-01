import KpiCard from '../common/KpiCard.jsx';
import styles from './DirectorView.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html: renderKPIs (líneas 1484-1515).
   `groups` viene de GET /api/encuestas/consolidado (un registro por grupo
   docente+curso+ciclo+sección, ya agregado en el backend): los promedios se
   ponderan por `n` (n° de encuestas de cada grupo) en vez de recalcular desde
   respuestas crudas. */

export default function KpiGrid({ groups }) {
  const totalEncuestas = groups.reduce((a, g) => a + g.n, 0);
  const totalEncuestasValidas = groups.reduce((a, g) => a + (g.nValidas || 0), 0);
  const promedioGeneral = totalEncuestas
    ? groups.reduce((a, g) => a + g.nota * g.n, 0) / totalEncuestas
    : 0;
  const pctSi = totalEncuestas
    ? groups.reduce((a, g) => a + g.cumplimiento * g.n, 0) / totalEncuestas
    : 0;
  const totalDocentes = new Set(groups.map((g) => g.docenteId)).size;

  return (
    <div className={styles.kpiGrid}>
      <KpiCard label="Promedio General" value={promedioGeneral.toFixed(1)} note="Escala 1–20" />
      <KpiCard label='% Cumplimiento de Directivas' value={`${pctSi.toFixed(0)}%`} note='Respuestas "Sí" sobre el total' />
      <KpiCard label="Total de Encuestas" value={totalEncuestasValidas} note="Respuestas registradas" />
      <KpiCard label="Total de Docentes" value={totalDocentes} note={`${groups.length} grupo(s) docente/curso`} />
    </div>
  );
}
